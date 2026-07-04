import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PNG } from "pngjs";
import type { PetManifest } from "../pet_bundle/manifest.js";
import { validatePetBundle } from "../pet_bundle/validate.js";
import { SourceImageIntakeError, validateSourceImage, type SourceImageInfo } from "../intake/source-image.js";
import { createDoudouDigitalHumanAdapter } from "./adapters/doudou-digital-human-adapter.js";
import type { GeneratedPetAdapterOutput, GeneratedPetFrame, PetGenerationAdapter } from "./adapters/types.js";
import { analyzeDoudouSpriteAtlasQuality } from "./doudou-sprite-quality.js";
import {
  normalizeSourceImage,
  SourceImageNormalizationError,
  type NormalizedSourceImageHandle
} from "./normalization/source-normalizer.js";

export { SourceImageIntakeError, SourceImageNormalizationError };

export interface GeneratePetBundleOptions {
  sourceImagePath: string;
  outputBundleDir: string;
  now?: Date;
  adapter?: PetGenerationAdapter;
  normalizationTempRoot?: string;
  enforceDoudouSpriteQuality?: boolean;
}

export interface GeneratePetBundleResult {
  bundleDir: string;
  manifest: PetManifest;
  sourceImage: SourceImageInfo;
  generation: {
    adapterId: string;
    adapterVersion: string;
  };
}

export class PetGenerationError extends Error {
  readonly code:
    | "MISSING_OUTPUT_DIR"
    | "OUTPUT_PATH_NOT_DIRECTORY"
    | "OUTPUT_DIR_NOT_EMPTY"
    | "ADAPTER_OUTPUT_INVALID";

  constructor(code: PetGenerationError["code"], message: string) {
    super(message);
    this.name = "PetGenerationError";
    this.code = code;
  }
}

export async function generatePetBundleFromSource(options: GeneratePetBundleOptions): Promise<GeneratePetBundleResult> {
  if (!options.outputBundleDir) {
    throw new PetGenerationError("MISSING_OUTPUT_DIR", "An output bundle directory is required.");
  }

  const adapter = options.adapter ?? createDoudouDigitalHumanAdapter();
  adapter.preflight?.();

  const sourceImage = await validateSourceImage(options.sourceImagePath);
  const bundleDir = path.resolve(options.outputBundleDir);
  await prepareOutputDir(bundleDir);

  let normalizedSourceImage: NormalizedSourceImageHandle | null = null;
  let generatedPet: GeneratedPetAdapterOutput;
  try {
    if (adapter.requiresNormalizedSourceImage) {
      normalizedSourceImage = await normalizeSourceImage({
        sourceImagePath: options.sourceImagePath,
        sourceImage,
        tempRoot: options.normalizationTempRoot
      });
    }
    generatedPet = await adapter.generate({
      sourceImage,
      normalizedSourceImage: normalizedSourceImage?.image
    });
    validateAdapterOutput(adapter, generatedPet);
  } finally {
    await normalizedSourceImage?.cleanup();
  }

  const atlasPng = createAtlasPng(generatedPet.frames);
  if (options.enforceDoudouSpriteQuality ?? true) {
    assertDoudouQuality(atlasPng);
  }

  const manifest = createManifest(generatedPet, adapter);
  await mkdir(path.join(bundleDir, "atlases"), { recursive: true });
  await writeFile(path.join(bundleDir, "atlases/main.png"), atlasPng);
  await writeFile(path.join(bundleDir, "preview.png"), generatedPet.previewPng);
  await writeFile(
    path.join(bundleDir, "source.meta.json"),
    `${JSON.stringify(createSourceMeta(sourceImage, generatedPet, options.now), null, 2)}\n`
  );
  await writeFile(path.join(bundleDir, "pet.json"), `${JSON.stringify(manifest, null, 2)}\n`);

  await validatePetBundle(bundleDir);
  return {
    bundleDir,
    manifest,
    sourceImage,
    generation: {
      adapterId: generatedPet.adapterId,
      adapterVersion: generatedPet.adapterVersion
    }
  };
}

async function prepareOutputDir(bundleDir: string): Promise<void> {
  try {
    await mkdir(bundleDir, { recursive: true });
  } catch (error) {
    if (isNodeError(error, "EEXIST")) {
      throw new PetGenerationError("OUTPUT_PATH_NOT_DIRECTORY", "Output bundle path must be a directory.");
    }
    throw error;
  }
  const entries = await readdir(bundleDir, { withFileTypes: true });
  if (entries.length > 0) {
    throw new PetGenerationError("OUTPUT_DIR_NOT_EMPTY", "Output bundle directory must be empty.");
  }
}

function isNodeError(error: unknown, code: string): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === code;
}

function createManifest(generatedPet: GeneratedPetAdapterOutput, adapter: PetGenerationAdapter): PetManifest {
  return {
    schemaVersion: "0.1.0",
    id: generatedPet.petId,
    name: generatedPet.petName,
    assetFormat: "png_sprite_atlas_grid",
    canvas: {
      width: 256,
      height: 256,
      anchor: { x: 128, y: 232 }
    },
    assets: {
      preview: "preview.png",
      atlases: [
        {
          id: "main",
          path: "atlases/main.png",
          mime: "image/png",
          width: 1024,
          height: 512,
          frameWidth: 256,
          frameHeight: 256,
          columns: 4,
          rows: 2
        }
      ]
    },
    animations: {
      idle: {
        atlas: "main",
        loop: true,
        frames: [
          { index: 0, durationMs: 140 },
          { index: 1, durationMs: 140 },
          { index: 2, durationMs: 140 },
          { index: 1, durationMs: 140 }
        ]
      },
      tap_react: {
        atlas: "main",
        loop: false,
        frames: [
          { index: 4, durationMs: 90 },
          { index: 5, durationMs: 120 },
          { index: 6, durationMs: 120 }
        ],
        next: "idle"
      }
    },
    behavior: {
      initial: "idle",
      onTap: "tap_react"
    },
    hitArea: {
      type: "alpha",
      alphaThreshold: 16,
      fallbackRect: { x: 48, y: 32, width: 160, height: 208 }
    },
    privacy: {
      sourceImageStored: false,
      cloudGenerated: adapter.cloudGenerated ?? false
    },
    provenance: {
      sourceMeta: "source.meta.json"
    }
  };
}

function createSourceMeta(
  sourceImage: SourceImageInfo,
  generatedPet: GeneratedPetAdapterOutput,
  now = new Date()
): Record<string, unknown> {
  return {
    fixture: false,
    generatedBy: "src/generation/generate-pet.ts",
    generationAdapter: generatedPet.adapterId,
    generationAdapterVersion: generatedPet.adapterVersion,
    sourceType: "local-image-intake",
    inputMime: sourceImage.mime,
    inputBytes: sourceImage.bytes,
    createdAt: now.toISOString(),
    sourceImageStored: false
  };
}

function validateAdapterOutput(adapter: PetGenerationAdapter, output: GeneratedPetAdapterOutput): void {
  assertAllowedKeys(output, [
    "adapterId",
    "adapterVersion",
    "petId",
    "petName",
    "previewFrameIndex",
    "previewPng",
    "frames"
  ], "Generation adapter output");
  if (output.adapterId !== adapter.id || output.adapterVersion !== adapter.version) {
    throw new PetGenerationError("ADAPTER_OUTPUT_INVALID", "Generation adapter output identity does not match the adapter.");
  }
  if (!output.petId || !output.petName) {
    throw new PetGenerationError("ADAPTER_OUTPUT_INVALID", "Generation adapter output must include pet identity.");
  }
  if (!Array.isArray(output.frames)) {
    throw new PetGenerationError("ADAPTER_OUTPUT_INVALID", "Generation adapter output frames must be an array.");
  }
  const frameByIndex = new Map<number, GeneratedPetFrame>();
  for (const frame of output.frames) {
    assertAllowedKeys(frame, ["index", "role", "png"], "Generation adapter frame output");
    if (!Number.isInteger(frame.index) || frame.index < 0 || frame.index > 7) {
      throw new PetGenerationError("ADAPTER_OUTPUT_INVALID", "Generation adapter output frame indexes must be 0 through 7.");
    }
    if (frameByIndex.has(frame.index)) {
      throw new PetGenerationError("ADAPTER_OUTPUT_INVALID", "Generation adapter output contains duplicate frame indexes.");
    }
    frameByIndex.set(frame.index, frame);
    assertFramePng(frame.png, `frame ${frame.index}`);
  }
  for (let index = 0; index < 8; index += 1) {
    if (!frameByIndex.has(index)) {
      throw new PetGenerationError("ADAPTER_OUTPUT_INVALID", "Generation adapter output must include frame indexes 0 through 7.");
    }
  }
  if (!Number.isInteger(output.previewFrameIndex) || !frameByIndex.has(output.previewFrameIndex)) {
    throw new PetGenerationError("ADAPTER_OUTPUT_INVALID", "Generation adapter output preview frame index must reference a generated frame.");
  }
  assertFramePng(output.previewPng, "preview");
}

function assertAllowedKeys(value: unknown, allowedKeys: string[], label: string): void {
  if (!value || typeof value !== "object") {
    throw new PetGenerationError("ADAPTER_OUTPUT_INVALID", `${label} must be an object.`);
  }
  const allowed = new Set(allowedKeys);
  const unexpectedKey = Object.keys(value).find((key) => !allowed.has(key));
  if (unexpectedKey) {
    throw new PetGenerationError("ADAPTER_OUTPUT_INVALID", `${label} contains unsupported field ${unexpectedKey}.`);
  }
}

function assertFramePng(buffer: Buffer, label: string): PNG {
  let png: PNG;
  try {
    png = PNG.sync.read(buffer);
  } catch {
    throw new PetGenerationError("ADAPTER_OUTPUT_INVALID", `Generation adapter output ${label} is not a valid PNG.`);
  }
  if (png.width !== 256 || png.height !== 256) {
    throw new PetGenerationError("ADAPTER_OUTPUT_INVALID", `Generation adapter output ${label} must be 256x256.`);
  }
  if (isTransparent(png)) {
    throw new PetGenerationError("ADAPTER_OUTPUT_INVALID", `Generation adapter output ${label} must not be fully transparent.`);
  }
  return png;
}

function createAtlasPng(frames: GeneratedPetFrame[]): Buffer {
  const png = new PNG({ width: 1024, height: 512 });
  for (const frame of frames) {
    const framePng = assertFramePng(frame.png, `frame ${frame.index}`);
    blitFrame(png, framePng, (frame.index % 4) * 256, Math.floor(frame.index / 4) * 256);
  }
  return PNG.sync.write(png);
}

function assertDoudouQuality(atlasPng: Buffer): void {
  const quality = analyzeDoudouSpriteAtlasQuality(PNG.sync.read(atlasPng));
  if (!quality.ok) {
    throw new PetGenerationError(
      "ADAPTER_OUTPUT_INVALID",
      `Generated pet atlas failed Doudou sprite QA: ${quality.issues.map((issue) => issue.code).join(", ")}`
    );
  }
}

function blitFrame(atlas: PNG, frame: PNG, offsetX: number, offsetY: number): void {
  for (let y = 0; y < frame.height; y += 1) {
    for (let x = 0; x < frame.width; x += 1) {
      const sourceIndex = (frame.width * y + x) << 2;
      const targetIndex = (atlas.width * (offsetY + y) + offsetX + x) << 2;
      atlas.data[targetIndex] = frame.data[sourceIndex];
      atlas.data[targetIndex + 1] = frame.data[sourceIndex + 1];
      atlas.data[targetIndex + 2] = frame.data[sourceIndex + 2];
      atlas.data[targetIndex + 3] = frame.data[sourceIndex + 3];
    }
  }
}

function isTransparent(png: PNG): boolean {
  for (let index = 3; index < png.data.length; index += 4) {
    if (png.data[index] > 0) {
      return false;
    }
  }
  return true;
}

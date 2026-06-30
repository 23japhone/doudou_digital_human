import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PNG } from "pngjs";
import type { PetManifest } from "../pet_bundle/manifest.js";
import { validatePetBundle } from "../pet_bundle/validate.js";
import { SourceImageIntakeError, validateSourceImage, type SourceImageInfo } from "../intake/source-image.js";

export { SourceImageIntakeError };

export interface GeneratePetBundleOptions {
  sourceImagePath: string;
  outputBundleDir: string;
  now?: Date;
}

export interface GeneratePetBundleResult {
  bundleDir: string;
  manifest: PetManifest;
  sourceImage: SourceImageInfo;
}

export class PetGenerationError extends Error {
  readonly code: "MISSING_OUTPUT_DIR" | "OUTPUT_PATH_NOT_DIRECTORY" | "OUTPUT_DIR_NOT_EMPTY";

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

  const sourceImage = await validateSourceImage(options.sourceImagePath);
  const bundleDir = path.resolve(options.outputBundleDir);
  await prepareOutputDir(bundleDir);

  const manifest = createManifest();
  await mkdir(path.join(bundleDir, "atlases"), { recursive: true });
  await writeFile(path.join(bundleDir, "atlases/main.png"), createAtlasPng(sourceImage));
  await writeFile(path.join(bundleDir, "preview.png"), createPreviewPng(sourceImage));
  await writeFile(path.join(bundleDir, "source.meta.json"), `${JSON.stringify(createSourceMeta(sourceImage, options.now), null, 2)}\n`);
  await writeFile(path.join(bundleDir, "pet.json"), `${JSON.stringify(manifest, null, 2)}\n`);

  await validatePetBundle(bundleDir);
  return { bundleDir, manifest, sourceImage };
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

function createManifest(): PetManifest {
  return {
    schemaVersion: "0.1.0",
    id: "generated_local_pet",
    name: "Generated Local Pet",
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
      cloudGenerated: false
    },
    provenance: {
      sourceMeta: "source.meta.json"
    }
  };
}

function createSourceMeta(sourceImage: SourceImageInfo, now = new Date()): Record<string, unknown> {
  return {
    fixture: false,
    generatedBy: "src/generation/generate-pet.ts",
    sourceType: "local-image-intake",
    inputMime: sourceImage.mime,
    inputBytes: sourceImage.bytes,
    createdAt: now.toISOString(),
    sourceImageStored: false
  };
}

function createAtlasPng(sourceImage: SourceImageInfo): Buffer {
  const png = new PNG({ width: 1024, height: 512 });
  for (let frameIndex = 0; frameIndex < 8; frameIndex += 1) {
    drawPetFrame(png, (frameIndex % 4) * 256, Math.floor(frameIndex / 4) * 256, frameIndex, sourceImage);
  }
  return PNG.sync.write(png);
}

function createPreviewPng(sourceImage: SourceImageInfo): Buffer {
  const png = new PNG({ width: 256, height: 256 });
  drawPetFrame(png, 0, 0, 1, sourceImage);
  return PNG.sync.write(png);
}

function drawPetFrame(png: PNG, offsetX: number, offsetY: number, frameIndex: number, sourceImage: SourceImageInfo): void {
  const bounce = frameIndex % 3;
  const react = frameIndex >= 4;
  const accent = sourceImage.mime === "image/jpeg" ? [235, 154, 84] : [86, 179, 222];
  const bodyColor = react ? [255, 181, 96] : accent;
  const earColor = react ? [245, 126, 92] : [45, 137, 201];
  const eyeColor = [23, 35, 64];

  fillCircle(png, offsetX + 128, offsetY + 142 - bounce * 2, 58, bodyColor, 255);
  fillCircle(png, offsetX + 92, offsetY + 96 - bounce, 24, earColor, 255);
  fillCircle(png, offsetX + 164, offsetY + 96 - bounce, 24, earColor, 255);
  fillCircle(png, offsetX + 109, offsetY + 132 - bounce, react ? 6 : 8, eyeColor, 255);
  fillCircle(png, offsetX + 147, offsetY + 132 - bounce, react ? 6 : 8, eyeColor, 255);

  if (react) {
    fillCircle(png, offsetX + 128, offsetY + 164 - bounce, 10, [255, 255, 255], 255);
    fillRect(png, offsetX + 124, offsetY + 160 - bounce, 8, 8, eyeColor, 255);
    fillCircle(png, offsetX + 70, offsetY + 52, 6, [255, 226, 95], 255);
    fillCircle(png, offsetX + 186, offsetY + 56, 5, [255, 226, 95], 255);
  } else {
    fillRect(png, offsetX + 106, offsetY + 168 - bounce, 44, 7, eyeColor, 255);
  }

  fillRect(png, offsetX + 92, offsetY + 202 - bounce, 72, 8, [38, 90, 150], 180);
}

function fillCircle(
  png: PNG,
  centerX: number,
  centerY: number,
  radius: number,
  rgb: number[],
  alpha: number
): void {
  for (let y = centerY - radius; y <= centerY + radius; y += 1) {
    for (let x = centerX - radius; x <= centerX + radius; x += 1) {
      const dx = x - centerX;
      const dy = y - centerY;
      if (dx * dx + dy * dy <= radius * radius) {
        setPixel(png, x, y, rgb, alpha);
      }
    }
  }
}

function fillRect(png: PNG, x: number, y: number, width: number, height: number, rgb: number[], alpha: number): void {
  for (let yy = y; yy < y + height; yy += 1) {
    for (let xx = x; xx < x + width; xx += 1) {
      setPixel(png, xx, yy, rgb, alpha);
    }
  }
}

function setPixel(png: PNG, x: number, y: number, rgb: number[], alpha: number): void {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height) {
    return;
  }
  const index = (png.width * y + x) << 2;
  png.data[index] = rgb[0] ?? 0;
  png.data[index + 1] = rgb[1] ?? 0;
  png.data[index + 2] = rgb[2] ?? 0;
  png.data[index + 3] = alpha;
}

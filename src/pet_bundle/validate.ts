import { lstat, readFile, readdir, realpath } from "node:fs/promises";
import path from "node:path";
import { PNG } from "pngjs";
import { z } from "zod";
import { petManifestSchema, type PetAtlas, type PetManifest } from "./manifest.js";

export type ValidationErrorCode =
  | "MISSING_MANIFEST"
  | "INVALID_JSON"
  | "INVALID_MANIFEST"
  | "UNSUPPORTED_SCHEMA_VERSION"
  | "UNSAFE_PATH"
  | "MISSING_ASSET"
  | "INVALID_PNG"
  | "ASSET_DIMENSION_MISMATCH"
  | "INVALID_ATLAS_GRID"
  | "FRAME_OUT_OF_RANGE"
  | "UNKNOWN_ANIMATION"
  | "EMPTY_FRAME"
  | "SOURCE_IMAGE_STORED_UNSUPPORTED"
  | "SENSITIVE_SOURCE_METADATA"
  | "INVALID_SOURCE_METADATA"
  | "UNREFERENCED_BUNDLE_FILE";

export interface ValidationIssue {
  code: ValidationErrorCode;
  message: string;
  path?: string;
}

export interface ValidatedPetBundle {
  rootDir: string;
  manifest: PetManifest;
  referencedAssets: string[];
}

export class PetBundleValidationError extends Error {
  readonly issues: ValidationIssue[];

  constructor(issues: ValidationIssue[]) {
    super(issues.map((issue) => `${issue.code}: ${issue.message}`).join("\n"));
    this.name = "PetBundleValidationError";
    this.issues = issues;
  }
}

const sourceMetaSchema = z.object({
  fixture: z.boolean().optional(),
  generatedBy: z.string().min(1).max(160).optional(),
  sourceType: z.enum(["synthetic-geometric-shapes", "local-image-intake"]).optional(),
  license: z.string().min(1).max(160).optional(),
  containsPersonalImage: z.boolean().optional(),
  containsExternalAsset: z.boolean().optional(),
  inputMime: z.enum(["image/png", "image/jpeg"]).optional(),
  inputBytes: z.number().int().nonnegative().optional(),
  createdAt: z.string().datetime().optional(),
  sourceImageStored: z.literal(false).optional()
}).strict();

export async function validatePetBundle(bundleDir: string): Promise<ValidatedPetBundle> {
  const rootDir = await realpath(bundleDir);
  const manifestPath = path.join(rootDir, "pet.json");
  const issues: ValidationIssue[] = [];
  let manifestJson: unknown;

  try {
    manifestJson = JSON.parse(await readFile(manifestPath, "utf8"));
  } catch (error) {
    if (isNodeError(error, "ENOENT")) {
      throw new PetBundleValidationError([
        { code: "MISSING_MANIFEST", path: "pet.json", message: "Bundle is missing pet.json." }
      ]);
    }
    throw new PetBundleValidationError([
      { code: "INVALID_JSON", path: "pet.json", message: "pet.json is not valid JSON." }
    ]);
  }

  const schemaVersion = getSchemaVersion(manifestJson);
  if (schemaVersion && !schemaVersion.startsWith("0.1.")) {
    throw new PetBundleValidationError([
      {
        code: "UNSUPPORTED_SCHEMA_VERSION",
        path: "schemaVersion",
        message: `Unsupported pet bundle schema version ${schemaVersion}.`
      }
    ]);
  }

  const parsed = petManifestSchema.safeParse(manifestJson);
  if (!parsed.success) {
    throw new PetBundleValidationError([
      {
        code: "INVALID_MANIFEST",
        path: "pet.json",
        message: parsed.error.issues.map((issue) => issue.path.join(".") || issue.message).join("; ")
      }
    ]);
  }

  const manifest = parsed.data;
  const atlasById = new Map(manifest.assets.atlases.map((atlas) => [atlas.id, atlas]));
  const referencedAssets = new Set<string>();

  await validatePreview(rootDir, manifest.assets.preview, manifest, issues);
  referencedAssets.add(manifest.assets.preview);

  for (const atlas of manifest.assets.atlases) {
    await validateAtlas(rootDir, atlas, manifest, issues);
    referencedAssets.add(atlas.path);
  }

  validateAnimations(manifest, atlasById, issues);
  validateHitArea(manifest, issues);
  validatePrivacy(manifest, issues);

  await validateRelativeFile(rootDir, manifest.provenance.sourceMeta, issues);
  referencedAssets.add(manifest.provenance.sourceMeta);
  await validateSourceMeta(rootDir, manifest.provenance.sourceMeta, issues);
  if (issues.length === 0) {
    await validateNoUnreferencedFiles(rootDir, new Set(["pet.json", ...referencedAssets]), issues);
  }

  if (issues.length > 0) {
    throw new PetBundleValidationError(issues);
  }

  return {
    rootDir,
    manifest,
    referencedAssets: [...referencedAssets]
  };
}

async function validatePreview(
  rootDir: string,
  relativePath: string,
  manifest: PetManifest,
  issues: ValidationIssue[]
): Promise<void> {
  const absolutePath = await validateRelativeFile(rootDir, relativePath, issues);
  if (!absolutePath) {
    return;
  }

  const png = await readPng(absolutePath, relativePath, issues);
  if (!png) {
    return;
  }

  if (png.width !== manifest.canvas.width || png.height !== manifest.canvas.height) {
    issues.push({
      code: "ASSET_DIMENSION_MISMATCH",
      path: relativePath,
      message: `Preview dimensions are ${png.width}x${png.height}, expected ${manifest.canvas.width}x${manifest.canvas.height}.`
    });
  }
}

async function validateRelativeFile(rootDir: string, relativePath: string, issues: ValidationIssue[]): Promise<string | null> {
  if (!isSafeRelativePath(relativePath)) {
    issues.push({
      code: "UNSAFE_PATH",
      path: relativePath,
      message: "Bundle assets must use relative paths inside the bundle."
    });
    return null;
  }

  const absolutePath = path.resolve(rootDir, relativePath);
  if (!isInsideRoot(rootDir, absolutePath)) {
    issues.push({
      code: "UNSAFE_PATH",
      path: relativePath,
      message: "Bundle asset escapes the bundle root."
    });
    return null;
  }

  try {
    const fileStat = await lstat(absolutePath);
    if (fileStat.isSymbolicLink()) {
      const linkedPath = await realpath(absolutePath);
      if (!isInsideRoot(rootDir, linkedPath)) {
        issues.push({
          code: "UNSAFE_PATH",
          path: relativePath,
          message: "Bundle asset symlink escapes the bundle root."
        });
        return null;
      }
    }
    if (!fileStat.isFile() && !fileStat.isSymbolicLink()) {
      issues.push({
        code: "MISSING_ASSET",
        path: relativePath,
        message: "Bundle asset is not a file."
      });
      return null;
    }
    return absolutePath;
  } catch (error) {
    if (isNodeError(error, "ENOENT")) {
      issues.push({
        code: "MISSING_ASSET",
        path: relativePath,
        message: "Bundle asset is missing."
      });
      return null;
    }
    throw error;
  }
}

async function validateAtlas(
  rootDir: string,
  atlas: PetAtlas,
  manifest: PetManifest,
  issues: ValidationIssue[]
): Promise<void> {
  const absolutePath = await validateRelativeFile(rootDir, atlas.path, issues);
  if (!absolutePath) {
    return;
  }

  const png = await readPng(absolutePath, atlas.path, issues);
  if (!png) {
    return;
  }

  const dimensionsMatchManifest = png.width === atlas.width && png.height === atlas.height;
  if (!dimensionsMatchManifest) {
    issues.push({
      code: "ASSET_DIMENSION_MISMATCH",
      path: atlas.path,
      message: `Atlas dimensions are ${png.width}x${png.height}, expected ${atlas.width}x${atlas.height}.`
    });
  }

  if (
    dimensionsMatchManifest &&
    (atlas.width !== atlas.columns * atlas.frameWidth || atlas.height !== atlas.rows * atlas.frameHeight)
  ) {
    issues.push({
      code: "INVALID_ATLAS_GRID",
      path: atlas.path,
      message: "Atlas dimensions do not match its fixed grid."
    });
  }

  for (const animation of Object.values(manifest.animations)) {
    if (animation.atlas !== atlas.id) {
      continue;
    }
    for (const frame of animation.frames) {
      if (frame.index >= atlas.columns * atlas.rows) {
        continue;
      }
      if (isFrameTransparent(png, atlas, frame.index)) {
        issues.push({
          code: "EMPTY_FRAME",
          path: `${atlas.path}#${frame.index}`,
          message: "Referenced frame is fully transparent."
        });
      }
    }
  }
}

function validateAnimations(
  manifest: PetManifest,
  atlasById: Map<string, PetAtlas>,
  issues: ValidationIssue[]
): void {
  const animationNames = new Set(Object.keys(manifest.animations));
  for (const requiredName of ["idle", "tap_react"]) {
    if (!animationNames.has(requiredName)) {
      issues.push({
        code: "UNKNOWN_ANIMATION",
        path: `animations.${requiredName}`,
        message: `Required animation ${requiredName} is missing.`
      });
    }
  }

  for (const [name, animation] of Object.entries(manifest.animations)) {
    const atlas = atlasById.get(animation.atlas);
    if (!atlas) {
      issues.push({
        code: "UNKNOWN_ANIMATION",
        path: `animations.${name}.atlas`,
        message: `Animation ${name} references an unknown atlas.`
      });
      continue;
    }
    const frameCount = atlas.columns * atlas.rows;
    for (const frame of animation.frames) {
      if (frame.index >= frameCount) {
        issues.push({
          code: "FRAME_OUT_OF_RANGE",
          path: `animations.${name}.frames`,
          message: `Frame ${frame.index} is outside atlas ${atlas.id}.`
        });
      }
    }
    if (animation.next && !animationNames.has(animation.next)) {
      issues.push({
        code: "UNKNOWN_ANIMATION",
        path: `animations.${name}.next`,
        message: `Animation ${name} points to unknown next animation ${animation.next}.`
      });
    }
  }

  if (!animationNames.has(manifest.behavior.initial)) {
    issues.push({
      code: "UNKNOWN_ANIMATION",
      path: "behavior.initial",
      message: `Initial behavior references unknown animation ${manifest.behavior.initial}.`
    });
  }
  if (!animationNames.has(manifest.behavior.onTap)) {
    issues.push({
      code: "UNKNOWN_ANIMATION",
      path: "behavior.onTap",
      message: `Tap behavior references unknown animation ${manifest.behavior.onTap}.`
    });
  }
}

function validateHitArea(manifest: PetManifest, issues: ValidationIssue[]): void {
  const { fallbackRect } = manifest.hitArea;
  if (
    fallbackRect.x + fallbackRect.width > manifest.canvas.width ||
    fallbackRect.y + fallbackRect.height > manifest.canvas.height
  ) {
    issues.push({
      code: "INVALID_MANIFEST",
      path: "hitArea.fallbackRect",
      message: "Fallback hit area must fit inside the canvas."
    });
  }
}

function validatePrivacy(manifest: PetManifest, issues: ValidationIssue[]): void {
  if (manifest.privacy.sourceImageStored) {
    issues.push({
      code: "SOURCE_IMAGE_STORED_UNSUPPORTED",
      path: "privacy.sourceImageStored",
      message: "pet bundle v0.1 must not store source images or source image paths."
    });
  }
}

async function validateSourceMeta(
  rootDir: string,
  relativePath: string,
  issues: ValidationIssue[]
): Promise<void> {
  if (!isSafeRelativePath(relativePath)) {
    return;
  }
  const absolutePath = path.resolve(rootDir, relativePath);
  let sourceMeta: unknown;
  try {
    sourceMeta = JSON.parse(await readFile(absolutePath, "utf8"));
  } catch {
    issues.push({
      code: "INVALID_JSON",
      path: relativePath,
      message: "source.meta.json is not valid JSON."
    });
    return;
  }

  if (containsSensitiveMetadata(sourceMeta)) {
    issues.push({
      code: "SENSITIVE_SOURCE_METADATA",
      path: relativePath,
      message: "Source metadata contains sensitive source image, prompt, response, or secret data."
    });
    return;
  }

  const parsed = sourceMetaSchema.safeParse(sourceMeta);
  if (!parsed.success) {
    issues.push({
      code: "INVALID_SOURCE_METADATA",
      path: relativePath,
      message: "source.meta.json contains fields outside the pet bundle v0.1 allowlist."
    });
  }
}

async function validateNoUnreferencedFiles(
  rootDir: string,
  allowedRelativePaths: Set<string>,
  issues: ValidationIssue[]
): Promise<void> {
  for (const relativePath of await listBundleFiles(rootDir)) {
    if (!allowedRelativePaths.has(relativePath)) {
      issues.push({
        code: "UNREFERENCED_BUNDLE_FILE",
        path: relativePath,
        message: "Bundle contains a file that is not referenced by pet.json."
      });
    }
  }
}

async function listBundleFiles(rootDir: string): Promise<string[]> {
  const files: string[] = [];

  async function walk(currentDir: string): Promise<void> {
    const entries = await readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(currentDir, entry.name);
      const relativePath = toBundlePath(path.relative(rootDir, absolutePath));
      if (entry.isDirectory()) {
        await walk(absolutePath);
      } else if (entry.isFile() || entry.isSymbolicLink()) {
        files.push(relativePath);
      }
    }
  }

  await walk(rootDir);
  return files;
}

function toBundlePath(relativePath: string): string {
  return relativePath.split(path.sep).join("/");
}

async function readPng(absolutePath: string, displayPath: string, issues: ValidationIssue[]): Promise<PNG | null> {
  const buffer = await readFile(absolutePath);
  const magic = buffer.subarray(0, 8).toString("hex");
  if (magic !== "89504e470d0a1a0a") {
    issues.push({
      code: "INVALID_PNG",
      path: displayPath,
      message: "Asset is not a PNG file."
    });
    return null;
  }

  try {
    return PNG.sync.read(buffer);
  } catch {
    issues.push({
      code: "INVALID_PNG",
      path: displayPath,
      message: "PNG asset could not be decoded."
    });
    return null;
  }
}

function isFrameTransparent(png: PNG, atlas: PetAtlas, frameIndex: number): boolean {
  const cellX = (frameIndex % atlas.columns) * atlas.frameWidth;
  const cellY = Math.floor(frameIndex / atlas.columns) * atlas.frameHeight;
  for (let y = cellY; y < cellY + atlas.frameHeight; y += 1) {
    for (let x = cellX; x < cellX + atlas.frameWidth; x += 1) {
      const index = (png.width * y + x) << 2;
      if (png.data[index + 3] > 0) {
        return false;
      }
    }
  }
  return true;
}

function containsSensitiveMetadata(value: unknown): boolean {
  const sensitiveKeyFragments = [
    "apikey",
    "authorization",
    "prompt",
    "rawprompt",
    "rawresponse",
    "sourceimage",
    "absolutepath",
    "secret",
    "token"
  ];

  function visit(node: unknown, key?: string): boolean {
    if (key) {
      const normalizedKey = normalizeMetadataKey(key);
      if (normalizedKey === "sourceimagestored") {
        return node !== false;
      }
      if (sensitiveKeyFragments.some((fragment) => normalizedKey.includes(fragment))) {
        return true;
      }
    }
    if (typeof node === "string") {
      const normalizedValue = node.trim().toLowerCase();
      return path.isAbsolute(node) || /^[a-zA-Z]:[\\/]/.test(node) || normalizedValue.startsWith("file:");
    }
    if (!node || typeof node !== "object") {
      return false;
    }
    if (Array.isArray(node)) {
      return node.some((item) => visit(item));
    }
    return Object.entries(node as Record<string, unknown>).some(([childKey, childValue]) => visit(childValue, childKey));
  }

  return visit(value);
}

function normalizeMetadataKey(key: string): string {
  return key.toLowerCase().replaceAll(/[_-]/g, "");
}

function getSchemaVersion(value: unknown): string | null {
  if (value && typeof value === "object" && "schemaVersion" in value) {
    const schemaVersion = (value as { schemaVersion?: unknown }).schemaVersion;
    return typeof schemaVersion === "string" ? schemaVersion : null;
  }
  return null;
}

function isSafeRelativePath(relativePath: string): boolean {
  return (
    !path.isAbsolute(relativePath) &&
    !/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(relativePath) &&
    !/^[a-zA-Z]:[\\/]/.test(relativePath) &&
    !relativePath.startsWith("\\\\") &&
    !relativePath.split(/[\\/]+/).includes("..")
  );
}

function isInsideRoot(rootDir: string, absolutePath: string): boolean {
  const relative = path.relative(rootDir, absolutePath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function isNodeError(error: unknown, code: string): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === code;
}

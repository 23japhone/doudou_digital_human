import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { decode as decodeJpeg } from "jpeg-js";
import { PNG } from "pngjs";
import type { SourceImageInfo } from "../../intake/source-image.js";

export type SourceImageNormalizationErrorCode =
  | "SOURCE_IMAGE_NORMALIZATION_FAILED"
  | "SOURCE_IMAGE_TOO_SMALL"
  | "SOURCE_IMAGE_TOO_LARGE";

export class SourceImageNormalizationError extends Error {
  readonly code: SourceImageNormalizationErrorCode;

  constructor(code: SourceImageNormalizationErrorCode, message: string) {
    super(message);
    this.name = "SourceImageNormalizationError";
    this.code = code;
  }
}

export interface NormalizedSourceImage {
  bytes: Buffer;
  mime: "image/png";
  width: 256;
  height: 256;
  temporaryPath: string;
}

export interface NormalizedSourceImageHandle {
  image: NormalizedSourceImage;
  cleanup(): Promise<void>;
}

export interface NormalizeSourceImageOptions {
  sourceImagePath: string;
  sourceImage: SourceImageInfo;
  tempRoot?: string;
}

export async function normalizeSourceImage(options: NormalizeSourceImageOptions): Promise<NormalizedSourceImageHandle> {
  assertNormalizableDimensions(options.sourceImage);
  const decoded = await decodeSourceImage(options.sourceImagePath, options.sourceImage.mime);
  const normalized = renderNormalizedPng(decoded);
  const root = await createTempRoot(options.tempRoot);
  const temporaryPath = path.join(root, "normalized-source.png");
  await writeFile(temporaryPath, normalized);

  return {
    image: {
      bytes: normalized,
      mime: "image/png",
      width: 256,
      height: 256,
      temporaryPath
    },
    async cleanup() {
      await rm(root, { force: true, recursive: true });
    }
  };
}

function assertNormalizableDimensions(sourceImage: SourceImageInfo): void {
  if (sourceImage.width < 16 || sourceImage.height < 16) {
    throw new SourceImageNormalizationError("SOURCE_IMAGE_TOO_SMALL", "Source image is too small for generation.");
  }
  if (sourceImage.width * sourceImage.height > 4096 * 4096) {
    throw new SourceImageNormalizationError("SOURCE_IMAGE_TOO_LARGE", "Source image is too large for generation.");
  }
}

async function decodeSourceImage(sourceImagePath: string, mime: SourceImageInfo["mime"]): Promise<PNG> {
  const sourceBytes = await readFile(sourceImagePath);
  try {
    if (mime === "image/png") {
      return PNG.sync.read(sourceBytes);
    }
    const jpeg = decodeJpeg(sourceBytes, {
      useTArray: true,
      tolerantDecoding: false,
      formatAsRGBA: true,
      maxMemoryUsageInMB: 128
    });
    const png = new PNG({ width: jpeg.width, height: jpeg.height });
    png.data.set(jpeg.data);
    return png;
  } catch {
    throw new SourceImageNormalizationError(
      "SOURCE_IMAGE_NORMALIZATION_FAILED",
      "Source image could not be normalized for generation."
    );
  }
}

function renderNormalizedPng(source: PNG): Buffer {
  const output = new PNG({ width: 256, height: 256 });
  const scale = Math.min(256 / source.width, 256 / source.height);
  const targetWidth = Math.max(1, Math.round(source.width * scale));
  const targetHeight = Math.max(1, Math.round(source.height * scale));
  const offsetX = Math.floor((256 - targetWidth) / 2);
  const offsetY = Math.floor((256 - targetHeight) / 2);

  for (let y = 0; y < targetHeight; y += 1) {
    for (let x = 0; x < targetWidth; x += 1) {
      const sourceX = Math.min(source.width - 1, Math.floor(x / scale));
      const sourceY = Math.min(source.height - 1, Math.floor(y / scale));
      const sourceIndex = (source.width * sourceY + sourceX) << 2;
      const targetIndex = (output.width * (offsetY + y) + offsetX + x) << 2;
      output.data[targetIndex] = source.data[sourceIndex];
      output.data[targetIndex + 1] = source.data[sourceIndex + 1];
      output.data[targetIndex + 2] = source.data[sourceIndex + 2];
      output.data[targetIndex + 3] = source.data[sourceIndex + 3];
    }
  }

  return PNG.sync.write(output);
}

async function createTempRoot(tempRoot?: string): Promise<string> {
  if (tempRoot) {
    await mkdir(tempRoot, { recursive: true });
    return mkdtemp(path.join(tempRoot, "normalized-"));
  }
  return mkdtemp(path.join(tmpdir(), "doudou-normalized-"));
}

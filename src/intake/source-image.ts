import { lstat, readFile } from "node:fs/promises";
import path from "node:path";
import { decode as decodeJpeg } from "jpeg-js";
import { PNG } from "pngjs";

export type SourceImageIntakeErrorCode =
  | "MISSING_SOURCE_IMAGE"
  | "REMOTE_SOURCE_UNSUPPORTED"
  | "SOURCE_URI_UNSUPPORTED"
  | "UNSAFE_SOURCE_PATH"
  | "SOURCE_IMAGE_NOT_FOUND"
  | "SOURCE_IMAGE_NOT_FILE"
  | "UNSUPPORTED_SOURCE_IMAGE_TYPE"
  | "INVALID_SOURCE_IMAGE";

export interface SourceImageInfo {
  bytes: number;
  mime: "image/png" | "image/jpeg";
  width: number;
  height: number;
}

export class SourceImageIntakeError extends Error {
  readonly code: SourceImageIntakeErrorCode;

  constructor(code: SourceImageIntakeErrorCode, message: string) {
    super(message);
    this.name = "SourceImageIntakeError";
    this.code = code;
  }
}

export async function validateSourceImage(inputPath: string, cwd = process.cwd()): Promise<SourceImageInfo> {
  if (!inputPath) {
    throw new SourceImageIntakeError("MISSING_SOURCE_IMAGE", "A source image path is required.");
  }
  if (inputPath.startsWith("file:")) {
    throw new SourceImageIntakeError("SOURCE_URI_UNSUPPORTED", "Use a local filesystem path, not a file URI.");
  }
  if (hasUnsupportedScheme(inputPath)) {
    throw new SourceImageIntakeError("REMOTE_SOURCE_UNSUPPORTED", "Remote image URLs are not supported.");
  }
  if (!path.isAbsolute(inputPath) && inputPath.split(/[\\/]+/).includes("..")) {
    throw new SourceImageIntakeError("UNSAFE_SOURCE_PATH", "Relative source image paths must not traverse upward.");
  }

  const absolutePath = path.isAbsolute(inputPath) ? inputPath : path.resolve(cwd, inputPath);
  let fileStat;
  try {
    fileStat = await lstat(absolutePath);
  } catch (error) {
    if (isNodeError(error, "ENOENT")) {
      throw new SourceImageIntakeError("SOURCE_IMAGE_NOT_FOUND", "Source image does not exist.");
    }
    throw error;
  }

  if (!fileStat.isFile()) {
    throw new SourceImageIntakeError("SOURCE_IMAGE_NOT_FILE", "Source image path must point to a file.");
  }

  const buffer = await readFile(absolutePath);
  const image = inspectImage(buffer);
  return {
    bytes: buffer.length,
    ...image
  };
}

function inspectImage(buffer: Buffer): Omit<SourceImageInfo, "bytes"> {
  if (isPng(buffer)) {
    try {
      const png = PNG.sync.read(buffer);
      return { mime: "image/png", width: png.width, height: png.height };
    } catch {
      throw new SourceImageIntakeError("INVALID_SOURCE_IMAGE", "PNG source image could not be decoded.");
    }
  }

  if (isJpeg(buffer)) {
    try {
      const jpeg = decodeJpeg(buffer, {
        useTArray: true,
        tolerantDecoding: false,
        maxMemoryUsageInMB: 128
      });
      return { mime: "image/jpeg", width: jpeg.width, height: jpeg.height };
    } catch {
      throw new SourceImageIntakeError("INVALID_SOURCE_IMAGE", "JPEG source image could not be decoded.");
    }
  }

  throw new SourceImageIntakeError("UNSUPPORTED_SOURCE_IMAGE_TYPE", "Source image must be a PNG or JPEG file.");
}

function isPng(buffer: Buffer): boolean {
  return buffer.subarray(0, 8).toString("hex") === "89504e470d0a1a0a";
}

function isJpeg(buffer: Buffer): boolean {
  return buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
}

function hasUnsupportedScheme(value: string): boolean {
  return /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value) && !/^[a-zA-Z]:[\\/]/.test(value);
}

function isNodeError(error: unknown, code: string): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === code;
}

import { PNG } from "pngjs";
import type {
  GeneratedPetAdapterOutput,
  GeneratedPetFrame,
  PetGenerationAdapter,
  PetGenerationRequest
} from "./types.js";
import type { NormalizedSourceImage } from "../normalization/source-normalizer.js";

export type CloudImageAdapterErrorCode =
  | "CLOUD_OPT_IN_REQUIRED"
  | "PROVIDER_NOT_CONFIGURED"
  | "SOURCE_IMAGE_NORMALIZATION_FAILED"
  | "MODEL_REFUSED"
  | "MODEL_RATE_LIMITED"
  | "MODEL_TIMEOUT"
  | "MODEL_PROVIDER_ERROR"
  | "MODEL_OUTPUT_INVALID"
  | "POSTPROCESSING_FAILED";

export type CloudImageProviderErrorCode =
  | "refused"
  | "rate_limited"
  | "timeout"
  | "provider_error"
  | "invalid_output";

export class CloudImageAdapterError extends Error {
  readonly code: CloudImageAdapterErrorCode;

  constructor(code: CloudImageAdapterErrorCode, message: string) {
    super(message);
    this.name = "CloudImageAdapterError";
    this.code = code;
  }
}

export class CloudImageProviderError extends Error {
  readonly providerCode: CloudImageProviderErrorCode;

  constructor(providerCode: CloudImageProviderErrorCode, message: string) {
    super(message);
    this.name = "CloudImageProviderError";
    this.providerCode = providerCode;
  }
}

export interface CloudImageAdapterConfig {
  providerId: string;
  apiKey?: string;
}

export interface CloudImageProviderRequest {
  providerId: string;
  instructionPreset: "desktop-pet-v0.1";
  normalizedImage: {
    bytes: Buffer;
    mime: "image/png";
    width: 256;
    height: 256;
  };
}

export interface CloudImageProviderOutput {
  imagePng: Buffer;
}

export interface CloudImageProvider {
  id: string;
  generateCharacter(request: CloudImageProviderRequest): Promise<CloudImageProviderOutput>;
}

export interface CreateCloudImageAdapterOptions {
  confirmCloudUpload: boolean;
  config: CloudImageAdapterConfig;
  provider: CloudImageProvider;
}

export function createCloudImageAdapter(options: CreateCloudImageAdapterOptions): PetGenerationAdapter {
  return {
    id: `cloud-image-adapter.${options.provider.id}`,
    version: "0.1.0",
    cloudGenerated: true,
    requiresNormalizedSourceImage: true,
    preflight() {
      assertCloudReady(options);
    },
    async generate(request: PetGenerationRequest): Promise<GeneratedPetAdapterOutput> {
      assertCloudReady(options);
      if (!request.normalizedSourceImage) {
        throw new CloudImageAdapterError(
          "SOURCE_IMAGE_NORMALIZATION_FAILED",
          "Cloud generation requires a normalized source image."
        );
      }

      const providerOutput = await callProvider(options, request.normalizedSourceImage);
      const frames = createFramesFromProviderImage(providerOutput.imagePng);
      const previewFrame = frames.find((frame) => frame.index === 1) ?? frames[0];
      return {
        adapterId: `cloud-image-adapter.${options.provider.id}`,
        adapterVersion: "0.1.0",
        petId: "generated_cloud_pet",
        petName: "Generated Cloud Pet",
        previewFrameIndex: previewFrame?.index ?? 0,
        previewPng: previewFrame?.png ?? frames[0]!.png,
        frames
      };
    }
  };
}

export function createMockCloudImageProvider(): CloudImageProvider {
  return {
    id: "mock-provider",
    async generateCharacter(request: CloudImageProviderRequest): Promise<CloudImageProviderOutput> {
      return {
        imagePng: createMockProviderImage(request.normalizedImage.bytes)
      };
    }
  };
}

function assertCloudReady(options: CreateCloudImageAdapterOptions): void {
  if (!options.confirmCloudUpload) {
    throw new CloudImageAdapterError(
      "CLOUD_OPT_IN_REQUIRED",
      "Cloud generation requires explicit upload confirmation."
    );
  }
  if (!options.config.providerId || options.config.providerId !== options.provider.id || !options.config.apiKey) {
    throw new CloudImageAdapterError(
      "PROVIDER_NOT_CONFIGURED",
      "Cloud provider configuration is missing or does not match the selected provider."
    );
  }
}

async function callProvider(
  options: CreateCloudImageAdapterOptions,
  normalizedSourceImage: NormalizedSourceImage
): Promise<CloudImageProviderOutput> {
  let output: CloudImageProviderOutput;
  try {
    output = await options.provider.generateCharacter({
      providerId: options.provider.id,
      instructionPreset: "desktop-pet-v0.1",
      normalizedImage: {
        bytes: normalizedSourceImage.bytes,
        mime: normalizedSourceImage.mime,
        width: normalizedSourceImage.width,
        height: normalizedSourceImage.height
      }
    });
  } catch (error) {
    throw mapProviderError(error);
  }

  assertProviderOutput(output);
  return output;
}

function mapProviderError(error: unknown): CloudImageAdapterError {
  if (error instanceof CloudImageProviderError) {
    const mapped: Record<CloudImageProviderErrorCode, CloudImageAdapterErrorCode> = {
      refused: "MODEL_REFUSED",
      rate_limited: "MODEL_RATE_LIMITED",
      timeout: "MODEL_TIMEOUT",
      provider_error: "MODEL_PROVIDER_ERROR",
      invalid_output: "MODEL_OUTPUT_INVALID"
    };
    return new CloudImageAdapterError(mapped[error.providerCode], providerErrorMessage(mapped[error.providerCode]));
  }
  return new CloudImageAdapterError("MODEL_PROVIDER_ERROR", "Cloud provider failed.");
}

function providerErrorMessage(code: CloudImageAdapterErrorCode): string {
  switch (code) {
    case "MODEL_REFUSED":
      return "Cloud provider refused the generation request.";
    case "MODEL_RATE_LIMITED":
      return "Cloud provider rate limit was reached.";
    case "MODEL_TIMEOUT":
      return "Cloud provider request timed out.";
    case "MODEL_OUTPUT_INVALID":
      return "Cloud provider output was invalid.";
    default:
      return "Cloud provider failed.";
  }
}

function assertProviderOutput(output: unknown): asserts output is CloudImageProviderOutput {
  if (!output || typeof output !== "object") {
    throw new CloudImageAdapterError("MODEL_OUTPUT_INVALID", "Cloud provider output must be an object.");
  }
  const keys = Object.keys(output);
  if (keys.length !== 1 || keys[0] !== "imagePng") {
    throw new CloudImageAdapterError("MODEL_OUTPUT_INVALID", "Cloud provider output contains unsupported fields.");
  }
  const imagePng = (output as CloudImageProviderOutput).imagePng;
  if (!Buffer.isBuffer(imagePng)) {
    throw new CloudImageAdapterError("MODEL_OUTPUT_INVALID", "Cloud provider image output must be a PNG buffer.");
  }
}

function createFramesFromProviderImage(providerPng: Buffer): GeneratedPetFrame[] {
  let reference: PNG;
  try {
    reference = PNG.sync.read(providerPng);
  } catch {
    throw new CloudImageAdapterError("MODEL_OUTPUT_INVALID", "Cloud provider image output could not be decoded.");
  }

  const frames: GeneratedPetFrame[] = [];
  for (let frameIndex = 0; frameIndex < 8; frameIndex += 1) {
    frames.push({
      index: frameIndex,
      role: frameIndex >= 4 ? "tap_react" : "idle",
      png: renderFrame(reference, frameIndex)
    });
  }
  return frames;
}

function renderFrame(reference: PNG, frameIndex: number): Buffer {
  try {
    const frame = new PNG({ width: 256, height: 256 });
    const bounce = frameIndex % 3;
    const react = frameIndex >= 4;
    blitScaled(reference, frame, 0, react ? -bounce * 2 : -bounce);
    if (react) {
      fillCircle(frame, 68, 54, 6, [255, 226, 95], 255);
      fillCircle(frame, 188, 58, 5, [255, 226, 95], 255);
    }
    return PNG.sync.write(frame);
  } catch {
    throw new CloudImageAdapterError("POSTPROCESSING_FAILED", "Cloud provider image could not be post-processed.");
  }
}

function blitScaled(source: PNG, target: PNG, offsetX: number, offsetY: number): void {
  const scale = Math.min(target.width / source.width, target.height / source.height);
  const width = Math.max(1, Math.round(source.width * scale));
  const height = Math.max(1, Math.round(source.height * scale));
  const startX = Math.floor((target.width - width) / 2) + offsetX;
  const startY = Math.floor((target.height - height) / 2) + offsetY;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sourceX = Math.min(source.width - 1, Math.floor(x / scale));
      const sourceY = Math.min(source.height - 1, Math.floor(y / scale));
      const sourceIndex = (source.width * sourceY + sourceX) << 2;
      setPixel(target, startX + x, startY + y, [
        source.data[sourceIndex] ?? 0,
        source.data[sourceIndex + 1] ?? 0,
        source.data[sourceIndex + 2] ?? 0
      ], source.data[sourceIndex + 3] ?? 0);
    }
  }
}

function createMockProviderImage(seedBytes: Buffer): Buffer {
  const png = new PNG({ width: 256, height: 256 });
  const seed = seedBytes.reduce((sum, value) => (sum + value) % 255, 0);
  fillCircle(png, 128, 138, 62, [80 + (seed % 70), 150, 215], 255);
  fillCircle(png, 92, 94, 24, [66, 130 + (seed % 40), 202], 255);
  fillCircle(png, 164, 94, 24, [66, 130 + (seed % 40), 202], 255);
  fillCircle(png, 109, 132, 8, [23, 35, 64], 255);
  fillCircle(png, 147, 132, 8, [23, 35, 64], 255);
  fillRect(png, 106, 168, 44, 7, [23, 35, 64], 255);
  fillRect(png, 92, 202, 72, 8, [38, 90, 150], 180);
  return PNG.sync.write(png);
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

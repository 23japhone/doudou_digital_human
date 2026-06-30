import { PNG } from "pngjs";
import type {
  GeneratedPetAdapterOutput,
  GeneratedPetFrame,
  PetGenerationAdapter,
  PetGenerationRequest
} from "./types.js";
import type { SourceImageInfo } from "../../intake/source-image.js";

export function createScriptedPetAdapter(): PetGenerationAdapter {
  const adapterId = "scripted-pet-adapter";
  const adapterVersion = "0.1.0";
  return {
    id: adapterId,
    version: adapterVersion,
    async generate(request: PetGenerationRequest): Promise<GeneratedPetAdapterOutput> {
      const frames = createFrames(request.sourceImage);
      const previewFrame = frames.find((frame) => frame.index === 1) ?? frames[0];
      return {
        adapterId,
        adapterVersion,
        petId: "generated_local_pet",
        petName: "Generated Local Pet",
        previewFrameIndex: previewFrame?.index ?? 0,
        previewPng: previewFrame?.png ?? createFramePng(0, request.sourceImage),
        frames
      };
    }
  };
}

function createFrames(sourceImage: SourceImageInfo): GeneratedPetFrame[] {
  const frames: GeneratedPetFrame[] = [];
  for (let frameIndex = 0; frameIndex < 8; frameIndex += 1) {
    frames.push({
      index: frameIndex,
      role: frameIndex >= 4 ? "tap_react" : "idle",
      png: createFramePng(frameIndex, sourceImage)
    });
  }
  return frames;
}

function createFramePng(frameIndex: number, sourceImage: SourceImageInfo): Buffer {
  const png = new PNG({ width: 256, height: 256 });
  drawPetFrame(png, frameIndex, sourceImage);
  return PNG.sync.write(png);
}

function drawPetFrame(png: PNG, frameIndex: number, sourceImage: SourceImageInfo): void {
  const bounce = frameIndex % 3;
  const react = frameIndex >= 4;
  const tallSource = sourceImage.height > sourceImage.width;
  const accent = sourceImage.mime === "image/jpeg" ? [235, 154, 84] : [86, 179, 222];
  const bodyColor = react ? [255, 181, 96] : accent;
  const earColor = react ? [245, 126, 92] : tallSource ? [64, 158, 186] : [45, 137, 201];
  const eyeColor = [23, 35, 64];

  fillCircle(png, 128, 142 - bounce * 2, tallSource ? 62 : 58, bodyColor, 255);
  fillCircle(png, 92, 96 - bounce, tallSource ? 21 : 24, earColor, 255);
  fillCircle(png, 164, 96 - bounce, tallSource ? 21 : 24, earColor, 255);
  fillCircle(png, 109, 132 - bounce, react ? 6 : 8, eyeColor, 255);
  fillCircle(png, 147, 132 - bounce, react ? 6 : 8, eyeColor, 255);

  if (react) {
    fillCircle(png, 128, 164 - bounce, 10, [255, 255, 255], 255);
    fillRect(png, 124, 160 - bounce, 8, 8, eyeColor, 255);
    fillCircle(png, 70, 52, 6, [255, 226, 95], 255);
    fillCircle(png, 186, 56, 5, [255, 226, 95], 255);
  } else {
    fillRect(png, 106, 168 - bounce, 44, 7, eyeColor, 255);
  }

  fillRect(png, 92, 202 - bounce, 72, 8, [38, 90, 150], 180);
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

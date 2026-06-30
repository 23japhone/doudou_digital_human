import { PNG } from "pngjs";
import { describe, expect, test } from "vitest";
import { createDeterministicStylizedPngAdapter } from "../../src/generation/adapters/deterministic-stylized-png-adapter.js";
import type { NormalizedSourceImage } from "../../src/generation/normalization/source-normalizer.js";
import type { SourceImageInfo } from "../../src/intake/source-image.js";

describe("createDeterministicStylizedPngAdapter", () => {
  test("turns normalized source pixels into a deterministic stylized frame sequence", async () => {
    const adapter = createDeterministicStylizedPngAdapter();
    const normalizedImage = createSplitNormalizedImage();
    const sourceImage: SourceImageInfo = {
      bytes: normalizedImage.bytes.length,
      mime: "image/png",
      width: 256,
      height: 256
    };

    const output = await adapter.generate({ sourceImage, normalizedSourceImage: normalizedImage });

    expect(adapter.requiresNormalizedSourceImage).toBe(true);
    expect(output.adapterId).toBe("deterministic-stylized-png-adapter");
    expect(output.adapterVersion).toBe("0.1.0");
    expect(output.petId).toBe("generated_local_pet");
    expect(output.petName).toBe("Generated Local Pet");
    expect(output.frames.map((frame) => frame.index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(output.previewFrameIndex).toBe(1);
    expect(JSON.stringify(output)).not.toContain("sourceImagePath");
    expect(JSON.stringify(output)).not.toContain("prompt");
    expect(JSON.stringify(output)).not.toContain("rawResponse");

    const preview = PNG.sync.read(output.previewPng);
    expect(preview.width).toBe(256);
    expect(preview.height).toBe(256);
    expect(countRedPixels(preview)).toBeGreaterThan(500);
    expect(countGreenPixels(preview)).toBeGreaterThan(500);

    for (const frame of output.frames) {
      const png = PNG.sync.read(frame.png);
      expect(png.width).toBe(256);
      expect(png.height).toBe(256);
      expect(hasNonTransparentPixel(png)).toBe(true);
    }
    expect(output.frames[0]!.png.equals(output.frames[2]!.png)).toBe(false);
  });

  test("fills the character mask from visible source bounds instead of preserving letterbox padding", async () => {
    const adapter = createDeterministicStylizedPngAdapter();
    const normalizedImage = createLetterboxedNormalizedImage();
    const sourceImage: SourceImageInfo = {
      bytes: normalizedImage.bytes.length,
      mime: "image/png",
      width: 256,
      height: 64
    };

    const output = await adapter.generate({ sourceImage, normalizedSourceImage: normalizedImage });

    const preview = PNG.sync.read(output.previewPng);
    expect(countBluePixels(preview, { minY: 54, maxY: 88 })).toBeGreaterThan(200);
  });
});

function createSplitNormalizedImage(): NormalizedSourceImage {
  const png = new PNG({ width: 256, height: 256 });
  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      const index = (png.width * y + x) << 2;
      if (x < png.width / 2) {
        png.data[index] = 230;
        png.data[index + 1] = 60;
        png.data[index + 2] = 50;
      } else {
        png.data[index] = 50;
        png.data[index + 1] = 210;
        png.data[index + 2] = 90;
      }
      png.data[index + 3] = 255;
    }
  }
  const bytes = PNG.sync.write(png);
  return {
    bytes,
    mime: "image/png",
    width: 256,
    height: 256,
    temporaryPath: "/tmp/not-written-to-bundle.png"
  };
}

function createLetterboxedNormalizedImage(): NormalizedSourceImage {
  const png = new PNG({ width: 256, height: 256 });
  for (let y = 96; y < 160; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      const index = (png.width * y + x) << 2;
      png.data[index] = 40;
      png.data[index + 1] = 120;
      png.data[index + 2] = 230;
      png.data[index + 3] = 255;
    }
  }
  const bytes = PNG.sync.write(png);
  return {
    bytes,
    mime: "image/png",
    width: 256,
    height: 256,
    temporaryPath: "/tmp/not-written-to-bundle.png"
  };
}

function countRedPixels(png: PNG): number {
  let count = 0;
  for (let index = 0; index < png.data.length; index += 4) {
    if (png.data[index + 3] > 0 && png.data[index] > 160 && png.data[index + 1] < 120) {
      count += 1;
    }
  }
  return count;
}

function countGreenPixels(png: PNG): number {
  let count = 0;
  for (let index = 0; index < png.data.length; index += 4) {
    if (png.data[index + 3] > 0 && png.data[index + 1] > 150 && png.data[index] < 130) {
      count += 1;
    }
  }
  return count;
}

function countBluePixels(png: PNG, region: { minY: number; maxY: number }): number {
  let count = 0;
  for (let y = region.minY; y <= region.maxY; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      const index = (png.width * y + x) << 2;
      if (png.data[index + 3] > 0 && png.data[index + 2] > 150 && png.data[index] < 100) {
        count += 1;
      }
    }
  }
  return count;
}

function hasNonTransparentPixel(png: PNG): boolean {
  for (let index = 3; index < png.data.length; index += 4) {
    if (png.data[index] > 0) {
      return true;
    }
  }
  return false;
}

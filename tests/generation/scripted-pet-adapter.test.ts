import { PNG } from "pngjs";
import { describe, expect, test } from "vitest";
import { createScriptedPetAdapter } from "../../src/generation/adapters/scripted-pet-adapter.js";
import type { SourceImageInfo } from "../../src/intake/source-image.js";

describe("createScriptedPetAdapter", () => {
  test("returns a deterministic frame sequence contract for bundle packaging", async () => {
    const adapter = createScriptedPetAdapter();
    const sourceImage: SourceImageInfo = {
      bytes: 2048,
      mime: "image/png",
      width: 64,
      height: 96
    };

    const output = await adapter.generate({ sourceImage });

    expect(output.adapterId).toBe("scripted-pet-adapter");
    expect(output.adapterVersion).toBe("0.1.0");
    expect(output.petId).toBe("generated_local_pet");
    expect(output.petName).toBe("Generated Local Pet");
    expect(output.frames.map((frame) => frame.index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(output.previewFrameIndex).toBe(1);
    expect(JSON.stringify(output)).not.toContain("sourceImagePath");
    expect(JSON.stringify(output)).not.toContain("prompt");
    expect(JSON.stringify(output)).not.toContain("rawResponse");

    for (const frame of output.frames) {
      const png = PNG.sync.read(frame.png);
      expect(png.width).toBe(256);
      expect(png.height).toBe(256);
      expect(hasNonTransparentPixel(png)).toBe(true);
    }
    const preview = PNG.sync.read(output.previewPng);
    expect(preview.width).toBe(256);
    expect(preview.height).toBe(256);
    expect(hasNonTransparentPixel(preview)).toBe(true);
  });
});

function hasNonTransparentPixel(png: PNG): boolean {
  for (let index = 3; index < png.data.length; index += 4) {
    if (png.data[index] > 0) {
      return true;
    }
  }
  return false;
}

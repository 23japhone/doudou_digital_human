import { describe, expect, test } from "vitest";
import type { PetManifest } from "../../src/pet_bundle/manifest.js";
import {
  createRuntimeScreenHitTestResult,
  isScreenPointInsideRuntimeHitArea,
  isPointInsideFallbackRect,
  isPointInsideRuntimeHitArea,
  type CanvasAlphaSampler
} from "../../src/runtime/hit-area.js";

describe("runtime hit area", () => {
  test("uses the rendered alpha channel before the fallback rectangle", () => {
    const sampler = samplerWithAlphaAt(5, 5, 255);

    expect(isPointInsideRuntimeHitArea(5, 5, hitArea(), sampler)).toBe(true);
    expect(isPointInsideRuntimeHitArea(12, 22, hitArea(), sampler)).toBe(false);
  });

  test("falls back to the manifest rectangle when alpha cannot be sampled", () => {
    const unreadableSampler: CanvasAlphaSampler = {
      width: 256,
      height: 256,
      alphaAt: () => null
    };

    expect(isPointInsideRuntimeHitArea(12, 22, hitArea(), unreadableSampler)).toBe(true);
    expect(isPointInsideRuntimeHitArea(100, 100, hitArea(), unreadableSampler)).toBe(false);
  });

  test("treats alpha threshold as a strict lower bound", () => {
    const sampler: CanvasAlphaSampler = {
      width: 256,
      height: 256,
      alphaAt: (x, y) => (x === 4 && y === 4 ? 16 : 17)
    };

    expect(isPointInsideRuntimeHitArea(4.9, 4.1, hitArea(), sampler)).toBe(false);
    expect(isPointInsideRuntimeHitArea(5, 5, hitArea(), sampler)).toBe(true);
  });

  test("maps a screen point into the rendered canvas before alpha hit testing", () => {
    const sampler = samplerWithAlphaAt(128, 116, 255);

    expect(
      isScreenPointInsideRuntimeHitArea({
        canvasClientRect: { x: 12, y: 12, width: 256, height: 256 },
        canvasSize: { width: 256, height: 256 },
        hitArea: hitArea(),
        sampler,
        screenPoint: { x: 240, y: 228 },
        windowOrigin: { x: 100, y: 100 }
      })
    ).toBe(true);
    expect(
      isScreenPointInsideRuntimeHitArea({
        canvasClientRect: { x: 12, y: 12, width: 256, height: 256 },
        canvasSize: { width: 256, height: 256 },
        hitArea: hitArea(),
        sampler,
        screenPoint: { x: 124, y: 136 },
        windowOrigin: { x: 100, y: 100 }
      })
    ).toBe(false);
  });

  test("returns canvas coordinates with a visible screen hit result", () => {
    const sampler = samplerWithAlphaAt(128, 116, 255);

    expect(
      createRuntimeScreenHitTestResult({
        canvasClientRect: { x: 12, y: 12, width: 256, height: 256 },
        canvasSize: { width: 256, height: 256 },
        hitArea: hitArea(),
        sampler,
        screenPoint: { x: 240, y: 228 },
        windowOrigin: { x: 100, y: 100 }
      })
    ).toEqual({
      canvasPoint: { x: 128, y: 116 },
      canvasSize: { width: 256, height: 256 },
      visible: true
    });
  });

  test("keeps fallback rectangle edge behavior compatible with the previous runtime", () => {
    expect(isPointInsideFallbackRect(10, 20, hitArea().fallbackRect)).toBe(true);
    expect(isPointInsideFallbackRect(40, 60, hitArea().fallbackRect)).toBe(true);
    expect(isPointInsideFallbackRect(41, 60, hitArea().fallbackRect)).toBe(false);
  });
});

function hitArea(): PetManifest["hitArea"] {
  return {
    type: "alpha",
    alphaThreshold: 16,
    fallbackRect: { x: 10, y: 20, width: 30, height: 40 }
  };
}

function samplerWithAlphaAt(targetX: number, targetY: number, alpha: number): CanvasAlphaSampler {
  return {
    width: 256,
    height: 256,
    alphaAt: (x, y) => (x === targetX && y === targetY ? alpha : 0)
  };
}

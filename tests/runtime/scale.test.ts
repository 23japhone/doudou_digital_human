import { describe, expect, test } from "vitest";
import {
  RUNTIME_SCALE_LIMITS,
  calculateCenteredScaledWindowBounds,
  calculateScaledWindowSize,
  clampRuntimeScale,
  mapCssPointToCanvasPoint,
  nextRuntimeScale,
  type RuntimeScaleLimits
} from "../../src/runtime/scale.js";

describe("runtime window scaling", () => {
  test("clamps requested scale to the configured lower and upper limits", () => {
    expect(clampRuntimeScale(0.1)).toBe(RUNTIME_SCALE_LIMITS.min);
    expect(clampRuntimeScale(3)).toBe(RUNTIME_SCALE_LIMITS.max);
    expect(clampRuntimeScale(1.234)).toBe(1.23);
  });

  test("falls back to the default scale when the requested scale is invalid", () => {
    expect(clampRuntimeScale(Number.NaN)).toBe(RUNTIME_SCALE_LIMITS.default);
    expect(clampRuntimeScale(Number.POSITIVE_INFINITY)).toBe(RUNTIME_SCALE_LIMITS.default);
  });

  test("steps mouse wheel deltas while respecting scale limits", () => {
    const limits: RuntimeScaleLimits = { min: 0.5, max: 2, step: 0.25, default: 1 };

    expect(nextRuntimeScale(1, -1, limits)).toBe(1.25);
    expect(nextRuntimeScale(1, 1, limits)).toBe(0.75);
    expect(nextRuntimeScale(2, -1, limits)).toBe(2);
    expect(nextRuntimeScale(0.5, 1, limits)).toBe(0.5);
    expect(nextRuntimeScale(1, 0, limits)).toBe(1);
  });

  test("rounds scaled window dimensions to whole screen pixels", () => {
    expect(calculateScaledWindowSize({ width: 257, height: 123 }, 1.25)).toEqual({
      width: 321,
      height: 154
    });
  });

  test("keeps the pet window centered while applying a new scale", () => {
    expect(
      calculateCenteredScaledWindowBounds(
        { x: 100, y: 50, width: 256, height: 256 },
        { width: 256, height: 256 },
        1.5
      )
    ).toEqual({
      x: 36,
      y: -14,
      width: 384,
      height: 384
    });
  });

  test("maps scaled CSS pointer coordinates back to manifest canvas coordinates", () => {
    expect(
      mapCssPointToCanvasPoint(
        { x: 192, y: 96 },
        { width: 512, height: 384 },
        { width: 256, height: 256 }
      )
    ).toEqual({ x: 96, y: 64 });
  });

  test("keeps pointer coordinates unchanged when the CSS box has not been measured", () => {
    expect(
      mapCssPointToCanvasPoint(
        { x: 12, y: 34 },
        { width: 0, height: 0 },
        { width: 256, height: 256 }
      )
    ).toEqual({ x: 12, y: 34 });
  });
});

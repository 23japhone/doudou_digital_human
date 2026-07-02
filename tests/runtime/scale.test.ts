import { describe, expect, test } from "vitest";
import {
  RUNTIME_FRAME_PADDING,
  RUNTIME_SCALE_LIMITS,
  calculateCenteredScaledWindowBounds,
  calculateCenteredFramedWindowBounds,
  calculateDraggedRuntimeScale,
  calculateFramedWindowSize,
  calculateRuntimeScaleFromFramedWindowSize,
  calculateScaledWindowSize,
  clampRuntimeScale,
  createRuntimeScaleDragSession,
  isPointInRuntimeFrame,
  isPointInRuntimeResizeZone,
  mapCssPointToCanvasPoint,
  nextRuntimeScale,
  shouldShowRuntimeFrameAffordance,
  type RuntimeScaleLimits
} from "../../src/runtime/scale.js";

describe("runtime window scaling", () => {
  test("clamps requested scale to the configured lower and upper limits", () => {
    expect(clampRuntimeScale(0.1)).toBe(RUNTIME_SCALE_LIMITS.min);
    expect(clampRuntimeScale(3)).toBe(RUNTIME_SCALE_LIMITS.max);
    expect(clampRuntimeScale(1.2345)).toBe(1.2345);
  });

  test("falls back to the default scale when the requested scale is invalid", () => {
    expect(clampRuntimeScale(Number.NaN)).toBe(RUNTIME_SCALE_LIMITS.default);
    expect(clampRuntimeScale(Number.POSITIVE_INFINITY)).toBe(RUNTIME_SCALE_LIMITS.default);
  });

  test("maps mouse wheel delta magnitude to continuous scale changes", () => {
    const limits: RuntimeScaleLimits = { min: 0.5, max: 2, default: 1, wheelSensitivity: 0.001, dragSensitivity: 0.005 };

    expect(nextRuntimeScale(1, -10, limits)).toBeCloseTo(1.0101, 4);
    expect(nextRuntimeScale(1, -60, limits)).toBeCloseTo(1.0618, 4);
    expect(nextRuntimeScale(1, 60, limits)).toBeCloseTo(0.9418, 4);
    expect(nextRuntimeScale(2, -60, limits)).toBe(2);
    expect(nextRuntimeScale(0.5, 60, limits)).toBe(0.5);
    expect(nextRuntimeScale(1, 0, limits)).toBe(1);
  });

  test("normalizes wheel line deltas before calculating continuous scale", () => {
    const limits: RuntimeScaleLimits = { min: 0.5, max: 2, default: 1, wheelSensitivity: 0.001, dragSensitivity: 0.005 };

    expect(nextRuntimeScale(1, -3, limits, 1)).toBeCloseTo(1.0492, 4);
  });

  test("maps outward frame resize drag to larger scale and inward drag to smaller scale", () => {
    const limits: RuntimeScaleLimits = { min: 0.5, max: 2, default: 1, wheelSensitivity: 0.001, dragSensitivity: 0.005 };
    const session = createRuntimeScaleDragSession({
      pointer: { x: 220, y: 220 },
      origin: { x: 128, y: 128 },
      scale: 1
    }, limits);

    expect(calculateDraggedRuntimeScale(session, { x: 240, y: 240 }, limits)).toBeGreaterThan(1);
    expect(calculateDraggedRuntimeScale(session, { x: 180, y: 180 }, limits)).toBeLessThan(1);
  });

  test("click-drag scaling clamps to configured limits and ignores invalid pointers", () => {
    const limits: RuntimeScaleLimits = { min: 0.5, max: 2, default: 1, wheelSensitivity: 0.001, dragSensitivity: 0.05 };
    const session = createRuntimeScaleDragSession({
      pointer: { x: 220, y: 220 },
      origin: { x: 128, y: 128 },
      scale: 1.5
    }, limits);

    expect(calculateDraggedRuntimeScale(session, { x: 400, y: 400 }, limits)).toBe(2);
    expect(calculateDraggedRuntimeScale(session, { x: 80, y: Number.NaN }, limits)).toBeNull();
  });

  test("adds an interaction frame around the scaled pet canvas", () => {
    expect(calculateFramedWindowSize({ width: 256, height: 128 }, 1.25)).toEqual({
      width: 320 + RUNTIME_FRAME_PADDING * 2,
      height: 160 + RUNTIME_FRAME_PADDING * 2
    });
    expect(calculateRuntimeScaleFromFramedWindowSize({ width: 320 + RUNTIME_FRAME_PADDING * 2, height: 160 }, { width: 256, height: 128 })).toBe(1.25);
  });

  test("keeps the framed pet window centered while applying a new scale", () => {
    expect(
      calculateCenteredFramedWindowBounds(
        { x: 100, y: 50, width: 280, height: 280 },
        { width: 256, height: 256 },
        1.5
      )
    ).toEqual({
      x: 36,
      y: -14,
      width: 384 + RUNTIME_FRAME_PADDING * 2,
      height: 384 + RUNTIME_FRAME_PADDING * 2
    });
  });

  test("recognizes frame movement and edge resize hit areas", () => {
    const frame = { width: 280, height: 280 };

    expect(isPointInRuntimeFrame({ x: 8, y: 8 }, frame)).toBe(true);
    expect(isPointInRuntimeFrame({ x: 281, y: 8 }, frame)).toBe(false);
    expect(isPointInRuntimeResizeZone({ x: 264, y: 264 }, frame)).toBe(true);
    expect(isPointInRuntimeResizeZone({ x: 16, y: 16 }, frame)).toBe(true);
    expect(isPointInRuntimeResizeZone({ x: 140, y: 16 }, frame)).toBe(true);
    expect(isPointInRuntimeResizeZone({ x: 264, y: 140 }, frame)).toBe(true);
    expect(isPointInRuntimeResizeZone({ x: 140, y: 140 }, frame)).toBe(false);
  });

  test("shows the resize frame affordance only near resize edges or while resizing", () => {
    const frame = { width: 280, height: 280 };

    expect(shouldShowRuntimeFrameAffordance({ x: 140, y: 140 }, frame, false)).toBe(false);
    expect(shouldShowRuntimeFrameAffordance({ x: 264, y: 264 }, frame, false)).toBe(true);
    expect(shouldShowRuntimeFrameAffordance({ x: 140, y: 140 }, frame, true)).toBe(true);
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

import { describe, expect, test } from "vitest";
import {
  RUNTIME_CURSOR_FOLLOW_CONFIG,
  calculateCursorFollowStep,
  createSmokeCursorFollowPoint,
  isCursorInsideRuntimeMotionActivationArea,
  type RuntimeMotionDirection,
  type RuntimeMotionRect
} from "../../src/runtime/motion.js";

describe("runtime cursor-follow motion", () => {
  const workArea: RuntimeMotionRect = { x: 0, y: 0, width: 1440, height: 900 };
  const windowBounds: RuntimeMotionRect = { x: 100, y: 100, width: 280, height: 280 };

  test("moves the window toward the offset cursor target", () => {
    const step = calculateCursorFollowStep({
      cursor: { x: 760, y: 360 },
      deltaMs: 33,
      windowBounds,
      workArea,
      config: {
        ...RUNTIME_CURSOR_FOLLOW_CONFIG,
        maxSpeedPixelsPerSecond: 600
      }
    });

    expect(step.state).toBe("following");
    expect(step.moved).toBe(true);
    expect(step.direction).toBe<RuntimeMotionDirection>("right");
    expect(step.motionIntensity).toBeGreaterThan(0);
    expect(step.nextBounds.x).toBeGreaterThan(windowBounds.x);
    expect(step.nextBounds.y).toBeGreaterThan(windowBounds.y);
    expect(step.distanceToTarget).toBeGreaterThan(100);
  });

  test("reports the dominant vertical approach direction", () => {
    const step = calculateCursorFollowStep({
      cursor: {
        x: windowBounds.x + windowBounds.width / 2 - RUNTIME_CURSOR_FOLLOW_CONFIG.targetOffset.x,
        y: windowBounds.y + windowBounds.height / 2 - RUNTIME_CURSOR_FOLLOW_CONFIG.targetOffset.y - 260
      },
      deltaMs: 33,
      windowBounds,
      workArea
    });

    expect(step.direction).toBe<RuntimeMotionDirection>("up");
  });

  test("uses an easing curve that takes larger steps when farther away", () => {
    const nearStep = calculateCursorFollowStep({
      cursor: {
        x: windowBounds.x + windowBounds.width / 2 - RUNTIME_CURSOR_FOLLOW_CONFIG.targetOffset.x + 80,
        y: windowBounds.y + windowBounds.height / 2 - RUNTIME_CURSOR_FOLLOW_CONFIG.targetOffset.y
      },
      deltaMs: 33,
      windowBounds,
      workArea,
      config: {
        ...RUNTIME_CURSOR_FOLLOW_CONFIG,
        maxSpeedPixelsPerSecond: 2000
      }
    });
    const farStep = calculateCursorFollowStep({
      cursor: {
        x: windowBounds.x + windowBounds.width / 2 - RUNTIME_CURSOR_FOLLOW_CONFIG.targetOffset.x + 480,
        y: windowBounds.y + windowBounds.height / 2 - RUNTIME_CURSOR_FOLLOW_CONFIG.targetOffset.y
      },
      deltaMs: 33,
      windowBounds,
      workArea,
      config: {
        ...RUNTIME_CURSOR_FOLLOW_CONFIG,
        maxSpeedPixelsPerSecond: 2000
      }
    });

    expect(farStep.stepDistance).toBeGreaterThan(nearStep.stepDistance);
    expect(farStep.easingProgress).toBeGreaterThan(0);
    expect(farStep.easingProgress).toBeLessThan(1);
    expect(farStep.motionIntensity).toBeGreaterThan(nearStep.motionIntensity);
  });

  test("settles when the pet is already close to the cursor target", () => {
    const step = calculateCursorFollowStep({
      cursor: {
        x: windowBounds.x + windowBounds.width / 2 - RUNTIME_CURSOR_FOLLOW_CONFIG.targetOffset.x + 3,
        y: windowBounds.y + windowBounds.height / 2 - RUNTIME_CURSOR_FOLLOW_CONFIG.targetOffset.y - 2
      },
      deltaMs: 33,
      windowBounds,
      workArea
    });

    expect(step.state).toBe("settled");
    expect(step.moved).toBe(false);
    expect(step.direction).toBe("none");
    expect(step.motionIntensity).toBe(0);
    expect(step.nextBounds).toEqual(windowBounds);
  });

  test("activates cursor-follow motion only while the cursor is inside the pet window", () => {
    expect(isCursorInsideRuntimeMotionActivationArea({ x: 120, y: 140 }, windowBounds)).toBe(true);
    expect(isCursorInsideRuntimeMotionActivationArea({ x: 379, y: 379 }, windowBounds)).toBe(true);
    expect(isCursorInsideRuntimeMotionActivationArea({ x: 99, y: 140 }, windowBounds)).toBe(false);
    expect(isCursorInsideRuntimeMotionActivationArea({ x: 380, y: 140 }, windowBounds)).toBe(false);
    expect(isCursorInsideRuntimeMotionActivationArea({ x: 120, y: 380 }, windowBounds)).toBe(false);
    expect(isCursorInsideRuntimeMotionActivationArea({ x: 120, y: 381 }, windowBounds)).toBe(false);
  });

  test("does not overshoot the target when the frame delta is large", () => {
    const targetCursor = {
      x: windowBounds.x + windowBounds.width / 2 - RUNTIME_CURSOR_FOLLOW_CONFIG.targetOffset.x + 36,
      y: windowBounds.y + windowBounds.height / 2 - RUNTIME_CURSOR_FOLLOW_CONFIG.targetOffset.y
    };

    const step = calculateCursorFollowStep({
      cursor: targetCursor,
      deltaMs: 1000,
      windowBounds,
      workArea
    });

    expect(step.nextBounds.x).toBe(windowBounds.x + 36);
    expect(step.nextBounds.y).toBe(windowBounds.y);
  });

  test("keeps the pet window inside the display work area", () => {
    const step = calculateCursorFollowStep({
      cursor: { x: -100, y: -100 },
      deltaMs: 1000,
      windowBounds: { x: 12, y: 18, width: 280, height: 280 },
      workArea
    });

    expect(step.nextBounds.x).toBeGreaterThanOrEqual(workArea.x);
    expect(step.nextBounds.y).toBeGreaterThanOrEqual(workArea.y);
  });

  test("creates a deterministic smoke cursor near the current window center", () => {
    const smokeCursor = createSmokeCursorFollowPoint(windowBounds);
    expect(smokeCursor).toEqual({
      x: windowBounds.x + windowBounds.width / 2,
      y: windowBounds.y + windowBounds.height / 2
    });
    expect(isCursorInsideRuntimeMotionActivationArea(smokeCursor, windowBounds)).toBe(true);
    const step = calculateCursorFollowStep({
      cursor: smokeCursor,
      deltaMs: 33,
      windowBounds,
      workArea
    });

    expect(step.state).toBe("following");
    expect(step.moved).toBe(true);
  });
});

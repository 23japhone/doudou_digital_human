import { describe, expect, test } from "vitest";
import {
  RUNTIME_CURSOR_FOLLOW_CONFIG,
  calculateCursorFollowStep,
  createSmokeCursorFollowPoint,
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
    expect(step.nextBounds.x).toBeGreaterThan(windowBounds.x);
    expect(step.nextBounds.y).toBeGreaterThan(windowBounds.y);
    expect(step.distanceToTarget).toBeGreaterThan(100);
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
    expect(step.nextBounds).toEqual(windowBounds);
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

  test("creates a deterministic smoke cursor away from the current window center", () => {
    const smokeCursor = createSmokeCursorFollowPoint(windowBounds);
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

import { describe, expect, test } from "vitest";
import {
  calculateDraggedWindowPosition,
  createWindowDragSession,
  type ScreenPoint,
  type WindowPosition
} from "../../src/runtime/drag.js";

describe("runtime window dragging", () => {
  test("keeps the pointer anchored to the same point inside the pet window", () => {
    const session = createWindowDragSession({
      pointer: point(420, 320),
      windowPosition: position(300, 200)
    });

    expect(calculateDraggedWindowPosition(session, point(450, 360))).toEqual(position(330, 240));
    expect(calculateDraggedWindowPosition(session, point(390, 280))).toEqual(position(270, 160));
  });

  test("rounds fractional screen coordinates to integer window positions", () => {
    const session = createWindowDragSession({
      pointer: point(20.2, 30.2),
      windowPosition: position(10, 10)
    });

    expect(calculateDraggedWindowPosition(session, point(25.8, 35.7))).toEqual(position(16, 16));
  });

  test("ignores invalid drag coordinates", () => {
    const session = createWindowDragSession({
      pointer: point(100, 100),
      windowPosition: position(30, 40)
    });

    expect(calculateDraggedWindowPosition(session, point(Number.NaN, 140))).toBeNull();
    expect(calculateDraggedWindowPosition(session, point(120, Number.POSITIVE_INFINITY))).toBeNull();
  });
});

function point(x: number, y: number): ScreenPoint {
  return { x, y };
}

function position(x: number, y: number): WindowPosition {
  return { x, y };
}

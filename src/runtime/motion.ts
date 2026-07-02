export interface RuntimeMotionPoint {
  x: number;
  y: number;
}

export interface RuntimeMotionRect extends RuntimeMotionPoint {
  width: number;
  height: number;
}

export interface RuntimeCursorFollowConfig {
  targetOffset: RuntimeMotionPoint;
  settleDistance: number;
  maxSpeedPixelsPerSecond: number;
  minStepPixels: number;
}

export type RuntimeMotionState = "following" | "settled";

export interface RuntimeCursorFollowInput {
  cursor: RuntimeMotionPoint;
  deltaMs: number;
  windowBounds: RuntimeMotionRect;
  workArea: RuntimeMotionRect;
  config?: RuntimeCursorFollowConfig;
}

export interface RuntimeCursorFollowStep {
  state: RuntimeMotionState;
  nextBounds: RuntimeMotionRect;
  targetCenter: RuntimeMotionPoint;
  distanceToTarget: number;
  moved: boolean;
}

export const RUNTIME_CURSOR_FOLLOW_CONFIG: RuntimeCursorFollowConfig = {
  targetOffset: { x: -84, y: 72 },
  settleDistance: 10,
  maxSpeedPixelsPerSecond: 760,
  minStepPixels: 1
};

export function calculateCursorFollowStep(input: RuntimeCursorFollowInput): RuntimeCursorFollowStep {
  const config = input.config ?? RUNTIME_CURSOR_FOLLOW_CONFIG;
  const safeWindowBounds = sanitizeRect(input.windowBounds);
  const safeWorkArea = sanitizeRect(input.workArea);
  const currentCenter = rectCenter(safeWindowBounds);
  const targetCenter = clampCenterToWorkArea(
    {
      x: input.cursor.x + config.targetOffset.x,
      y: input.cursor.y + config.targetOffset.y
    },
    safeWindowBounds,
    safeWorkArea
  );
  const distanceToTarget = distanceBetween(currentCenter, targetCenter);

  if (!Number.isFinite(distanceToTarget) || distanceToTarget <= config.settleDistance) {
    return {
      state: "settled",
      nextBounds: safeWindowBounds,
      targetCenter,
      distanceToTarget: Number.isFinite(distanceToTarget) ? distanceToTarget : 0,
      moved: false
    };
  }

  const deltaSeconds = Math.max(0, input.deltaMs) / 1000;
  const maxStep = Math.max(config.minStepPixels, config.maxSpeedPixelsPerSecond * deltaSeconds);
  const stepDistance = Math.min(distanceToTarget, maxStep);
  const ratio = stepDistance / distanceToTarget;
  const nextCenter = {
    x: currentCenter.x + (targetCenter.x - currentCenter.x) * ratio,
    y: currentCenter.y + (targetCenter.y - currentCenter.y) * ratio
  };
  const unclampedNextBounds = rectFromCenter(nextCenter, safeWindowBounds);
  const nextBounds = clampRectToWorkArea(unclampedNextBounds, safeWorkArea);
  const roundedNextBounds = {
    x: Math.round(nextBounds.x),
    y: Math.round(nextBounds.y),
    width: safeWindowBounds.width,
    height: safeWindowBounds.height
  };
  const moved = roundedNextBounds.x !== safeWindowBounds.x || roundedNextBounds.y !== safeWindowBounds.y;

  return {
    state: moved ? "following" : "settled",
    nextBounds: roundedNextBounds,
    targetCenter,
    distanceToTarget,
    moved
  };
}

export function createSmokeCursorFollowPoint(windowBounds: RuntimeMotionRect): RuntimeMotionPoint {
  const currentCenter = rectCenter(sanitizeRect(windowBounds));
  return {
    x: currentCenter.x + 260 - RUNTIME_CURSOR_FOLLOW_CONFIG.targetOffset.x,
    y: currentCenter.y + 110 - RUNTIME_CURSOR_FOLLOW_CONFIG.targetOffset.y
  };
}

function rectCenter(rect: RuntimeMotionRect): RuntimeMotionPoint {
  return {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2
  };
}

function rectFromCenter(center: RuntimeMotionPoint, basis: RuntimeMotionRect): RuntimeMotionRect {
  return {
    x: center.x - basis.width / 2,
    y: center.y - basis.height / 2,
    width: basis.width,
    height: basis.height
  };
}

function distanceBetween(a: RuntimeMotionPoint, b: RuntimeMotionPoint): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function clampCenterToWorkArea(
  center: RuntimeMotionPoint,
  windowBounds: RuntimeMotionRect,
  workArea: RuntimeMotionRect
): RuntimeMotionPoint {
  return rectCenter(clampRectToWorkArea(rectFromCenter(center, windowBounds), workArea));
}

function clampRectToWorkArea(rect: RuntimeMotionRect, workArea: RuntimeMotionRect): RuntimeMotionRect {
  const maxX = workArea.x + Math.max(0, workArea.width - rect.width);
  const maxY = workArea.y + Math.max(0, workArea.height - rect.height);
  return {
    x: clamp(rect.x, workArea.x, maxX),
    y: clamp(rect.y, workArea.y, maxY),
    width: rect.width,
    height: rect.height
  };
}

function clamp(value: number, min: number, max: number): number {
  if (max < min) {
    return min;
  }
  return Math.min(max, Math.max(min, value));
}

function sanitizeRect(rect: RuntimeMotionRect): RuntimeMotionRect {
  return {
    x: Number.isFinite(rect.x) ? rect.x : 0,
    y: Number.isFinite(rect.y) ? rect.y : 0,
    width: Number.isFinite(rect.width) && rect.width > 0 ? rect.width : 1,
    height: Number.isFinite(rect.height) && rect.height > 0 ? rect.height : 1
  };
}

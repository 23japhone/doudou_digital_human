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
  easingResponsiveness: number;
  intensityDistance: number;
}

export interface RuntimeCursorDodgeConfig extends RuntimeCursorFollowConfig {
  dodgeDistance: number;
}

export type RuntimeMotionState = "following" | "settled";
export type RuntimeMotionDirection = "left" | "right" | "up" | "down" | "none";

export interface RuntimeCursorFollowInput {
  cursor: RuntimeMotionPoint;
  deltaMs: number;
  windowBounds: RuntimeMotionRect;
  workArea: RuntimeMotionRect;
  config?: RuntimeCursorFollowConfig;
}

export interface RuntimeCursorFollowStep {
  direction: RuntimeMotionDirection;
  easingProgress: number;
  state: RuntimeMotionState;
  nextBounds: RuntimeMotionRect;
  targetCenter: RuntimeMotionPoint;
  distanceToTarget: number;
  motionIntensity: number;
  moved: boolean;
  stepDistance: number;
}

export const RUNTIME_CURSOR_FOLLOW_CONFIG: RuntimeCursorFollowConfig = {
  targetOffset: { x: -84, y: 72 },
  settleDistance: 10,
  maxSpeedPixelsPerSecond: 760,
  minStepPixels: 1,
  easingResponsiveness: 8,
  intensityDistance: 360
};

export const RUNTIME_CURSOR_DODGE_CONFIG: RuntimeCursorDodgeConfig = {
  ...RUNTIME_CURSOR_FOLLOW_CONFIG,
  dodgeDistance: 128,
  maxSpeedPixelsPerSecond: 920,
  targetOffset: { x: 0, y: 0 }
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
  const direction = motionDirection(currentCenter, targetCenter);

  if (!Number.isFinite(distanceToTarget) || distanceToTarget <= config.settleDistance) {
    return {
      direction: "none",
      easingProgress: 0,
      state: "settled",
      nextBounds: safeWindowBounds,
      targetCenter,
      distanceToTarget: Number.isFinite(distanceToTarget) ? distanceToTarget : 0,
      motionIntensity: 0,
      moved: false,
      stepDistance: 0
    };
  }

  const deltaSeconds = Math.max(0, input.deltaMs) / 1000;
  const easingProgress = clamp(1 - Math.exp(-Math.max(0.1, config.easingResponsiveness) * deltaSeconds), 0, 0.999);
  const easedStep = distanceToTarget * easingProgress;
  const maxStep = Math.max(config.minStepPixels, config.maxSpeedPixelsPerSecond * deltaSeconds);
  const stepDistance = Math.min(distanceToTarget, Math.max(config.minStepPixels, Math.min(easedStep, maxStep)));
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
    direction,
    easingProgress,
    state: moved ? "following" : "settled",
    nextBounds: roundedNextBounds,
    targetCenter,
    distanceToTarget,
    motionIntensity: clamp(distanceToTarget / Math.max(1, config.intensityDistance), 0, 1),
    moved,
    stepDistance
  };
}

export function createSmokeCursorFollowPoint(windowBounds: RuntimeMotionRect): RuntimeMotionPoint {
  const safeBounds = sanitizeRect(windowBounds);
  return {
    x: safeBounds.x + safeBounds.width / 2,
    y: safeBounds.y + safeBounds.height / 2
  };
}

export function calculateCursorDodgeStep(
  input: RuntimeCursorFollowInput & { config?: RuntimeCursorDodgeConfig }
): RuntimeCursorFollowStep {
  const config = input.config ?? RUNTIME_CURSOR_DODGE_CONFIG;
  const safeWindowBounds = sanitizeRect(input.windowBounds);
  const currentCenter = rectCenter(safeWindowBounds);
  const away = awayVectorFromCursor(input.cursor, currentCenter);
  const targetCenter = {
    x: currentCenter.x + away.x * Math.max(1, config.dodgeDistance),
    y: currentCenter.y + away.y * Math.max(1, config.dodgeDistance)
  };
  return calculateCursorFollowStep({
    ...input,
    config,
    cursor: targetCenter
  });
}

export function isCursorInsideRuntimeMotionActivationArea(
  cursor: RuntimeMotionPoint,
  windowBounds: RuntimeMotionRect
): boolean {
  const safeBounds = sanitizeRect(windowBounds);
  return (
    Number.isFinite(cursor.x) &&
    Number.isFinite(cursor.y) &&
    cursor.x >= safeBounds.x &&
    cursor.y >= safeBounds.y &&
    cursor.x < safeBounds.x + safeBounds.width &&
    cursor.y < safeBounds.y + safeBounds.height
  );
}

function awayVectorFromCursor(cursor: RuntimeMotionPoint, currentCenter: RuntimeMotionPoint): RuntimeMotionPoint {
  const dx = currentCenter.x - cursor.x;
  const dy = currentCenter.y - cursor.y;
  const distance = Math.hypot(dx, dy);
  if (!Number.isFinite(distance) || distance < 1) {
    return { x: -0.94, y: -0.34 };
  }
  return {
    x: dx / distance,
    y: dy / distance
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

function motionDirection(from: RuntimeMotionPoint, to: RuntimeMotionPoint): RuntimeMotionDirection {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) < 1 && Math.abs(dy) < 1) {
    return "none";
  }
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? "right" : "left";
  }
  return dy >= 0 ? "down" : "up";
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

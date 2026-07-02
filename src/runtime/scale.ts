export interface RuntimeScaleLimits {
  min: number;
  max: number;
  step: number;
  default: number;
}

export interface RuntimeCanvasSize {
  width: number;
  height: number;
}

export interface RuntimeWindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RuntimePoint {
  x: number;
  y: number;
}

export const RUNTIME_SCALE_LIMITS: RuntimeScaleLimits = {
  min: 0.5,
  max: 2,
  step: 0.1,
  default: 1
};

export function clampRuntimeScale(
  requestedScale: number,
  limits: RuntimeScaleLimits = RUNTIME_SCALE_LIMITS
): number {
  if (!Number.isFinite(requestedScale)) {
    return limits.default;
  }
  return roundScale(Math.min(limits.max, Math.max(limits.min, requestedScale)));
}

export function nextRuntimeScale(
  currentScale: number,
  wheelDeltaY: number,
  limits: RuntimeScaleLimits = RUNTIME_SCALE_LIMITS
): number {
  if (wheelDeltaY === 0) {
    return clampRuntimeScale(currentScale, limits);
  }
  const direction = wheelDeltaY < 0 ? 1 : -1;
  return clampRuntimeScale(currentScale + direction * limits.step, limits);
}

export function calculateScaledWindowSize(
  canvas: RuntimeCanvasSize,
  requestedScale: number,
  limits: RuntimeScaleLimits = RUNTIME_SCALE_LIMITS
): RuntimeCanvasSize {
  const scale = clampRuntimeScale(requestedScale, limits);
  return {
    width: Math.max(1, Math.round(canvas.width * scale)),
    height: Math.max(1, Math.round(canvas.height * scale))
  };
}

export function calculateCenteredScaledWindowBounds(
  currentBounds: RuntimeWindowBounds,
  canvas: RuntimeCanvasSize,
  requestedScale: number,
  limits: RuntimeScaleLimits = RUNTIME_SCALE_LIMITS
): RuntimeWindowBounds {
  const size = calculateScaledWindowSize(canvas, requestedScale, limits);
  const centerX = currentBounds.x + currentBounds.width / 2;
  const centerY = currentBounds.y + currentBounds.height / 2;
  return {
    x: Math.round(centerX - size.width / 2),
    y: Math.round(centerY - size.height / 2),
    width: size.width,
    height: size.height
  };
}

export function mapCssPointToCanvasPoint(
  point: RuntimePoint,
  cssBox: RuntimeCanvasSize,
  canvas: RuntimeCanvasSize
): RuntimePoint {
  if (cssBox.width <= 0 || cssBox.height <= 0) {
    return point;
  }
  return {
    x: (point.x * canvas.width) / cssBox.width,
    y: (point.y * canvas.height) / cssBox.height
  };
}

function roundScale(scale: number): number {
  return Math.round(scale * 100) / 100;
}

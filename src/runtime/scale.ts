export interface RuntimeScaleLimits {
  min: number;
  max: number;
  default: number;
  wheelSensitivity: number;
  dragSensitivity: number;
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

export interface RuntimeScaleDragSession {
  pointerStart: RuntimePoint;
  scaleStart: number;
}

export const RUNTIME_SCALE_LIMITS: RuntimeScaleLimits = {
  min: 0.5,
  max: 2,
  default: 1,
  wheelSensitivity: 0.001,
  dragSensitivity: 0.005
};

const WHEEL_LINE_PIXEL_HEIGHT = 16;
const WHEEL_PAGE_PIXEL_HEIGHT = 256;
const SCALE_DRAG_ZONE_START_RATIO = 0.68;

export function clampRuntimeScale(
  requestedScale: number,
  limits: RuntimeScaleLimits = RUNTIME_SCALE_LIMITS
): number {
  if (!Number.isFinite(requestedScale)) {
    return limits.default;
  }
  return Math.min(limits.max, Math.max(limits.min, requestedScale));
}

export function nextRuntimeScale(
  currentScale: number,
  wheelDeltaY: number,
  limits: RuntimeScaleLimits = RUNTIME_SCALE_LIMITS,
  wheelDeltaMode = 0
): number {
  if (wheelDeltaY === 0) {
    return clampRuntimeScale(currentScale, limits);
  }
  const normalizedDeltaY = normalizeWheelDeltaY(wheelDeltaY, wheelDeltaMode);
  return clampRuntimeScale(currentScale * Math.exp(-normalizedDeltaY * limits.wheelSensitivity), limits);
}

export function createRuntimeScaleDragSession(
  start: { pointer: RuntimePoint; scale: number },
  limits: RuntimeScaleLimits = RUNTIME_SCALE_LIMITS
): RuntimeScaleDragSession {
  return {
    pointerStart: start.pointer,
    scaleStart: clampRuntimeScale(start.scale, limits)
  };
}

export function calculateDraggedRuntimeScale(
  session: RuntimeScaleDragSession,
  pointer: RuntimePoint,
  limits: RuntimeScaleLimits = RUNTIME_SCALE_LIMITS
): number | null {
  if (!isFinitePoint(pointer) || !isFinitePoint(session.pointerStart)) {
    return null;
  }
  const dragDeltaY = session.pointerStart.y - pointer.y;
  return clampRuntimeScale(session.scaleStart * Math.exp(dragDeltaY * limits.dragSensitivity), limits);
}

export function isPointInRuntimeScaleDragZone(point: RuntimePoint, canvas: RuntimeCanvasSize): boolean {
  if (!isFinitePoint(point) || canvas.width <= 0 || canvas.height <= 0) {
    return false;
  }
  return point.x >= canvas.width * SCALE_DRAG_ZONE_START_RATIO && point.y >= canvas.height * SCALE_DRAG_ZONE_START_RATIO;
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

function normalizeWheelDeltaY(deltaY: number, deltaMode: number): number {
  if (!Number.isFinite(deltaY)) {
    return 0;
  }
  if (deltaMode === 1) {
    return deltaY * WHEEL_LINE_PIXEL_HEIGHT;
  }
  if (deltaMode === 2) {
    return deltaY * WHEEL_PAGE_PIXEL_HEIGHT;
  }
  return deltaY;
}

function isFinitePoint(point: RuntimePoint): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y);
}

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
  origin: RuntimePoint;
  pointerStart: RuntimePoint;
  startDistance: number;
  scaleStart: number;
}

export const RUNTIME_FRAME_PADDING = 12;
export const RUNTIME_FRAME_RESIZE_HANDLE_SIZE = 32;

export const RUNTIME_SCALE_LIMITS: RuntimeScaleLimits = {
  min: 0.5,
  max: 2,
  default: 1,
  wheelSensitivity: 0.001,
  dragSensitivity: 0.005
};

const WHEEL_LINE_PIXEL_HEIGHT = 16;
const WHEEL_PAGE_PIXEL_HEIGHT = 256;

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
  start: { origin: RuntimePoint; pointer: RuntimePoint; scale: number },
  limits: RuntimeScaleLimits = RUNTIME_SCALE_LIMITS
): RuntimeScaleDragSession {
  return {
    origin: start.origin,
    pointerStart: start.pointer,
    startDistance: distanceBetween(start.pointer, start.origin),
    scaleStart: clampRuntimeScale(start.scale, limits)
  };
}

export function calculateDraggedRuntimeScale(
  session: RuntimeScaleDragSession,
  pointer: RuntimePoint,
  limits: RuntimeScaleLimits = RUNTIME_SCALE_LIMITS
): number | null {
  if (!isFinitePoint(pointer) || !isFinitePoint(session.origin) || !Number.isFinite(session.startDistance)) {
    return null;
  }
  const distanceDelta = distanceBetween(pointer, session.origin) - session.startDistance;
  return clampRuntimeScale(session.scaleStart * Math.exp(distanceDelta * limits.dragSensitivity), limits);
}

export function calculateFramedWindowSize(
  canvas: RuntimeCanvasSize,
  requestedScale: number,
  limits: RuntimeScaleLimits = RUNTIME_SCALE_LIMITS
): RuntimeCanvasSize {
  const petSize = calculateScaledWindowSize(canvas, requestedScale, limits);
  return {
    width: petSize.width + RUNTIME_FRAME_PADDING * 2,
    height: petSize.height + RUNTIME_FRAME_PADDING * 2
  };
}

export function calculateCenteredFramedWindowBounds(
  currentBounds: RuntimeWindowBounds,
  canvas: RuntimeCanvasSize,
  requestedScale: number,
  limits: RuntimeScaleLimits = RUNTIME_SCALE_LIMITS
): RuntimeWindowBounds {
  const size = calculateFramedWindowSize(canvas, requestedScale, limits);
  const centerX = currentBounds.x + currentBounds.width / 2;
  const centerY = currentBounds.y + currentBounds.height / 2;
  return {
    x: Math.round(centerX - size.width / 2),
    y: Math.round(centerY - size.height / 2),
    width: size.width,
    height: size.height
  };
}

export function calculateRuntimeScaleFromFramedWindowSize(
  frame: RuntimeCanvasSize,
  canvas: RuntimeCanvasSize,
  limits: RuntimeScaleLimits = RUNTIME_SCALE_LIMITS
): number {
  return clampRuntimeScale((frame.width - RUNTIME_FRAME_PADDING * 2) / canvas.width, limits);
}

export function isPointInRuntimeFrame(point: RuntimePoint, frame: RuntimeCanvasSize): boolean {
  if (!isFinitePoint(point) || frame.width <= 0 || frame.height <= 0) {
    return false;
  }
  return point.x >= 0 && point.y >= 0 && point.x < frame.width && point.y < frame.height;
}

export function isPointInRuntimeResizeZone(point: RuntimePoint, frame: RuntimeCanvasSize): boolean {
  if (!isPointInRuntimeFrame(point, frame)) {
    return false;
  }
  const handleSize = Math.min(RUNTIME_FRAME_RESIZE_HANDLE_SIZE, frame.width / 2, frame.height / 2);
  const inHorizontalHandle = point.x <= handleSize || point.x >= frame.width - handleSize;
  const inVerticalHandle = point.y <= handleSize || point.y >= frame.height - handleSize;
  return inHorizontalHandle && inVerticalHandle;
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

function distanceBetween(point: RuntimePoint, origin: RuntimePoint): number {
  if (!isFinitePoint(point) || !isFinitePoint(origin)) {
    return Number.NaN;
  }
  return Math.hypot(point.x - origin.x, point.y - origin.y);
}

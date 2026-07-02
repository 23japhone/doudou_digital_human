export interface ScreenPoint {
  x: number;
  y: number;
}

export interface WindowPosition {
  x: number;
  y: number;
}

export interface WindowDragSession {
  pointerStart: ScreenPoint;
  windowStart: WindowPosition;
}

export function createWindowDragSession(options: {
  pointer: ScreenPoint;
  windowPosition: WindowPosition;
}): WindowDragSession {
  return {
    pointerStart: options.pointer,
    windowStart: options.windowPosition
  };
}

export function calculateDraggedWindowPosition(
  session: WindowDragSession,
  pointer: ScreenPoint
): WindowPosition | null {
  if (!isFinitePoint(pointer) || !isFinitePoint(session.pointerStart) || !isFinitePoint(session.windowStart)) {
    return null;
  }
  return {
    x: Math.round(session.windowStart.x + pointer.x - session.pointerStart.x),
    y: Math.round(session.windowStart.y + pointer.y - session.pointerStart.y)
  };
}

function isFinitePoint(point: ScreenPoint): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y);
}

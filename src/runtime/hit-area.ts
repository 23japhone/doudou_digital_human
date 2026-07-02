import type { PetManifest } from "../pet_bundle/manifest.js";
import type { RuntimeCursorHitTestResult } from "./runtime-types.js";

export interface CanvasAlphaSampler {
  width: number;
  height: number;
  alphaAt(x: number, y: number): number | null;
}

type RuntimeHitArea = PetManifest["hitArea"];
type RuntimeFallbackRect = RuntimeHitArea["fallbackRect"];

export interface RuntimeScreenHitTestInput {
  canvasClientRect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  canvasSize: {
    width: number;
    height: number;
  };
  hitArea: RuntimeHitArea;
  sampler?: CanvasAlphaSampler;
  screenPoint: {
    x: number;
    y: number;
  };
  windowOrigin: {
    x: number;
    y: number;
  };
}

export function isPointInsideRuntimeHitArea(
  x: number,
  y: number,
  hitArea: RuntimeHitArea,
  alphaSampler?: CanvasAlphaSampler
): boolean {
  const sampledAlpha = alphaSampler ? sampleAlpha(x, y, alphaSampler) : null;
  if (sampledAlpha !== null) {
    return sampledAlpha > hitArea.alphaThreshold;
  }
  return isPointInsideFallbackRect(x, y, hitArea.fallbackRect);
}

export function isScreenPointInsideRuntimeHitArea(input: RuntimeScreenHitTestInput): boolean {
  return createRuntimeScreenHitTestResult(input).visible;
}

export function createRuntimeScreenHitTestResult(input: RuntimeScreenHitTestInput): RuntimeCursorHitTestResult {
  const canvasPoint = mapScreenPointToCanvasPoint(input);
  if (!canvasPoint) {
    return { visible: false };
  }
  return {
    canvasPoint,
    canvasSize: input.canvasSize,
    visible: isPointInsideRuntimeHitArea(canvasPoint.x, canvasPoint.y, input.hitArea, input.sampler)
  };
}

function mapScreenPointToCanvasPoint(input: RuntimeScreenHitTestInput): { x: number; y: number } | null {
  if (
    !Number.isFinite(input.screenPoint.x) ||
    !Number.isFinite(input.screenPoint.y) ||
    !Number.isFinite(input.windowOrigin.x) ||
    !Number.isFinite(input.windowOrigin.y) ||
    !Number.isFinite(input.canvasClientRect.x) ||
    !Number.isFinite(input.canvasClientRect.y) ||
    !Number.isFinite(input.canvasClientRect.width) ||
    !Number.isFinite(input.canvasClientRect.height) ||
    input.canvasClientRect.width <= 0 ||
    input.canvasClientRect.height <= 0
  ) {
    return null;
  }
  const cssX = input.screenPoint.x - input.windowOrigin.x - input.canvasClientRect.x;
  const cssY = input.screenPoint.y - input.windowOrigin.y - input.canvasClientRect.y;
  return {
    x: (cssX / input.canvasClientRect.width) * input.canvasSize.width,
    y: (cssY / input.canvasClientRect.height) * input.canvasSize.height
  };
}

export function isPointInsideFallbackRect(x: number, y: number, rect: RuntimeFallbackRect): boolean {
  return x >= rect.x && y >= rect.y && x <= rect.x + rect.width && y <= rect.y + rect.height;
}

function sampleAlpha(x: number, y: number, sampler: CanvasAlphaSampler): number | null {
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }
  const sampleX = Math.floor(x);
  const sampleY = Math.floor(y);
  if (sampleX < 0 || sampleY < 0 || sampleX >= sampler.width || sampleY >= sampler.height) {
    return 0;
  }
  const alpha = sampler.alphaAt(sampleX, sampleY);
  if (alpha === null || !Number.isFinite(alpha)) {
    return null;
  }
  return Math.min(255, Math.max(0, Math.floor(alpha)));
}

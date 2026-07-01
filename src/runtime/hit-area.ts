import type { PetManifest } from "../pet_bundle/manifest.js";

export interface CanvasAlphaSampler {
  width: number;
  height: number;
  alphaAt(x: number, y: number): number | null;
}

type RuntimeHitArea = PetManifest["hitArea"];
type RuntimeFallbackRect = RuntimeHitArea["fallbackRect"];

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

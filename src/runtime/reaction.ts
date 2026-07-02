import type { RuntimeCursorHitTestResult } from "./runtime-types.js";

export type RuntimeAlphaReaction = "approach" | "dodge" | "none";

export interface RuntimeAlphaReactionInput {
  hitTest: RuntimeCursorHitTestResult;
}

const RUNTIME_ALPHA_REACTION_DODGE_RADIUS_RATIO = 0.24;

export function classifyRuntimeAlphaReaction(input: RuntimeAlphaReactionInput): RuntimeAlphaReaction {
  const hitTest = input.hitTest;
  if (!hitTest.visible) {
    return "none";
  }
  if (!hitTest.canvasPoint || !hitTest.canvasSize) {
    return "approach";
  }
  const center = {
    x: hitTest.canvasSize.width / 2,
    y: hitTest.canvasSize.height / 2
  };
  const radiusBasis = Math.max(1, Math.min(hitTest.canvasSize.width, hitTest.canvasSize.height) / 2);
  const distanceRatio = Math.hypot(hitTest.canvasPoint.x - center.x, hitTest.canvasPoint.y - center.y) / radiusBasis;
  return distanceRatio <= RUNTIME_ALPHA_REACTION_DODGE_RADIUS_RATIO ? "dodge" : "approach";
}

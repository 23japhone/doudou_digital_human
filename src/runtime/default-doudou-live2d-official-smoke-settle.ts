import type { DoudouOfficialLive2DRendererHostEvidence } from "./default-doudou-live2d-official-renderer-host.js";
import type { RuntimeLive2DOfficialRendererAssetProbe } from "./runtime-types.js";

export const DOUDOU_LIVE2D_RENDERER_SMOKE_SETTLE_TIMEOUT_MS = 2500;
export const DOUDOU_LIVE2D_RENDERER_SMOKE_SETTLE_POLL_MS = 50;

export interface DoudouLive2DRendererSmokeSettleInput {
  rendererAssetProbe: RuntimeLive2DOfficialRendererAssetProbe;
  runtimeModule: DoudouOfficialLive2DRendererHostEvidence;
}

export function isDoudouLive2DRendererSmokePending(input: DoudouLive2DRendererSmokeSettleInput): boolean {
  return (
    input.rendererAssetProbe === "model3_fetch_pending" ||
    input.runtimeModule.runtimeModuleProbe === "load_pending" ||
    input.runtimeModule.pendingExpressionSwitches > 0
  );
}

export function isDoudouLive2DRendererSmokeSettledAfterInteractions(
  input: DoudouLive2DRendererSmokeSettleInput
): boolean {
  if (isDoudouLive2DRendererSmokePending(input)) {
    return false;
  }
  if (input.runtimeModule.runtimeModuleProbe !== "loaded") {
    return true;
  }
  if (input.runtimeModule.expressionSwitches <= 0) {
    return true;
  }
  return input.runtimeModule.expressionAppliedAfterFrame && input.runtimeModule.expressionCanvasChangedAfterFrame;
}

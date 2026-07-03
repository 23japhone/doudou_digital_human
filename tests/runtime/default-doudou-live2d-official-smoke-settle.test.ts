import { describe, expect, test } from "vitest";
import {
  DOUDOU_LIVE2D_RENDERER_SMOKE_SETTLE_TIMEOUT_MS,
  isDoudouLive2DRendererSmokePending,
  isDoudouLive2DRendererSmokeSettledAfterInteractions
} from "../../src/runtime/default-doudou-live2d-official-smoke-settle.js";
import type { DoudouOfficialLive2DRendererHostEvidence } from "../../src/runtime/default-doudou-live2d-official-renderer-host.js";

describe("default doudou official Live2D smoke settle gate", () => {
  test("keeps smoke pending while official asset, module, or expression work is still in flight", () => {
    expect(isDoudouLive2DRendererSmokePending({
      rendererAssetProbe: "model3_fetch_pending",
      runtimeModule: createHostEvidence({ runtimeModuleProbe: "not_configured" })
    })).toBe(true);
    expect(isDoudouLive2DRendererSmokePending({
      rendererAssetProbe: "model3_fetched",
      runtimeModule: createHostEvidence({ runtimeModuleProbe: "load_pending" })
    })).toBe(true);
    expect(isDoudouLive2DRendererSmokePending({
      rendererAssetProbe: "model3_fetched",
      runtimeModule: createHostEvidence({
        pendingExpressionSwitches: 1,
        runtimeModuleProbe: "loaded"
      })
    })).toBe(true);
  });

  test("waits for a loaded official expression to apply and change the Live2D canvas", () => {
    const loadedAfterSwitch = createHostEvidence({
      activeEmotionId: "delighted",
      expressionAppliedAfterFrame: false,
      expressionCanvasChangedAfterFrame: false,
      expressionSwitches: 1,
      modelLoaded: true,
      runtimeModuleProbe: "loaded"
    });

    expect(isDoudouLive2DRendererSmokeSettledAfterInteractions({
      rendererAssetProbe: "model3_fetched",
      runtimeModule: loadedAfterSwitch
    })).toBe(false);
    expect(isDoudouLive2DRendererSmokeSettledAfterInteractions({
      rendererAssetProbe: "model3_fetched",
      runtimeModule: {
        ...loadedAfterSwitch,
        expressionAppliedAfterFrame: true,
        expressionCanvasChangedAfterFrame: true
      }
    })).toBe(true);
  });

  test("uses an extended wait window for real SDK model and texture setup", () => {
    expect(DOUDOU_LIVE2D_RENDERER_SMOKE_SETTLE_TIMEOUT_MS).toBeGreaterThanOrEqual(2500);
  });
});

function createHostEvidence(
  patch: Partial<DoudouOfficialLive2DRendererHostEvidence> = {}
): DoudouOfficialLive2DRendererHostEvidence {
  return {
    activeEmotionId: "calm_idle",
    drawCalls: 0,
    expressionAppliedAfterFrame: false,
    expressionCanvasChangedAfterFrame: false,
    expressionCount: 0,
    expressionEmotionIdsObserved: [],
    expressionSwitches: 0,
    frameLoopAdvanced: false,
    modelLoaded: false,
    pendingExpressionSwitches: 0,
    runtimeFailureReason: null,
    runtimeLifecycle: {
      drawCalls: 0,
      expressionLoadCalls: 0,
      expressionSetCalls: 0,
      modelUpdateCalls: 0,
      updateMotionCalls: 0
    },
    runtimeModuleProbe: "not_configured",
    updateCalls: 0,
    ...patch
  };
}

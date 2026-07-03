import { describe, expect, test } from "vitest";
import {
  doudouOfficialLive2DRendererRuntimeEvidenceFailures,
  hasCompleteDoudouOfficialLive2DRendererRuntimeEvidence,
  parseDoudouOfficialLive2DRendererSmokeEvidence,
  type DoudouOfficialLive2DRendererRuntimeSmokeEvidence
} from "../../src/runtime/default-doudou-live2d-official-smoke-evidence.js";

describe("default doudou official Live2D smoke evidence", () => {
  test("requires loaded official runtime evidence to prove expression switching in the renderer", () => {
    const evidence = createOfficialRuntimeEvidence({
      activeEmotionId: "calm_idle",
      expressionSwitches: 0
    });

    expect(doudouOfficialLive2DRendererRuntimeEvidenceFailures("officialRuntime", evidence)).toEqual([
      "officialRuntime.expressionSwitches",
      "officialRuntime.activeEmotionId"
    ]);
    expect(hasCompleteDoudouOfficialLive2DRendererRuntimeEvidence(evidence)).toBe(false);
  });

  test("requires loaded official runtime evidence to prove the Live2D canvas layer is visible", () => {
    const evidence = createOfficialRuntimeEvidence({
      canvasLayerVisible: false
    });

    expect(doudouOfficialLive2DRendererRuntimeEvidenceFailures("officialRuntime", evidence)).toEqual([
      "officialRuntime.canvasLayerVisible"
    ]);
    expect(hasCompleteDoudouOfficialLive2DRendererRuntimeEvidence(evidence)).toBe(false);
  });

  test("requires loaded official runtime evidence to prove the Live2D canvas rendered pixels", () => {
    const evidence = createOfficialRuntimeEvidence({
      canvasNonTransparentPixel: false
    });

    expect(doudouOfficialLive2DRendererRuntimeEvidenceFailures("officialRuntime", evidence)).toEqual([
      "officialRuntime.canvasNonTransparentPixel"
    ]);
    expect(hasCompleteDoudouOfficialLive2DRendererRuntimeEvidence(evidence)).toBe(false);
  });

  test("requires loaded official runtime evidence to apply an expression after a frame", () => {
    const evidence = createOfficialRuntimeEvidence({
      expressionAppliedAfterFrame: false
    });

    expect(doudouOfficialLive2DRendererRuntimeEvidenceFailures("officialRuntime", evidence)).toEqual([
      "officialRuntime.expressionAppliedAfterFrame"
    ]);
    expect(hasCompleteDoudouOfficialLive2DRendererRuntimeEvidence(evidence)).toBe(false);
  });

  test("requires loaded official runtime evidence to prove the expression changed rendered canvas pixels", () => {
    const evidence = createOfficialRuntimeEvidence({
      expressionCanvasChangedAfterFrame: false
    });

    expect(doudouOfficialLive2DRendererRuntimeEvidenceFailures("officialRuntime", evidence)).toEqual([
      "officialRuntime.expressionCanvasChangedAfterFrame"
    ]);
    expect(hasCompleteDoudouOfficialLive2DRendererRuntimeEvidence(evidence)).toBe(false);
  });

  test("requires loaded official runtime evidence to observe multiple non-idle expression emotions", () => {
    const evidence = createOfficialRuntimeEvidence({
      expressionEmotionIdsObserved: ["delighted"]
    });

    expect(doudouOfficialLive2DRendererRuntimeEvidenceFailures("officialRuntime", evidence)).toEqual([
      "officialRuntime.expressionEmotionIdsObserved"
    ]);
    expect(hasCompleteDoudouOfficialLive2DRendererRuntimeEvidence(evidence)).toBe(false);
  });

  test("requires loaded official runtime evidence to finish pending expression switches", () => {
    const evidence = createOfficialRuntimeEvidence({
      pendingExpressionSwitches: 1
    });

    expect(doudouOfficialLive2DRendererRuntimeEvidenceFailures("officialRuntime", evidence)).toEqual([
      "officialRuntime.pendingExpressionSwitches"
    ]);
    expect(hasCompleteDoudouOfficialLive2DRendererRuntimeEvidence(evidence)).toBe(false);
  });

  test("requires loaded official runtime evidence to prove updateMotion advanced inside the module", () => {
    const evidence = createOfficialRuntimeEvidence({
      runtimeLifecycle: {
        drawCalls: 2,
        expressionLoadCalls: 12,
        expressionSetCalls: 2,
        modelUpdateCalls: 2,
        updateMotionCalls: 0
      }
    });

    expect(doudouOfficialLive2DRendererRuntimeEvidenceFailures("officialRuntime", evidence)).toEqual([
      "officialRuntime.runtimeLifecycle.updateMotionCalls"
    ]);
    expect(hasCompleteDoudouOfficialLive2DRendererRuntimeEvidence(evidence)).toBe(false);
  });

  test("requires loaded official runtime evidence to load all default expressions inside the module", () => {
    const evidence = createOfficialRuntimeEvidence({
      runtimeLifecycle: {
        drawCalls: 2,
        expressionLoadCalls: 11,
        expressionSetCalls: 2,
        modelUpdateCalls: 2,
        updateMotionCalls: 2
      }
    });

    expect(doudouOfficialLive2DRendererRuntimeEvidenceFailures("officialRuntime", evidence)).toEqual([
      "officialRuntime.runtimeLifecycle.expressionLoadCalls"
    ]);
    expect(hasCompleteDoudouOfficialLive2DRendererRuntimeEvidence(evidence)).toBe(false);
  });

  test("requires loaded official runtime evidence to set expressions inside the module", () => {
    const evidence = createOfficialRuntimeEvidence({
      runtimeLifecycle: {
        drawCalls: 2,
        expressionLoadCalls: 12,
        expressionSetCalls: 1,
        modelUpdateCalls: 2,
        updateMotionCalls: 2
      }
    });

    expect(doudouOfficialLive2DRendererRuntimeEvidenceFailures("officialRuntime", evidence)).toEqual([
      "officialRuntime.runtimeLifecycle.expressionSetCalls"
    ]);
    expect(hasCompleteDoudouOfficialLive2DRendererRuntimeEvidence(evidence)).toBe(false);
  });

  test("accepts complete loaded official runtime evidence", () => {
    const evidence = createOfficialRuntimeEvidence({
      activeEmotionId: "delighted",
      expressionSwitches: 2
    });

    expect(doudouOfficialLive2DRendererRuntimeEvidenceFailures("officialRuntime", evidence)).toEqual([]);
    expect(hasCompleteDoudouOfficialLive2DRendererRuntimeEvidence(evidence)).toBe(true);
  });

  test("rejects loaded official runtime evidence that still carries a failure reason", () => {
    const evidence = createOfficialRuntimeEvidence({
      runtimeFailureReason: "frame_failed"
    });

    expect(doudouOfficialLive2DRendererRuntimeEvidenceFailures("officialRuntime", evidence)).toEqual([
      "officialRuntime.runtimeFailureReason"
    ]);
    expect(hasCompleteDoudouOfficialLive2DRendererRuntimeEvidence(evidence)).toBe(false);
  });

  test("preserves sanitized official runtime failure reason for diagnosis", () => {
    const parsed = parseDoudouOfficialLive2DRendererSmokeEvidence(`runtime smoke fixture bundle: ${JSON.stringify(
      createRuntimeSmokeResult(createOfficialRuntimeEvidence({
        runtimeFailureReason: "expression_switch_rejected",
        runtimeModuleProbe: "model_failed"
      }))
    )}`);

    expect(parsed.fixtureBundle).toMatchObject({
      runtimeFailureReason: "expression_switch_rejected",
      runtimeModuleProbe: "model_failed"
    });
  });

  test("drops unsanitized official runtime failure reason strings", () => {
    const parsed = parseDoudouOfficialLive2DRendererSmokeEvidence(`runtime smoke fixture bundle: ${JSON.stringify({
      live2DRendererSpike: {
        officialRuntime: {
          canvasLayerVisible: true,
          canvasNonTransparentPixel: true,
          rendererAssetProbe: "model3_fetched",
          runtimeModule: {
            ...createRuntimeSmokeResult(createOfficialRuntimeEvidence()).live2DRendererSpike.officialRuntime.runtimeModule,
            runtimeFailureReason: "/local/model/default-doudou.model3.json failed"
          }
        }
      }
    })}`);

    expect(parsed.fixtureBundle?.runtimeFailureReason).toBeNull();
    expect(JSON.stringify(parsed)).not.toContain("/local/model");
  });

  test("parses fixture and generated bundle official runtime smoke output", () => {
    const fixtureBundle = createRuntimeSmokeResult(createOfficialRuntimeEvidence({
      activeEmotionId: "delighted",
      expressionSwitches: 2
    }));
    const generatedBundle = createRuntimeSmokeResult(createOfficialRuntimeEvidence({
      activeEmotionId: "focused_working",
      expressionSwitches: 2
    }));

    expect(parseDoudouOfficialLive2DRendererSmokeEvidence([
      `runtime smoke fixture bundle: ${JSON.stringify(fixtureBundle)}`,
      `runtime smoke generated bundle: ${JSON.stringify(generatedBundle)}`
    ].join("\n"))).toEqual({
      fixtureBundle: createOfficialRuntimeEvidence({
        activeEmotionId: "delighted",
        expressionSwitches: 2
      }),
      generatedBundle: createOfficialRuntimeEvidence({
        activeEmotionId: "focused_working",
        expressionSwitches: 2
      })
    });
  });
});

function createOfficialRuntimeEvidence(
  patch: Partial<DoudouOfficialLive2DRendererRuntimeSmokeEvidence> = {}
): DoudouOfficialLive2DRendererRuntimeSmokeEvidence {
  return {
    activeEmotionId: "delighted",
    canvasLayerVisible: true,
    canvasNonTransparentPixel: true,
    drawCalls: 2,
    expressionAppliedAfterFrame: true,
    expressionCanvasChangedAfterFrame: true,
    expressionCount: 12,
    expressionEmotionIdsObserved: ["delighted", "focused_working"],
    expressionSwitches: 1,
    frameLoopAdvanced: true,
    modelLoaded: true,
    pendingExpressionSwitches: 0,
    rendererAssetProbe: "model3_fetched",
    runtimeFailureReason: null,
    runtimeLifecycle: {
      drawCalls: 2,
      expressionLoadCalls: 12,
      expressionSetCalls: 2,
      modelUpdateCalls: 2,
      updateMotionCalls: 2
    },
    runtimeModuleProbe: "loaded",
    updateCalls: 2,
    ...patch
  };
}

function createRuntimeSmokeResult(evidence: DoudouOfficialLive2DRendererRuntimeSmokeEvidence) {
  return {
    live2DRendererSpike: {
      officialRuntime: {
        canvasLayerVisible: evidence.canvasLayerVisible,
        canvasNonTransparentPixel: evidence.canvasNonTransparentPixel,
        rendererAssetProbe: evidence.rendererAssetProbe,
        runtimeModule: {
          activeEmotionId: evidence.activeEmotionId,
          drawCalls: evidence.drawCalls,
          expressionAppliedAfterFrame: evidence.expressionAppliedAfterFrame,
          expressionCanvasChangedAfterFrame: evidence.expressionCanvasChangedAfterFrame,
          expressionCount: evidence.expressionCount,
          expressionEmotionIdsObserved: evidence.expressionEmotionIdsObserved,
          expressionSwitches: evidence.expressionSwitches,
          frameLoopAdvanced: evidence.frameLoopAdvanced,
          modelLoaded: evidence.modelLoaded,
          pendingExpressionSwitches: evidence.pendingExpressionSwitches,
          runtimeFailureReason: evidence.runtimeFailureReason,
          runtimeLifecycle: evidence.runtimeLifecycle,
          runtimeModuleProbe: evidence.runtimeModuleProbe,
          updateCalls: evidence.updateCalls
        }
      }
    }
  };
}

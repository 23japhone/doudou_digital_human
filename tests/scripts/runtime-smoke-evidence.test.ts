import { describe, expect, test } from "vitest";
import {
  hasRuntimeEmotionModelPanelSmokeEvidence,
  hasRuntimeEmotionModelTraySmokeEvidence,
  hasRuntimeLiveEmotionPanelSmokeEvidence,
  hasRuntimeLiveEmotionTraySmokeEvidence,
  hasRuntimePetPerformanceSmokeEvidence,
  hasRuntimePetPresentationSmokeEvidence
} from "../../src/scripts/runtime-smoke-evidence.js";

describe("runtime smoke evidence", () => {
  test("requires pet performance governor smoke coverage", () => {
    expect(hasRuntimePetPerformanceSmokeEvidence({
      petPerformanceExpressionPrioritiesObserved: ["normal", "force"],
      petPerformanceGovernorSchemaVersionsObserved: ["doudou.pet-performance-governor.v0.1"],
      petPerformanceMotionBudgetsObserved: ["none", "low", "medium"],
      petPerformanceTransitionTonesObserved: ["idle", "reaction", "soft_recovery", "focused"]
    })).toBe(true);
    expect(hasRuntimePetPerformanceSmokeEvidence({
      petPerformanceExpressionPrioritiesObserved: ["normal"],
      petPerformanceGovernorSchemaVersionsObserved: ["doudou.pet-performance-governor.v0.1"],
      petPerformanceMotionBudgetsObserved: ["none", "low"],
      petPerformanceTransitionTonesObserved: ["idle", "focused"]
    })).toBe(false);
  });

  test("requires pet presentation envelope smoke coverage", () => {
    expect(hasRuntimePetPresentationSmokeEvidence({
      petPresentationEnvelopeSchemaVersionsObserved: ["doudou.pet-presentation-envelope.v0.1"],
      petPresentationReactionActsObserved: [
        "none",
        "poke_pop",
        "repeat_poke_retreat",
        "repeat_poke_watch",
        "quiet_recovery",
        "work_hold"
      ],
      petPresentationStableStatesObserved: ["calm", "curious", "focused", "wary"]
    })).toBe(true);
    expect(hasRuntimePetPresentationSmokeEvidence({
      petPresentationEnvelopeSchemaVersionsObserved: ["doudou.pet-presentation-envelope.v0.1"],
      petPresentationReactionActsObserved: ["none", "poke_pop", "work_hold"],
      petPresentationStableStatesObserved: ["calm", "curious", "focused", "wary"]
    })).toBe(false);
  });

  test("accepts only consented successful emotion panel smoke evidence in live mode", () => {
    expect(hasRuntimeEmotionModelPanelSmokeEvidence({
      buttonSubmitted: true,
      commandApplied: true,
      consented: true,
      panelVisible: true,
      providerCalled: true,
      statusSanitized: true,
      statusText: "兜兜回应了：兜兜轻快微笑表情反馈：兜兜轻快微笑兜兜已经切换状态"
    }, { expectConsented: true })).toBe(true);
    expect(hasRuntimeEmotionModelPanelSmokeEvidence({
      buttonSubmitted: true,
      commandApplied: null,
      consented: false,
      panelVisible: true,
      providerCalled: false,
      statusSanitized: true,
      statusText: "需要本次授权勾选本次授权后再告诉兜兜"
    }, { expectConsented: true })).toBe(false);
  });

  test("accepts only unconsented gated emotion panel smoke evidence in default mode", () => {
    expect(hasRuntimeEmotionModelPanelSmokeEvidence({
      buttonSubmitted: true,
      commandApplied: null,
      consented: false,
      panelVisible: true,
      providerCalled: false,
      statusSanitized: true,
      statusText: "需要本次授权勾选本次授权后再告诉兜兜"
    }, { expectConsented: false })).toBe(true);
    expect(hasRuntimeEmotionModelPanelSmokeEvidence({
      buttonSubmitted: true,
      commandApplied: true,
      consented: true,
      panelVisible: true,
      providerCalled: true,
      statusSanitized: true,
      statusText: "兜兜回应了：兜兜轻快微笑表情反馈：兜兜轻快微笑兜兜已经切换状态"
    }, { expectConsented: false })).toBe(false);
  });

  test("accepts live emotion panel smoke without requiring regular interaction coverage", () => {
    expect(hasRuntimeLiveEmotionPanelSmokeEvidence({
      atlasLoaded: true,
      bundleLoaded: true,
      live2DRendererSpike: {
        enabled: true,
        expressionCount: 12,
        frameLoopAdvanced: true,
        modelLoaded: true
      },
      nonTransparentPixel: true,
      renderLoopAdvanced: true,
      emotionModelPanel: {
        buttonSubmitted: true,
        commandApplied: true,
        consented: true,
        panelVisible: true,
        providerCalled: true,
        statusSanitized: true,
        statusText: "兜兜回应了：兜兜轻快微笑表情反馈：兜兜轻快微笑兜兜已经切换状态"
      }
    })).toBe(true);
  });

  test("accepts tray menu entry evidence without requiring the flag-gated panel", () => {
    expect(hasRuntimeEmotionModelTraySmokeEvidence({
      commandApplied: null,
      consented: false,
      menuCreated: true,
      menuItemVisible: true,
      providerCalled: null,
      requestDispatched: false,
      statusSanitized: true,
      statusText: ""
    }, { expectConsented: false })).toBe(true);
    expect(hasRuntimeEmotionModelTraySmokeEvidence({
      commandApplied: true,
      consented: true,
      menuCreated: true,
      menuItemVisible: true,
      providerCalled: true,
      requestDispatched: true,
      statusSanitized: true,
      statusText: "兜兜回应了：兜兜轻快微笑表情反馈：兜兜轻快微笑兜兜已经切换状态"
    }, { expectConsented: true })).toBe(true);
    expect(hasRuntimeEmotionModelTraySmokeEvidence({
      commandApplied: true,
      consented: true,
      menuCreated: false,
      menuItemVisible: true,
      providerCalled: true,
      requestDispatched: true,
      statusSanitized: true,
      statusText: "兜兜回应了：兜兜轻快微笑表情反馈：兜兜轻快微笑兜兜已经切换状态"
    }, { expectConsented: true })).toBe(false);
  });

  test("accepts live tray smoke without requiring the flag-gated panel", () => {
    expect(hasRuntimeLiveEmotionTraySmokeEvidence({
      atlasLoaded: true,
      bundleLoaded: true,
      live2DRendererSpike: {
        enabled: true,
        expressionCount: 12,
        frameLoopAdvanced: true,
        modelLoaded: true
      },
      nonTransparentPixel: true,
      renderLoopAdvanced: true,
      emotionModelTray: {
        commandApplied: true,
        consented: true,
        menuCreated: true,
        menuItemVisible: true,
        providerCalled: true,
        requestDispatched: true,
        statusSanitized: true,
        statusText: "兜兜回应了：兜兜轻快微笑表情反馈：兜兜轻快微笑兜兜已经切换状态"
      }
    })).toBe(true);
  });
});

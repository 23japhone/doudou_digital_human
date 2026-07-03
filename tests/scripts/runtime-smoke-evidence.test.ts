import { describe, expect, test } from "vitest";
import {
  hasRuntimeEmotionModelPanelSmokeEvidence,
  hasRuntimeLiveEmotionPanelSmokeEvidence
} from "../../src/scripts/runtime-smoke-evidence.js";

describe("runtime smoke evidence", () => {
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
});

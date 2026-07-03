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
      statusText: "已触发：兜兜轻快微笑调用：是模型：Qwen3.6-27B命令：set_expression应用：已应用"
    }, { expectConsented: true })).toBe(true);
    expect(hasRuntimeEmotionModelPanelSmokeEvidence({
      buttonSubmitted: true,
      commandApplied: null,
      consented: false,
      panelVisible: true,
      providerCalled: false,
      statusSanitized: true,
      statusText: "未授权，模型未调用"
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
      statusText: "未授权，模型未调用调用：否原因：需要勾选授权命令：无"
    }, { expectConsented: false })).toBe(true);
    expect(hasRuntimeEmotionModelPanelSmokeEvidence({
      buttonSubmitted: true,
      commandApplied: true,
      consented: true,
      panelVisible: true,
      providerCalled: true,
      statusSanitized: true,
      statusText: "已触发：兜兜轻快微笑调用：是应用：已应用"
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
        statusText: "已触发：兜兜轻快微笑调用：是模型：Qwen3.6-27B命令：set_expression应用：已应用"
      }
    })).toBe(true);
  });
});

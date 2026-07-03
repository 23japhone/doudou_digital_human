import { describe, expect, test } from "vitest";
import {
  DOUDOU_EMOTION_DEBUG_PANEL_SMOKE_TEXT,
  createDoudouEmotionDebugPanelStatus,
  isDoudouEmotionDebugPanelSmokeStatusSanitized,
  resolveDoudouEmotionDebugPanelEnabled,
  resolveDoudouEmotionDebugPanelSmokeConsent,
  type DoudouEmotionDebugPanelStatus
} from "../../src/runtime/default-doudou-emotion-debug-panel.js";

describe("default doudou emotion debug panel", () => {
  test("formats accepted model commands as sanitized Chinese status", () => {
    const status = createDoudouEmotionDebugPanelStatus({
      applyResult: {
        applied: true,
        emotionId: "happy_smile",
        expiresAtMs: 7000,
        expressionApplied: true,
        motionCueApplied: true,
        ok: true,
        reason: "accepted"
      },
      result: {
        command: {
          emotionId: "happy_smile",
          kind: "set_expression",
          motionCue: "small_pop",
          reason: "accepted",
          ttlMs: 6000
        },
        decision: {
          accepted: true,
          emotionId: "happy_smile",
          reason: "accepted"
        },
        ok: true,
        provider: {
          called: true,
          model: "unit-test-model"
        },
        providerConfig: {
          apiKeyConfigured: true,
          configured: true,
          endpointConfigured: true,
          model: "unit-test-model",
          modelConfigured: true
        },
        skipped: false
      }
    });

    expect(status).toEqual({
      details: [
        "表情反馈：兜兜轻快微笑",
        "兜兜已经切换状态"
      ],
      heading: "兜兜回应了：兜兜轻快微笑",
      tone: "success"
    });
    expectStatusToBeSanitized(status);
  });

  test("formats missing consent as a local gate without provider evidence", () => {
    const status = createDoudouEmotionDebugPanelStatus({
      result: {
        ok: true,
        provider: {
          called: false
        },
        providerConfig: {
          apiKeyConfigured: true,
          configured: true,
          endpointConfigured: true,
          model: "unit-test-model",
          modelConfigured: true
        },
        reason: "user_consent_required",
        skipped: true
      }
    });

    expect(status).toEqual({
      details: [
        "勾选本次授权后再告诉兜兜"
      ],
      heading: "需要本次授权",
      tone: "warning"
    });
    expectStatusToBeSanitized(status);
  });

  test("formats provider failures without raw provider output", () => {
    const status = createDoudouEmotionDebugPanelStatus({
      result: {
        code: "model_output_invalid",
        ok: false,
        provider: {
          called: true,
          model: "unit-test-model"
        },
        providerConfig: {
          apiKeyConfigured: true,
          configured: true,
          endpointConfigured: true,
          model: "unit-test-model",
          modelConfigured: true
        },
        skipped: false
      }
    });

    expect(status).toEqual({
      details: [
        "稍后再试一次"
      ],
      heading: "兜兜这次没听清",
      tone: "error"
    });
    expectStatusToBeSanitized(status);
  });

  test("formats keep-current arbitration as a user-facing doudou state", () => {
    const status = createDoudouEmotionDebugPanelStatus({
      applyResult: {
        applied: false,
        emotionId: "calm_idle",
        expressionApplied: false,
        motionCueApplied: false,
        ok: true,
        reason: "confidence_too_low"
      },
      result: {
        command: {
          emotionId: "happy_smile",
          kind: "keep_current",
          reason: "confidence_too_low"
        },
        decision: {
          accepted: false,
          emotionId: "happy_smile",
          reason: "confidence_too_low"
        },
        ok: true,
        provider: {
          called: true,
          model: "unit-test-model"
        },
        providerConfig: {
          apiKeyConfigured: true,
          configured: true,
          endpointConfigured: true,
          model: "unit-test-model",
          modelConfigured: true
        },
        skipped: false
      }
    });

    expect(status).toEqual({
      details: [
        "兜兜会先安静陪着你"
      ],
      heading: "兜兜先保持现在的状态",
      tone: "warning"
    });
    expectStatusToBeSanitized(status);
  });

  test("enables the debug panel only from an explicit runtime flag or env opt-in", () => {
    expect(resolveDoudouEmotionDebugPanelEnabled({
      env: {},
      optionEnabled: false
    })).toBe(false);
    expect(resolveDoudouEmotionDebugPanelEnabled({
      env: {
        DOUDOU_EMOTION_TRIGGER_PANEL: "1"
      },
      optionEnabled: false
    })).toBe(true);
    expect(resolveDoudouEmotionDebugPanelEnabled({
      env: {},
      optionEnabled: true
    })).toBe(true);
  });

  test("enables consented panel smoke only from an explicit env opt-in", () => {
    expect(resolveDoudouEmotionDebugPanelSmokeConsent({})).toBe(false);
    expect(resolveDoudouEmotionDebugPanelSmokeConsent({
      DOUDOU_EMOTION_PANEL_SMOKE_CONSENT: "1"
    })).toBe(true);
    expect(resolveDoudouEmotionDebugPanelSmokeConsent({
      DOUDOU_EMOTION_PANEL_SMOKE_CONSENT: "true"
    })).toBe(false);
  });

  test("rejects smoke status text that leaks live prompt or provider details", () => {
    expect(isDoudouEmotionDebugPanelSmokeStatusSanitized(
      "兜兜回应了：兜兜轻快微笑表情反馈：兜兜轻快微笑兜兜已经切换状态"
    )).toBe(true);
    expect(isDoudouEmotionDebugPanelSmokeStatusSanitized(
      "已触发：兜兜轻快微笑调用：是模型：unit-test-model命令：set_expression应用：已应用"
    )).toBe(false);
    expect(isDoudouEmotionDebugPanelSmokeStatusSanitized("兜兜回应了：Qwen3.6-27B")).toBe(false);
    expect(isDoudouEmotionDebugPanelSmokeStatusSanitized(
      `已触发：兜兜轻快微笑${DOUDOU_EMOTION_DEBUG_PANEL_SMOKE_TEXT}`
    )).toBe(false);
    expect(isDoudouEmotionDebugPanelSmokeStatusSanitized("调用：https://model.example.test")).toBe(false);
    expect(isDoudouEmotionDebugPanelSmokeStatusSanitized("调用：sk-unit-test-token")).toBe(false);
    expect(isDoudouEmotionDebugPanelSmokeStatusSanitized("choices: []")).toBe(false);
  });
});

function expectStatusToBeSanitized(status: DoudouEmotionDebugPanelStatus): void {
  const serialized = JSON.stringify(status);
  expect(serialized).not.toContain("sk-unit-test-token");
  expect(serialized).not.toContain("model.example.test");
  expect(serialized).not.toContain("今天有点累");
  expect(serialized).not.toContain("choices");
  expect(serialized).not.toContain("user_positive_text");
  expect(serialized).not.toContain("调用");
  expect(serialized).not.toContain("模型");
  expect(serialized).not.toContain("命令");
  expect(serialized).not.toContain("应用：");
  expect(serialized).not.toContain("set_expression");
  expect(serialized).not.toContain("keep_current");
  expect(serialized).not.toContain("unit-test-model");
  expect(serialized).not.toContain("Qwen");
}

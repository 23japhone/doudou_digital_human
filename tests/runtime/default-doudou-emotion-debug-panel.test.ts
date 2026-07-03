import { describe, expect, test } from "vitest";
import {
  createDoudouEmotionDebugPanelStatus,
  resolveDoudouEmotionDebugPanelEnabled,
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
        "调用：是",
        "模型：unit-test-model",
        "命令：set_expression",
        "表情：兜兜轻快微笑",
        "动作：轻快弹一下",
        "应用：已应用"
      ],
      heading: "已触发：兜兜轻快微笑",
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
        "调用：否",
        "原因：需要勾选授权",
        "命令：无"
      ],
      heading: "未授权，模型未调用",
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
        "调用：是",
        "模型：unit-test-model",
        "错误：模型输出无效"
      ],
      heading: "未应用表情",
      tone: "error"
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
});

function expectStatusToBeSanitized(status: DoudouEmotionDebugPanelStatus): void {
  const serialized = JSON.stringify(status);
  expect(serialized).not.toContain("sk-1234");
  expect(serialized).not.toContain("model.example.test");
  expect(serialized).not.toContain("今天有点累");
  expect(serialized).not.toContain("choices");
  expect(serialized).not.toContain("user_positive_text");
}

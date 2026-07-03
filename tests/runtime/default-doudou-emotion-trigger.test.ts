import { describe, expect, test, vi } from "vitest";
import type { DoudouModelEmotionSuggestion } from "../../src/runtime/default-doudou-live2d.js";
import type { DoudouLive2DPreviewLibrary } from "../../src/runtime/default-doudou-live2d-preview.js";
import {
  applyDoudouEmotionBehaviorTriggerResultToLive2D,
  queryDoudouEmotionBehaviorForExplicitRuntimeInput
} from "../../src/runtime/default-doudou-emotion-trigger.js";

describe("default doudou emotion trigger", () => {
  const env = {
    DOUDOU_EMOTION_MODEL_API_KEY: "unit-test-token",
    DOUDOU_EMOTION_MODEL_ENDPOINT: "https://model.example.test/v1/chat/completions",
    DOUDOU_EMOTION_MODEL_ID: "unit-test-model"
  };

  test("does not call the model provider without explicit user consent", async () => {
    const fetchMock = vi.fn();

    const result = await queryDoudouEmotionBehaviorForExplicitRuntimeInput({
      env,
      fetch: fetchMock,
      input: {
        consent: false,
        currentEmotionId: "calm_idle",
        text: "今天有点累，兜兜陪我一下。"
      }
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toEqual({
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
    });
    expect(JSON.stringify(result)).not.toContain(env.DOUDOU_EMOTION_MODEL_API_KEY);
    expect(JSON.stringify(result)).not.toContain(env.DOUDOU_EMOTION_MODEL_ENDPOINT);
    expect(JSON.stringify(result)).not.toContain("今天有点累");
  });

  test("queries the provider only after consent and returns a sanitized runtime command", async () => {
    const suggestion: DoudouModelEmotionSuggestion = {
      confidence: 0.94,
      intent: "celebrate_small_success",
      reasonCode: "user_positive_text",
      source: "llm",
      suggestedEmotionId: "happy_smile",
      ttlMs: 6000
    };
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify(suggestion)
            }
          }
        ]
      }), { status: 200 })
    );

    const result = await queryDoudouEmotionBehaviorForExplicitRuntimeInput({
      env,
      fetch: fetchMock,
      input: {
        consent: true,
        currentEmotionId: "calm_idle",
        text: "我刚刚把一个小功能跑通了！"
      }
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      command: {
        emotionId: "happy_smile",
        kind: "set_expression",
        motionCue: "small_pop",
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
    });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain(env.DOUDOU_EMOTION_MODEL_API_KEY);
    expect(serialized).not.toContain(env.DOUDOU_EMOTION_MODEL_ENDPOINT);
    expect(serialized).not.toContain("我刚刚把一个小功能跑通了");
    expect(serialized).not.toContain("choices");
    expect(serialized).not.toContain("user_positive_text");
  });

  test("applies accepted commands through the renderer Live2D host target", async () => {
    const library = {} as DoudouLive2DPreviewLibrary;
    const switchExpression = vi.fn(async () => true);
    const applyMotionCue = vi.fn(async () => true);

    const result = await applyDoudouEmotionBehaviorTriggerResultToLive2D({
      applyMotionCue,
      library,
      nowMs: 1000,
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
      },
      switchExpression
    });

    expect(switchExpression).toHaveBeenCalledWith(library, "happy_smile");
    expect(applyMotionCue).toHaveBeenCalledWith(
      "small_pop",
      "happy_smile",
      expect.objectContaining({ kind: "set_expression" })
    );
    expect(result).toEqual({
      applied: true,
      emotionId: "happy_smile",
      expiresAtMs: 7000,
      expressionApplied: true,
      motionCueApplied: true,
      ok: true,
      reason: "accepted"
    });
  });
});

import { describe, expect, test, vi } from "vitest";
import {
  DEFAULT_DOUDOU_MODEL_ARBITRATION_RESPONSE_FORMAT,
  type DoudouModelEmotionSuggestion
} from "../../src/runtime/default-doudou-live2d.js";
import {
  createDoudouModelBehaviorCommand,
  queryDoudouEmotionModelBehavior
} from "../../src/runtime/default-doudou-model-behavior-api.js";

describe("default doudou model behavior api", () => {
  const unitTestApiKey = "unit-test-token";
  const unitTestModel = "unit-test-model";

  test("calls an OpenAI-compatible chat completion endpoint and maps accepted output to a runtime expression command", async () => {
    const suggestion: DoudouModelEmotionSuggestion = {
      confidence: 0.91,
      intent: "soft_comfort",
      reasonCode: "user_low_mood_text",
      source: "llm",
      suggestedEmotionId: "comfort_soft",
      ttlMs: 8000
    };
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
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

    const result = await queryDoudouEmotionModelBehavior({
      apiKey: unitTestApiKey,
      endpoint: "https://model.example.test/v1/chat/completions",
      fetch: fetchMock,
      input: {
        currentEmotionId: "calm_idle",
        runtimeStateLocked: false,
        safetyState: "clear",
        source: "llm",
        text: "今天有点低落，但还想继续做事。",
        userVisionConsent: false
      },
      model: unitTestModel
    });

    expect(result).toMatchObject({
      ok: true,
      command: {
        kind: "set_expression",
        emotionId: "comfort_soft",
        motionCue: "soft_breath",
        ttlMs: 8000
      },
      decision: {
        accepted: true,
        emotionId: "comfort_soft",
        reason: "accepted"
      }
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://model.example.test/v1/chat/completions");
    expect(init.headers).toMatchObject({
      Authorization: `Bearer ${unitTestApiKey}`,
      "Content-Type": "application/json"
    });
    const body = JSON.parse(String(init.body)) as {
      messages: { content: string; role: string }[];
      model: string;
      response_format: unknown;
    };
    expect(body.model).toBe(unitTestModel);
    expect(body.response_format).toEqual(DEFAULT_DOUDOU_MODEL_ARBITRATION_RESPONSE_FORMAT);
    expect(body.messages.map((message) => message.role)).toEqual(["system", "user"]);
    expect(JSON.stringify(result)).not.toContain(unitTestApiKey);
    expect(JSON.stringify(result)).not.toContain("model.example.test");
  });

  test("does not call the provider when VLM input has no explicit user vision consent", async () => {
    const fetchMock = vi.fn();

    const result = await queryDoudouEmotionModelBehavior({
      apiKey: unitTestApiKey,
      endpoint: "https://model.example.test/v1/chat/completions",
      fetch: fetchMock,
      input: {
        currentEmotionId: "calm_idle",
        runtimeStateLocked: false,
        safetyState: "clear",
        source: "vlm",
        text: "用户没有授权视觉输入。",
        userVisionConsent: false
      },
      model: unitTestModel
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toEqual({
      ok: true,
      command: {
        kind: "keep_current",
        emotionId: "calm_idle",
        reason: "vision_without_consent"
      },
      decision: {
        accepted: false,
        emotionId: "calm_idle",
        reason: "vision_without_consent"
      },
      provider: {
        called: false
      }
    });
  });

  test("rejects provider output that escapes the safe emotion suggestion schema", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                confidence: 0.95,
                expressionFile: "expressions/doudou_teary.exp3.json",
                intent: "soft_comfort",
                reasonCode: "user_low_mood_text",
                source: "llm",
                suggestedEmotionId: "teary",
                ttlMs: 6000
              })
            }
          }
        ]
      }), { status: 200 })
    );

    const result = await queryDoudouEmotionModelBehavior({
      apiKey: unitTestApiKey,
      endpoint: "https://model.example.test/v1/chat/completions",
      fetch: fetchMock,
      input: {
        currentEmotionId: "calm_idle",
        runtimeStateLocked: false,
        safetyState: "clear",
        source: "llm",
        text: "帮兜兜判断一个轻量情绪。",
        userVisionConsent: false
      },
      model: unitTestModel
    });

    expect(result).toEqual({
      ok: false,
      code: "model_output_invalid"
    });
    expect(JSON.stringify(result)).not.toContain(unitTestApiKey);
    expect(JSON.stringify(result)).not.toContain("doudou_teary.exp3.json");
  });

  test("converts a direct model suggestion into the same runtime behavior command shape", () => {
    const command = createDoudouModelBehaviorCommand({
      context: {
        currentEmotionId: "calm_idle",
        runtimeStateLocked: false,
        safetyState: "clear",
        userVisionConsent: false
      },
      suggestion: {
        confidence: 0.88,
        intent: "celebrate_small_success",
        reasonCode: "user_positive_text",
        source: "llm",
        suggestedEmotionId: "delighted",
        ttlMs: 5000
      }
    });

    expect(command).toEqual({
      kind: "set_expression",
      emotionId: "delighted",
      motionCue: "small_pop",
      reason: "accepted",
      ttlMs: 5000
    });
  });
});

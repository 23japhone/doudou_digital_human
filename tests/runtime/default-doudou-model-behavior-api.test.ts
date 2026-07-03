import { describe, expect, test, vi } from "vitest";
import {
  DEFAULT_DOUDOU_MODEL_ARBITRATION_RESPONSE_FORMAT,
  type DoudouModelEmotionSuggestion
} from "../../src/runtime/default-doudou-live2d.js";
import {
  applyDoudouModelBehaviorCommandToRuntime,
  createDoudouModelBehaviorCommand,
  createDoudouLive2DBehaviorRuntimeTarget,
  resolveDoudouEmotionModelBehaviorConfig,
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

  test("sends consented VLM input as an OpenAI-compatible image message without returning visual payloads", async () => {
    const visionPayload = "c3ludGhldGljLXBuZw==";
    const suggestion: DoudouModelEmotionSuggestion = {
      confidence: 0.86,
      intent: "curiosity_prompt",
      reasonCode: "user_selected_asset_quality",
      source: "vlm",
      suggestedEmotionId: "curious_tilt",
      ttlMs: 7000
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

    const result = await queryDoudouEmotionModelBehavior({
      apiKey: unitTestApiKey,
      endpoint: "https://model.example.test/v1/chat/completions",
      fetch: fetchMock,
      input: {
        currentEmotionId: "calm_idle",
        runtimeStateLocked: false,
        safetyState: "clear",
        source: "vlm",
        text: "用户明确选择了 QA 预览图，让兜兜判断轻量反应。",
        userVisionConsent: true,
        visionInput: {
          dataBase64: visionPayload,
          mimeType: "image/png",
          purpose: "qa_artifact"
        }
      },
      model: unitTestModel
    });

    expect(result).toMatchObject({
      ok: true,
      command: {
        kind: "set_expression",
        emotionId: "curious_tilt",
        motionCue: "soft_breath"
      }
    });
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as {
      messages: Array<{ content: unknown; role: string }>;
    };
    const userContent = body.messages[1]?.content;
    expect(userContent).toEqual([
      expect.objectContaining({
        type: "text",
        text: expect.stringContaining("\"visionPurpose\":\"qa_artifact\"")
      }),
      {
        type: "image_url",
        image_url: {
          detail: "low",
          url: `data:image/png;base64,${visionPayload}`
        }
      }
    ]);
    expect(JSON.stringify(result)).not.toContain(visionPayload);
    expect(JSON.stringify(result)).not.toContain("model.example.test");
    expect(JSON.stringify(result)).not.toContain(unitTestApiKey);
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

  test("applies accepted behavior commands to the runtime expression and motion target", async () => {
    const calls: string[] = [];

    const result = await applyDoudouModelBehaviorCommandToRuntime({
      command: {
        kind: "set_expression",
        emotionId: "annoyed_pout",
        motionCue: "short_retreat",
        reason: "accepted",
        ttlMs: 4000
      },
      nowMs: 1000,
      target: {
        applyMotionCue: async (motionCue, emotionId) => {
          calls.push(`motion:${motionCue}:${emotionId}`);
          return true;
        },
        setExpression: async ({ emotionId, motionCue, ttlMs }) => {
          calls.push(`expression:${emotionId}:${motionCue}:${ttlMs}`);
          return true;
        }
      }
    });

    expect(result).toEqual({
      ok: true,
      applied: true,
      emotionId: "annoyed_pout",
      expiresAtMs: 5000,
      expressionApplied: true,
      motionCueApplied: true,
      reason: "accepted"
    });
    expect(calls).toEqual([
      "expression:annoyed_pout:short_retreat:4000",
      "motion:short_retreat:annoyed_pout"
    ]);
  });

  test("adapts the existing Live2D host switchExpression API into a behavior runtime target", async () => {
    const calls: string[] = [];
    const library = { expressionCount: 12 } as never;
    const target = createDoudouLive2DBehaviorRuntimeTarget({
      applyMotionCue: (motionCue, emotionId) => {
        calls.push(`motion:${motionCue}:${emotionId}`);
        return true;
      },
      library,
      switchExpression: async (receivedLibrary, emotionId) => {
        expect(receivedLibrary).toBe(library);
        calls.push(`switch:${emotionId}`);
        return true;
      }
    });

    const result = await applyDoudouModelBehaviorCommandToRuntime({
      command: {
        kind: "set_expression",
        emotionId: "delighted",
        motionCue: "small_pop",
        reason: "accepted",
        ttlMs: 3000
      },
      nowMs: 1200,
      target
    });

    expect(result).toMatchObject({
      ok: true,
      applied: true,
      emotionId: "delighted",
      expressionApplied: true,
      motionCueApplied: true
    });
    expect(calls).toEqual(["switch:delighted", "motion:small_pop:delighted"]);
  });

  test("does not touch the runtime target for keep-current commands", async () => {
    const result = await applyDoudouModelBehaviorCommandToRuntime({
      command: {
        kind: "keep_current",
        emotionId: "calm_idle",
        reason: "confidence_too_low"
      },
      nowMs: 1000,
      target: {
        setExpression: () => {
          throw new Error("setExpression should not be called");
        }
      }
    });

    expect(result).toEqual({
      ok: true,
      applied: false,
      emotionId: "calm_idle",
      expressionApplied: false,
      motionCueApplied: false,
      reason: "confidence_too_low"
    });
  });

  test("returns a fixed failure code when the runtime rejects an accepted expression command", async () => {
    const result = await applyDoudouModelBehaviorCommandToRuntime({
      command: {
        kind: "set_expression",
        emotionId: "comfort_soft",
        motionCue: "soft_breath",
        reason: "accepted",
        ttlMs: 6000
      },
      nowMs: 1000,
      target: {
        applyMotionCue: () => {
          throw new Error("motion cue should wait for expression acceptance");
        },
        setExpression: async () => false
      }
    });

    expect(result).toEqual({
      ok: false,
      applied: false,
      code: "runtime_expression_rejected",
      emotionId: "comfort_soft",
      expressionApplied: false,
      motionCueApplied: false
    });
  });

  test("resolves model behavior provider config from local-only env names with sanitized public evidence", () => {
    const config = resolveDoudouEmotionModelBehaviorConfig({
      DOUDOU_EMOTION_MODEL_API_KEY: "unit-test-secret",
      DOUDOU_EMOTION_MODEL_ENDPOINT: "https://model.example.test/v1/chat/completions",
      DOUDOU_EMOTION_MODEL_ID: "Qwen3.6-27B",
      OPENAI_API_KEY: "ignored-openai-secret"
    });

    expect(config).toMatchObject({
      apiKey: "unit-test-secret",
      endpoint: "https://model.example.test/v1/chat/completions",
      model: "Qwen3.6-27B",
      publicEvidence: {
        apiKeyConfigured: true,
        configured: true,
        endpointConfigured: true,
        modelConfigured: true,
        model: "Qwen3.6-27B"
      }
    });
    expect(JSON.stringify(config.publicEvidence)).not.toContain("unit-test-secret");
    expect(JSON.stringify(config.publicEvidence)).not.toContain("model.example.test");
    expect(JSON.stringify(config.publicEvidence)).not.toContain("ignored-openai-secret");
  });
});

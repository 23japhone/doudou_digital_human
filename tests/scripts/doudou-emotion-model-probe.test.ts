import { describe, expect, test, vi } from "vitest";
import { runDoudouEmotionModelProbe } from "../../src/scripts/doudou-emotion-model-probe.js";

describe("runDoudouEmotionModelProbe", () => {
  test("skips without local emotion model configuration", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("fetch should not run");
    });

    const result = await runDoudouEmotionModelProbe({
      env: {},
      fetch: fetchMock
    });

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.output)).toMatchObject({
      skipped: true,
      providerConfig: {
        apiKeyConfigured: false,
        configured: false,
        endpointConfigured: false,
        modelConfigured: false
      }
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("returns sanitized command and runtime-apply evidence for an accepted model suggestion", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                confidence: 0.9,
                intent: "celebrate_small_success",
                reasonCode: "user_positive_text",
                source: "llm",
                suggestedEmotionId: "delighted",
                ttlMs: 5000
              })
            }
          }
        ],
        rawSecretEcho: "raw-provider-payload"
      }), { status: 200 })
    );

    const result = await runDoudouEmotionModelProbe({
      env: {
        DOUDOU_EMOTION_MODEL_API_KEY: "secret-emotion-key",
        DOUDOU_EMOTION_MODEL_ENDPOINT: "https://model.example.test/v1/chat/completions",
        DOUDOU_EMOTION_MODEL_ID: "unit-test-model"
      },
      fetch: fetchMock,
      nowMs: 1000
    });

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.output)).toMatchObject({
      ok: true,
      providerConfig: {
        apiKeyConfigured: true,
        configured: true,
        endpointConfigured: true,
        model: "unit-test-model",
        modelConfigured: true
      },
      provider: {
        called: true,
        model: "unit-test-model"
      },
      command: {
        kind: "set_expression",
        emotionId: "delighted",
        motionCue: "small_pop",
        ttlMs: 5000
      },
      decision: {
        accepted: true,
        emotionId: "delighted",
        reason: "accepted"
      },
      runtimeApply: {
        ok: true,
        applied: true,
        emotionId: "delighted",
        expressionApplied: true,
        motionCueApplied: true,
        expiresAtMs: 6000
      },
      runtimeTarget: {
        expressionCount: 12,
        kind: "default_doudou_preview_library"
      }
    });
    const output = result.output;
    expect(output).not.toContain("secret-emotion-key");
    expect(output).not.toContain("model.example.test");
    expect(output).not.toContain("raw-provider-payload");
    expect(output).not.toContain("今天做了");
  });

  test("maps provider failures to sanitized probe output", async () => {
    const result = await runDoudouEmotionModelProbe({
      env: {
        DOUDOU_EMOTION_MODEL_API_KEY: "secret-emotion-key",
        DOUDOU_EMOTION_MODEL_ENDPOINT: "https://model.example.test/v1/chat/completions",
        DOUDOU_EMOTION_MODEL_ID: "unit-test-model"
      },
      fetch: async () =>
        new Response(JSON.stringify({
          error: {
            message: "secret provider detail"
          }
        }), { status: 500 })
    });

    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.output)).toMatchObject({
      ok: false,
      code: "provider_error",
      providerConfig: {
        apiKeyConfigured: true,
        configured: true,
        endpointConfigured: true,
        model: "unit-test-model",
        modelConfigured: true
      }
    });
    expect(result.output).not.toContain("secret-emotion-key");
    expect(result.output).not.toContain("model.example.test");
    expect(result.output).not.toContain("secret provider detail");
  });
});

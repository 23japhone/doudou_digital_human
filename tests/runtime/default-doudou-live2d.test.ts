import { describe, expect, test } from "vitest";
import { DEFAULT_DOUDOU_EMOTION_IDS } from "../../src/runtime/default-doudou-emotions.js";
import {
  DEFAULT_DOUDOU_LIVE2D_EXPRESSION_SPECS,
  DEFAULT_DOUDOU_MODEL_ARBITRATION_JSON_SCHEMA,
  DEFAULT_DOUDOU_MODEL_ARBITRATION_RESPONSE_FORMAT,
  DEFAULT_DOUDOU_SAFE_MODEL_INTENTS,
  doudouArbitrateEmotionSuggestion,
  doudouLive2DExpressionForEmotion,
  validateDoudouLive2DExpressionSpecs
} from "../../src/runtime/default-doudou-live2d.js";

describe("default doudou Live2D expression mapping", () => {
  test("maps every Stage A emotion id to a concrete exp3 expression spec", () => {
    expect(DEFAULT_DOUDOU_LIVE2D_EXPRESSION_SPECS).toHaveLength(DEFAULT_DOUDOU_EMOTION_IDS.length);
    expect(DEFAULT_DOUDOU_LIVE2D_EXPRESSION_SPECS.map((spec) => spec.emotionId)).toEqual(DEFAULT_DOUDOU_EMOTION_IDS);

    for (const emotionId of DEFAULT_DOUDOU_EMOTION_IDS) {
      const spec = doudouLive2DExpressionForEmotion(emotionId);
      expect(spec.expressionFile).toBe(`expressions/doudou_${emotionId}.exp3.json`);
      expect(spec.type).toBe("Live2D Expression");
      expect(spec.fadeInSec).toBeGreaterThan(0);
      expect(spec.fadeOutSec).toBeGreaterThan(0);
      expect(spec.parameters.length).toBeGreaterThanOrEqual(6);
    }
  });

  test("uses Cubism-safe parameter and blend choices", () => {
    expect(validateDoudouLive2DExpressionSpecs()).toEqual([]);

    for (const spec of DEFAULT_DOUDOU_LIVE2D_EXPRESSION_SPECS) {
      const eyeOpenTargets = spec.parameters.filter((target) =>
        target.id === "ParamEyeLOpen" || target.id === "ParamEyeROpen"
      );
      expect(eyeOpenTargets.map((target) => target.id).sort()).toEqual(["ParamEyeLOpen", "ParamEyeROpen"]);
      for (const target of eyeOpenTargets) {
        expect(target.blend).toBe("Multiply");
      }
      for (const target of spec.parameters) {
        expect(Number.isFinite(target.value)).toBe(true);
      }
    }
  });

  test("captures the distinct emotional affordances needed by the default character", () => {
    const delighted = doudouLive2DExpressionForEmotion("delighted");
    expect(delighted.parameters).toContainEqual(
      expect.objectContaining({ id: "ParamDoudouSparkle", blend: "Overwrite", value: 1 })
    );

    const teary = doudouLive2DExpressionForEmotion("teary");
    expect(teary.parameters).toContainEqual(
      expect.objectContaining({ id: "ParamDoudouTear", blend: "Overwrite", value: 1 })
    );

    const annoyed = doudouLive2DExpressionForEmotion("annoyed_pout");
    expect(annoyed.parameters).toContainEqual(
      expect.objectContaining({ id: "ParamMouthForm", blend: "Add", value: expect.any(Number) })
    );
    expect(annoyed.parameters.find((target) => target.id === "ParamMouthForm")?.value).toBeLessThan(0);
  });
});

describe("default doudou LLM/VLM arbitration spec", () => {
  test("restricts model output to safe intent and emotion suggestions only", () => {
    expect(DEFAULT_DOUDOU_MODEL_ARBITRATION_JSON_SCHEMA.additionalProperties).toBe(false);
    expect(DEFAULT_DOUDOU_MODEL_ARBITRATION_JSON_SCHEMA.required).toEqual([
      "source",
      "intent",
      "suggestedEmotionId",
      "confidence",
      "reasonCode",
      "ttlMs"
    ]);
    expect(DEFAULT_DOUDOU_MODEL_ARBITRATION_JSON_SCHEMA.properties.intent.enum).toEqual(
      DEFAULT_DOUDOU_SAFE_MODEL_INTENTS
    );
    expect(DEFAULT_DOUDOU_MODEL_ARBITRATION_JSON_SCHEMA.properties.suggestedEmotionId.enum).toEqual(
      DEFAULT_DOUDOU_EMOTION_IDS
    );
    expect(DEFAULT_DOUDOU_MODEL_ARBITRATION_JSON_SCHEMA.properties).not.toHaveProperty("live2dParameters");
    expect(DEFAULT_DOUDOU_MODEL_ARBITRATION_JSON_SCHEMA.properties).not.toHaveProperty("expressionFile");
    expect(DEFAULT_DOUDOU_MODEL_ARBITRATION_JSON_SCHEMA.properties).not.toHaveProperty("freeformMessage");
    expect(DEFAULT_DOUDOU_MODEL_ARBITRATION_RESPONSE_FORMAT).toEqual({
      type: "json_schema",
      json_schema: {
        name: "doudou_emotion_suggestion",
        strict: true,
        schema: DEFAULT_DOUDOU_MODEL_ARBITRATION_JSON_SCHEMA
      }
    });
  });

  test("keeps runtime safety and user consent above model suggestions", () => {
    const baseSuggestion = {
      source: "llm" as const,
      intent: "soft_comfort" as const,
      suggestedEmotionId: "comfort_soft" as const,
      confidence: 0.9,
      reasonCode: "user_low_mood_text" as const,
      ttlMs: 8000
    };

    expect(
      doudouArbitrateEmotionSuggestion(baseSuggestion, {
        currentEmotionId: "calm_idle",
        runtimeStateLocked: false,
        safetyState: "blocked",
        userVisionConsent: false
      })
    ).toEqual({ accepted: false, emotionId: "calm_idle", reason: "safety_blocked" });

    expect(
      doudouArbitrateEmotionSuggestion(
        { ...baseSuggestion, source: "vlm" },
        {
          currentEmotionId: "calm_idle",
          runtimeStateLocked: false,
          safetyState: "clear",
          userVisionConsent: false
        }
      )
    ).toEqual({ accepted: false, emotionId: "calm_idle", reason: "vision_without_consent" });

    expect(
      doudouArbitrateEmotionSuggestion(baseSuggestion, {
        currentEmotionId: "calm_idle",
        runtimeStateLocked: false,
        safetyState: "clear",
        userVisionConsent: false
      })
    ).toEqual({ accepted: true, emotionId: "comfort_soft", reason: "accepted" });
  });
});

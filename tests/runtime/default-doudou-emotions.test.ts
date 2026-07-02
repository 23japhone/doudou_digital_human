import { describe, expect, test } from "vitest";
import {
  DEFAULT_DOUDOU_EMOTION_IDS,
  DEFAULT_DOUDOU_EMOTION_SCENARIOS,
  DEFAULT_DOUDOU_EMOTION_SPECS,
  DEFAULT_DOUDOU_PERSONA,
  doudouEmotionForRuntimeScenario,
  doudouEmotionScenarioForRuntimeState,
  doudouEmotionForRuntimeState,
  type DefaultDoudouEmotionId
} from "../../src/runtime/default-doudou-emotions.js";

describe("default doudou emotion assets", () => {
  test("defines the twelve emotion states from the Stage A research rubric", () => {
    expect(DEFAULT_DOUDOU_PERSONA.displayName).toBe("兜兜");
    expect(DEFAULT_DOUDOU_EMOTION_IDS).toEqual<DefaultDoudouEmotionId[]>([
      "calm_idle",
      "happy_smile",
      "delighted",
      "shy_blush",
      "curious_tilt",
      "comfort_soft",
      "sad_soft",
      "teary",
      "surprised",
      "annoyed_pout",
      "sleepy",
      "focused_working"
    ]);
    expect(new Set(DEFAULT_DOUDOU_EMOTION_SPECS.map((spec) => spec.id)).size).toBe(12);
    for (const spec of DEFAULT_DOUDOU_EMOTION_SPECS) {
      expect(spec.labelZh).toContain("兜兜");
      expect(spec.visualQa).toHaveLength(3);
      expect(spec.runtimeAssetMode).toBe("v0.1_runtime_overlay");
    }
  });

  test("maps Stage A runtime scenarios to clear Chinese-named emotions", () => {
    expect(DEFAULT_DOUDOU_EMOTION_SCENARIOS).toEqual({
      cursor_approach: "curious_tilt",
      cursor_dodge: "surprised",
      idle: "calm_idle",
      motion_stop: "happy_smile",
      quiet_recovery: "comfort_soft",
      repeat_poke_retreat: "annoyed_pout",
      repeat_poke_watch: "teary",
      tap: "surprised",
      working: "focused_working"
    });

    expect(doudouEmotionForRuntimeScenario("idle").labelZh).toBe("兜兜安静陪伴");
    expect(doudouEmotionForRuntimeScenario("tap").labelZh).toBe("兜兜被戳惊讶");
    expect(doudouEmotionForRuntimeScenario("repeat_poke_retreat").labelZh).toBe("兜兜鼓脸躲开");
    expect(doudouEmotionForRuntimeScenario("repeat_poke_watch").labelZh).toBe("兜兜委屈观察");
    expect(doudouEmotionForRuntimeScenario("quiet_recovery").labelZh).toBe("兜兜温柔恢复");
    expect(doudouEmotionForRuntimeScenario("working").labelZh).toBe("兜兜认真陪伴");
  });

  test("keeps the runtime state mapping outside the pet bundle schema", () => {
    expect(doudouEmotionForRuntimeState("waiting").id).toBe("calm_idle");
    expect(doudouEmotionForRuntimeState("poked").id).toBe("surprised");
    expect(doudouEmotionForRuntimeState("retreating").id).toBe("annoyed_pout");
    expect(doudouEmotionForRuntimeState("watching").id).toBe("teary");
    expect(doudouEmotionForRuntimeState("working").id).toBe("focused_working");
  });

  test("distinguishes quiet recovery from ordinary idle when motion settles", () => {
    expect(doudouEmotionScenarioForRuntimeState("waiting")).toBe("idle");
    expect(doudouEmotionScenarioForRuntimeState("waiting", "watching")).toBe("quiet_recovery");
    expect(doudouEmotionScenarioForRuntimeState("waiting", "retreating")).toBe("quiet_recovery");
    expect(doudouEmotionScenarioForRuntimeState("waiting", "poked")).toBe("idle");
  });
});

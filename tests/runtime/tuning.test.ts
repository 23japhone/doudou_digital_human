import { describe, expect, test } from "vitest";
import { createRuntimeEmotionMemory, recordRuntimePokeEmotion } from "../../src/runtime/reaction.js";
import {
  RUNTIME_MOTION_TUNING_DEFAULTS,
  createRuntimeEmotionPhaseConfig,
  createRuntimeRecoveryFollowConfig,
  createRuntimeStateTiming,
  resolveRuntimeMotionTuning,
  runtimeRetreatDistanceForTuning
} from "../../src/runtime/tuning.js";

describe("runtime motion tuning", () => {
  test("merges partial tuning patches and clamps unsafe values", () => {
    const tuning = resolveRuntimeMotionTuning({
      recoverySpeedPixelsPerSecond: Number.NaN,
      retreatDistancePixels: 40,
      watchingPauseMs: 5000
    });

    expect(tuning.retreatDistancePixels).toBeGreaterThan(40);
    expect(tuning.watchingPauseMs).toBeLessThan(5000);
    expect(tuning.recoverySpeedPixelsPerSecond).toBe(RUNTIME_MOTION_TUNING_DEFAULTS.recoverySpeedPixelsPerSecond);
  });

  test("maps watch pause tuning into emotion phase and visual state timing", () => {
    const tuning = resolveRuntimeMotionTuning({ watchingPauseMs: 760 });

    expect(createRuntimeEmotionPhaseConfig(tuning).watchingMs).toBe(760);
    expect(createRuntimeStateTiming(tuning).watchingToWaitingMs).toBe(760);
  });

  test("maps recovery speed tuning into cursor follow config", () => {
    const tuning = resolveRuntimeMotionTuning({ recoverySpeedPixelsPerSecond: 240 });

    expect(createRuntimeRecoveryFollowConfig(tuning).maxSpeedPixelsPerSecond).toBe(240);
  });

  test("uses retreat distance tuning as the high-wariness dodge distance", () => {
    let memory = createRuntimeEmotionMemory();
    memory = recordRuntimePokeEmotion(memory, 1000);
    memory = recordRuntimePokeEmotion(memory, 1300);

    const tuning = resolveRuntimeMotionTuning({ retreatDistancePixels: 260 });

    expect(runtimeRetreatDistanceForTuning(memory, 128, tuning)).toBeGreaterThan(128);
    expect(runtimeRetreatDistanceForTuning({ ...memory, wariness: 1 }, 128, tuning)).toBe(260);
  });
});

import { describe, expect, test } from "vitest";
import {
  PET_PRESENTATION_ENVELOPE_SCHEMA_VERSION,
  createPetPresentationEnvelope,
  petAffectCoreFromRuntime,
  petReactionActForPresentation
} from "../../src/runtime/presentation.js";
import { createRuntimeEmotionMemory, recordRuntimePokeEmotion } from "../../src/runtime/reaction.js";
import type { RuntimePetVisualPose } from "../../src/runtime/state.js";

describe("pet presentation envelope", () => {
  test("maps idle waiting into a calm no-op presentation envelope", () => {
    const envelope = createPetPresentationEnvelope({
      event: { source: "renderer", target: "runtime", type: "runtime_started" },
      memory: createRuntimeEmotionMemory(),
      motionPhase: "settled",
      nowMs: 0,
      pose: neutralPose(),
      previousState: "waiting",
      state: "waiting"
    });

    expect(envelope).toMatchObject({
      schemaVersion: PET_PRESENTATION_ENVELOPE_SCHEMA_VERSION,
      state: "waiting",
      scenario: "idle",
      emotionId: "calm_idle",
      reactionAct: "none",
      affect: {
        stableState: "calm",
        wariness: 0
      },
      policy: {
        canMoveWindow: false,
        canShowResizeFrame: false,
        canUseTapReactFrames: false,
        motionBudget: "none",
        recoverySpeed: "normal"
      },
      pose: {
        clickExpression: "none",
        direction: "none",
        motionIntensity: 0,
        stopRebound: 0
      }
    });
    expect(envelope.ttlMs).toBeGreaterThan(0);
  });

  test("keeps poke, repeat-poke, quiet recovery, and working as distinct reaction acts", () => {
    let memory = createRuntimeEmotionMemory();
    memory = recordRuntimePokeEmotion(memory, 1000);
    memory = recordRuntimePokeEmotion(memory, 1300);

    expect(petReactionActForPresentation({ motionPhase: "settled", state: "poked" })).toBe("poke_pop");
    expect(petReactionActForPresentation({ motionPhase: "retreating", state: "retreating" })).toBe("repeat_poke_retreat");
    expect(petReactionActForPresentation({ motionPhase: "watching", state: "watching" })).toBe("repeat_poke_watch");
    expect(petReactionActForPresentation({ motionPhase: "recovering", state: "waiting" })).toBe("quiet_recovery");
    expect(petReactionActForPresentation({ motionPhase: "settled", state: "working" })).toBe("work_hold");

    expect(petAffectCoreFromRuntime({ memory, motionPhase: "retreating", nowMs: 1450, state: "retreating" })).toMatchObject({
      stableState: "wary",
      wariness: expect.any(Number)
    });
    expect(petAffectCoreFromRuntime({ memory, motionPhase: "settled", nowMs: 1450, state: "working" })).toMatchObject({
      stableState: "focused"
    });
  });

  test("protects the window during passive cursor reactions while allowing only drag to move it", () => {
    const passive = createPetPresentationEnvelope({
      event: { source: "renderer", target: "visible_alpha", type: "cursor_alpha_entered" },
      memory: createRuntimeEmotionMemory(),
      motionPhase: "settled",
      nowMs: 1000,
      pose: { clickExpression: "none", direction: "right", motionIntensity: 0.7, stopRebound: 0 },
      previousState: "waiting",
      state: "dodging"
    });
    const drag = createPetPresentationEnvelope({
      event: { source: "renderer", target: "interaction_frame", type: "drag_started" },
      memory: createRuntimeEmotionMemory(),
      motionPhase: "settled",
      nowMs: 1000,
      pose: { clickExpression: "none", direction: "none", motionIntensity: 0.5, stopRebound: 0 },
      previousState: "waiting",
      state: "working"
    });

    expect(passive.policy).toMatchObject({
      canMoveWindow: false,
      canUseTapReactFrames: false,
      motionBudget: "medium"
    });
    expect(drag.policy).toMatchObject({
      canMoveWindow: true,
      canShowResizeFrame: true,
      motionBudget: "low"
    });
  });

  test("turns quiet recovery into a comfort envelope without inventing a new runtime state", () => {
    const envelope = createPetPresentationEnvelope({
      event: { source: "replay", target: "runtime", type: "quiet_tick" },
      memory: { lastInteractionAtMs: 1000, updatedAtMs: 2400, wariness: 0.22 },
      motionPhase: "recovering",
      nowMs: 2400,
      pose: neutralPose(),
      previousState: "watching",
      state: "waiting"
    });

    expect(envelope).toMatchObject({
      state: "waiting",
      scenario: "quiet_recovery",
      emotionId: "comfort_soft",
      reactionAct: "quiet_recovery",
      affect: {
        stableState: "wary"
      },
      policy: {
        recoverySpeed: "slow"
      }
    });
  });
});

function neutralPose(): RuntimePetVisualPose {
  return {
    clickExpression: "none",
    direction: "none",
    motionIntensity: 0,
    stopRebound: 0
  };
}

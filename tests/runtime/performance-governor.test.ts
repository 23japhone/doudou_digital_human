import { describe, expect, test } from "vitest";
import {
  createPetPerformancePlan,
  shouldSwitchExpressionForPerformancePlan
} from "../../src/runtime/performance-governor.js";
import { createPetPresentationEnvelope, type PetInteractionEvent } from "../../src/runtime/presentation.js";
import { createRuntimeEmotionMemory } from "../../src/runtime/reaction.js";
import type { RuntimePetState, RuntimePetVisualPose } from "../../src/runtime/state.js";

describe("pet performance governor", () => {
  test("turns no-motion presentation into a still renderer adapter plan", () => {
    const plan = createPetPerformancePlan(envelopeFor({
      event: { source: "renderer", target: "runtime", type: "runtime_started" },
      state: "waiting"
    }));

    expect(plan).toMatchObject({
      schemaVersion: "doudou.pet-performance-governor.v0.1",
      motionBudget: "none",
      reactionAct: "none",
      motion: {
        amplitudeScale: 0,
        cadenceMs: 1800,
        maxRotateDeg: 0,
        maxTranslateXPx: 0,
        maxTranslateYPx: 0,
        scaleDelta: 0
      },
      expression: {
        canSwitchExpression: true,
        canUseTapReactFrames: false,
        priority: "normal",
        transitionTone: "idle"
      },
      interaction: {
        canMoveWindow: false,
        canShowResizeFrame: false,
        interruptibleByPassiveCursor: true
      }
    });
  });

  test("keeps poke as an immediate medium-budget tap expression plan", () => {
    const plan = createPetPerformancePlan(envelopeFor({
      event: { source: "renderer", target: "visible_alpha", type: "poke" },
      pose: { clickExpression: "tap_react", direction: "right", motionIntensity: 0.9, stopRebound: 0 },
      state: "poked"
    }));

    expect(plan.motion).toMatchObject({
      amplitudeScale: 1,
      cadenceMs: 420,
      maxTranslateYPx: 11
    });
    expect(plan.expression).toMatchObject({
      canUseTapReactFrames: true,
      minSwitchIntervalMs: 80,
      priority: "force",
      transitionTone: "reaction"
    });
    expect(plan.interaction.interruptibleByPassiveCursor).toBe(true);
  });

  test("allows force-priority expression replay even when the target emotion is already active", () => {
    const idle = createPetPerformancePlan(envelopeFor({
      event: { source: "renderer", target: "runtime", type: "runtime_started" },
      state: "waiting"
    }));
    const poke = createPetPerformancePlan(envelopeFor({
      event: { source: "renderer", target: "visible_alpha", type: "poke" },
      pose: { clickExpression: "tap_react", direction: "right", motionIntensity: 0.9, stopRebound: 0 },
      state: "poked"
    }));

    expect(shouldSwitchExpressionForPerformancePlan("calm_idle", "calm_idle", idle)).toBe(false);
    expect(shouldSwitchExpressionForPerformancePlan("calm_idle", "surprised", poke)).toBe(true);
    expect(shouldSwitchExpressionForPerformancePlan("surprised", "surprised", poke)).toBe(true);
  });

  test("keeps quiet recovery and working low-budget but with different rhythm and interruption rules", () => {
    const quiet = createPetPerformancePlan(envelopeFor({
      event: { source: "renderer", target: "runtime", type: "quiet_tick" },
      motionPhase: "recovering",
      previousState: "watching",
      state: "waiting"
    }));
    const working = createPetPerformancePlan(envelopeFor({
      event: { source: "renderer", target: "interaction_frame", type: "drag_started" },
      pose: { clickExpression: "none", direction: "none", motionIntensity: 0.5, stopRebound: 0 },
      state: "working"
    }));

    expect(quiet.motion).toMatchObject({
      amplitudeScale: 0.42,
      cadenceMs: 1240
    });
    expect(quiet.expression).toMatchObject({
      priority: "normal",
      transitionTone: "soft_recovery"
    });
    expect(quiet.interaction.interruptibleByPassiveCursor).toBe(true);
    expect(working.motion).toMatchObject({
      amplitudeScale: 0.36,
      cadenceMs: 720
    });
    expect(working.expression).toMatchObject({
      priority: "normal",
      transitionTone: "focused"
    });
    expect(working.interaction).toMatchObject({
      canMoveWindow: true,
      canShowResizeFrame: true,
      interruptibleByPassiveCursor: false
    });
  });
});

function envelopeFor(input: {
  event: PetInteractionEvent;
  motionPhase?: "recovering" | "retreating" | "settled" | "watching";
  pose?: RuntimePetVisualPose;
  previousState?: RuntimePetState;
  state: RuntimePetState;
}) {
  return createPetPresentationEnvelope({
    event: input.event,
    memory: createRuntimeEmotionMemory(),
    motionPhase: input.motionPhase ?? "settled",
    nowMs: 1000,
    pose: input.pose ?? neutralPose(),
    previousState: input.previousState ?? "waiting",
    state: input.state
  });
}

function neutralPose(): RuntimePetVisualPose {
  return {
    clickExpression: "none",
    direction: "none",
    motionIntensity: 0,
    stopRebound: 0
  };
}

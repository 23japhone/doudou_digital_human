import { describe, expect, test } from "vitest";
import {
  RUNTIME_PET_STATE_TIMING,
  createRuntimePetStateMachine,
  runtimePetStateClass,
  type RuntimePetMotionCue,
  type RuntimePetState
} from "../../src/runtime/state.js";

describe("runtime pet state machine", () => {
  test("starts in the waiting state", () => {
    const machine = createRuntimePetStateMachine();

    expect(machine.current()).toBe("waiting");
    expect(runtimePetStateClass(machine.current())).toBe("runtime-state-waiting");
  });

  test("moves from approaching to stopped and then back to waiting", () => {
    const machine = createRuntimePetStateMachine();

    machine.motion(motionCue("approaching", 0.65), 1000);
    expect(machine.current()).toBe("approaching");

    machine.motion(motionCue("stopped", 0.65), 1100);
    expect(machine.current()).toBe("stopped");

    machine.advance(RUNTIME_PET_STATE_TIMING.stoppedToWaitingMs - 1, 1100 + RUNTIME_PET_STATE_TIMING.stoppedToWaitingMs - 1);
    expect(machine.current()).toBe("stopped");

    machine.advance(1, 1100 + RUNTIME_PET_STATE_TIMING.stoppedToWaitingMs);
    expect(machine.current()).toBe("waiting");
  });

  test("returns from approaching to waiting when no fresh motion cue arrives", () => {
    const machine = createRuntimePetStateMachine();

    machine.motion(motionCue("approaching", 0.65), 1000);
    machine.advance(RUNTIME_PET_STATE_TIMING.approachingToWaitingMs - 1, 1000 + RUNTIME_PET_STATE_TIMING.approachingToWaitingMs - 1);
    expect(machine.current()).toBe("approaching");

    machine.advance(1, 1000 + RUNTIME_PET_STATE_TIMING.approachingToWaitingMs);
    expect(machine.current()).toBe("waiting");
    expect(machine.pose().motionIntensity).toBe(0);
  });

  test("keeps stop rebound strength from the latest approach intensity", () => {
    const machine = createRuntimePetStateMachine();

    machine.motion(motionCue("approaching", 0.78), 1000);
    expect(machine.pose()).toMatchObject({
      direction: "right",
      motionIntensity: 0.78,
      stopRebound: 0
    });

    machine.motion(motionCue("stopped", 0.78), 1200);

    expect(machine.current()).toBe("stopped");
    expect(machine.pose().stopRebound).toBeCloseTo(0.78, 5);
  });

  test("uses the previous approach intensity when a settled cue has no motion intensity", () => {
    const machine = createRuntimePetStateMachine();

    machine.motion(motionCue("approaching", 0.72), 1000);
    machine.motion(motionCue("stopped", 0), 1200);

    expect(machine.current()).toBe("stopped");
    expect(machine.pose().stopRebound).toBeCloseTo(0.72, 5);
  });

  test("returns from dodging to waiting when no fresh motion cue arrives", () => {
    const machine = createRuntimePetStateMachine();

    machine.motion(motionCue("dodging", 0.75), 1800);
    expect(machine.current()).toBe("dodging");

    machine.advance(RUNTIME_PET_STATE_TIMING.dodgingToWaitingMs - 1, 1800 + RUNTIME_PET_STATE_TIMING.dodgingToWaitingMs - 1);
    expect(machine.current()).toBe("dodging");

    machine.advance(1, 1800 + RUNTIME_PET_STATE_TIMING.dodgingToWaitingMs);
    expect(machine.current()).toBe("waiting");
    expect(machine.pose().motionIntensity).toBe(0);
  });

  test("retreats briefly, watches the cursor, then settles when no fresh cue arrives", () => {
    const machine = createRuntimePetStateMachine();

    machine.motion(motionCue("retreating", 0.88), 2000);
    expect(machine.current()).toBe("retreating");
    expect(machine.pose()).toMatchObject({
      direction: "right",
      motionIntensity: 0.88
    });

    machine.advance(
      RUNTIME_PET_STATE_TIMING.retreatingToWatchingMs - 1,
      2000 + RUNTIME_PET_STATE_TIMING.retreatingToWatchingMs - 1
    );
    expect(machine.current()).toBe("retreating");

    machine.advance(1, 2000 + RUNTIME_PET_STATE_TIMING.retreatingToWatchingMs);
    expect(machine.current()).toBe("watching");
    expect(machine.pose()).toMatchObject({
      direction: "right",
      motionIntensity: 0.88
    });

    machine.advance(
      RUNTIME_PET_STATE_TIMING.watchingToWaitingMs,
      2000 + RUNTIME_PET_STATE_TIMING.retreatingToWatchingMs + RUNTIME_PET_STATE_TIMING.watchingToWaitingMs
    );
    expect(machine.current()).toBe("waiting");
    expect(machine.pose().motionIntensity).toBe(0);
  });

  test("keeps poked visual state briefly before returning to waiting", () => {
    const machine = createRuntimePetStateMachine();

    machine.tap(2000);
    expect(machine.current()).toBe("poked");
    expect(machine.pose().clickExpression).toBe("tap_react");

    machine.advance(RUNTIME_PET_STATE_TIMING.pokedMs - 1, 2000 + RUNTIME_PET_STATE_TIMING.pokedMs - 1);
    expect(machine.current()).toBe("poked");

    machine.advance(1, 2000 + RUNTIME_PET_STATE_TIMING.pokedMs);
    expect(machine.current()).toBe("waiting");
  });

  test("uses working state while runtime interaction is active", () => {
    const machine = createRuntimePetStateMachine();

    machine.working(3000);
    expect(machine.current()).toBe("working");

    machine.advance(RUNTIME_PET_STATE_TIMING.workingHoldMs - 1, 3000 + RUNTIME_PET_STATE_TIMING.workingHoldMs - 1);
    expect(machine.current()).toBe("working");

    machine.advance(1, 3000 + RUNTIME_PET_STATE_TIMING.workingHoldMs);
    expect(machine.current()).toBe("waiting");
  });

  test("records observed states in first-seen order without duplicates", () => {
    const machine = createRuntimePetStateMachine();

    machine.motion(motionCue("approaching", 0.5), 1000);
    machine.motion(motionCue("dodging", 0.75), 1050);
    machine.motion(motionCue("retreating", 0.85), 1075);
    machine.motion(motionCue("watching", 0.6), 1085);
    machine.motion(motionCue("stopped", 0.5), 1100);
    machine.tap(1200);
    machine.working(1300);
    machine.motion(motionCue("approaching", 0.5), 1400);

    expect(machine.observed()).toEqual<RuntimePetState[]>([
      "waiting",
      "approaching",
      "dodging",
      "retreating",
      "watching",
      "stopped",
      "poked",
      "working"
    ]);
  });
});

function motionCue(state: RuntimePetMotionCue["state"], motionIntensity: number): RuntimePetMotionCue {
  return {
    direction: "right",
    motionIntensity,
    state
  };
}

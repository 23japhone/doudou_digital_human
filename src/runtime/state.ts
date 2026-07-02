import type { RuntimeMotionDirection } from "./motion.js";

export type RuntimePetState = "approaching" | "stopped" | "clicked" | "waiting" | "working";

export type RuntimeMotionPetState = Extract<RuntimePetState, "approaching" | "stopped">;

export const RUNTIME_PET_STATES: readonly RuntimePetState[] = [
  "approaching",
  "stopped",
  "clicked",
  "waiting",
  "working"
];

export interface RuntimePetStateTiming {
  clickedMs: number;
  stoppedToWaitingMs: number;
  workingHoldMs: number;
}

export interface RuntimePetMotionCue {
  direction: RuntimeMotionDirection;
  motionIntensity: number;
  state: RuntimeMotionPetState;
}

export interface RuntimePetVisualPose {
  clickExpression: "none" | "tap_react";
  direction: RuntimeMotionDirection;
  motionIntensity: number;
  stopRebound: number;
}

export interface RuntimePetStateMachine {
  advance(deltaMs: number, nowMs?: number): RuntimePetState;
  current(): RuntimePetState;
  motion(cue: RuntimeMotionPetState | RuntimePetMotionCue, nowMs?: number): RuntimePetState;
  observed(): RuntimePetState[];
  pose(): RuntimePetVisualPose;
  tap(nowMs?: number): RuntimePetState;
  working(nowMs?: number): RuntimePetState;
}

export const RUNTIME_PET_STATE_TIMING: RuntimePetStateTiming = {
  clickedMs: 420,
  stoppedToWaitingMs: 900,
  workingHoldMs: 520
};

export function createRuntimePetStateMachine(
  timing: RuntimePetStateTiming = RUNTIME_PET_STATE_TIMING
): RuntimePetStateMachine {
  let state: RuntimePetState = "waiting";
  let stateEnteredAtMs = 0;
  const observedStates: RuntimePetState[] = ["waiting"];
  let pose: RuntimePetVisualPose = createNeutralPose();

  function setState(
    nextState: RuntimePetState,
    nowMs = stateEnteredAtMs,
    nextPose: RuntimePetVisualPose = pose
  ): RuntimePetState {
    if (state === nextState && samePose(pose, nextPose)) {
      return state;
    }
    state = nextState;
    stateEnteredAtMs = nowMs;
    pose = nextPose;
    if (!observedStates.includes(nextState)) {
      observedStates.push(nextState);
    }
    return state;
  }

  function advance(_deltaMs: number, nowMs = stateEnteredAtMs): RuntimePetState {
    const elapsedMs = Math.max(0, nowMs - stateEnteredAtMs);
    if (state === "clicked" && elapsedMs >= timing.clickedMs) {
      return setState("waiting", nowMs, createNeutralPose());
    }
    if (state === "stopped" && elapsedMs >= timing.stoppedToWaitingMs) {
      return setState("waiting", nowMs, createNeutralPose());
    }
    if (state === "working" && elapsedMs >= timing.workingHoldMs) {
      return setState("waiting", nowMs, createNeutralPose());
    }
    return state;
  }

  return {
    advance,
    current: () => state,
    motion: (cue, nowMs = stateEnteredAtMs) => {
      if (state === "clicked" || state === "working") {
        return state;
      }
      const motionCue = normalizeMotionCue(cue);
      const stopRebound = motionCue.state === "stopped" ? Math.max(motionCue.motionIntensity, pose.motionIntensity) : 0;
      return setState(motionCue.state, nowMs, {
        clickExpression: "none",
        direction: motionCue.direction === "none" ? pose.direction : motionCue.direction,
        motionIntensity: motionCue.state === "stopped" ? stopRebound : motionCue.motionIntensity,
        stopRebound
      });
    },
    observed: () => [...observedStates],
    pose: () => ({ ...pose }),
    tap: (nowMs = stateEnteredAtMs) => setState("clicked", nowMs, {
      ...pose,
      clickExpression: "tap_react",
      stopRebound: 0
    }),
    working: (nowMs = stateEnteredAtMs) => setState("working", nowMs, {
      ...pose,
      clickExpression: "none",
      motionIntensity: Math.max(pose.motionIntensity, 0.5),
      stopRebound: 0
    })
  };
}

export function runtimePetStateClass(state: RuntimePetState): string {
  return `runtime-state-${state}`;
}

function normalizeMotionCue(cue: RuntimeMotionPetState | RuntimePetMotionCue): RuntimePetMotionCue {
  if (typeof cue === "string") {
    return {
      direction: "none",
      motionIntensity: 0,
      state: cue
    };
  }
  return {
    direction: cue.direction,
    motionIntensity: clamp01(cue.motionIntensity),
    state: cue.state
  };
}

function createNeutralPose(): RuntimePetVisualPose {
  return {
    clickExpression: "none",
    direction: "none",
    motionIntensity: 0,
    stopRebound: 0
  };
}

function samePose(a: RuntimePetVisualPose, b: RuntimePetVisualPose): boolean {
  return (
    a.clickExpression === b.clickExpression &&
    a.direction === b.direction &&
    a.motionIntensity === b.motionIntensity &&
    a.stopRebound === b.stopRebound
  );
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}

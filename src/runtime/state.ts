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

export interface RuntimePetStateMachine {
  advance(deltaMs: number, nowMs?: number): RuntimePetState;
  current(): RuntimePetState;
  motion(state: RuntimeMotionPetState, nowMs?: number): RuntimePetState;
  observed(): RuntimePetState[];
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

  function setState(nextState: RuntimePetState, nowMs = stateEnteredAtMs): RuntimePetState {
    if (state === nextState) {
      return state;
    }
    state = nextState;
    stateEnteredAtMs = nowMs;
    if (!observedStates.includes(nextState)) {
      observedStates.push(nextState);
    }
    return state;
  }

  function advance(_deltaMs: number, nowMs = stateEnteredAtMs): RuntimePetState {
    const elapsedMs = Math.max(0, nowMs - stateEnteredAtMs);
    if (state === "clicked" && elapsedMs >= timing.clickedMs) {
      return setState("waiting", nowMs);
    }
    if (state === "stopped" && elapsedMs >= timing.stoppedToWaitingMs) {
      return setState("waiting", nowMs);
    }
    if (state === "working" && elapsedMs >= timing.workingHoldMs) {
      return setState("waiting", nowMs);
    }
    return state;
  }

  return {
    advance,
    current: () => state,
    motion: (nextState, nowMs = stateEnteredAtMs) => {
      if (state === "clicked" || state === "working") {
        return state;
      }
      return setState(nextState, nowMs);
    },
    observed: () => [...observedStates],
    tap: (nowMs = stateEnteredAtMs) => setState("clicked", nowMs),
    working: (nowMs = stateEnteredAtMs) => setState("working", nowMs)
  };
}

export function runtimePetStateClass(state: RuntimePetState): string {
  return `runtime-state-${state}`;
}

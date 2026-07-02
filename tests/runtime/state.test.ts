import { describe, expect, test } from "vitest";
import {
  RUNTIME_PET_STATE_TIMING,
  createRuntimePetStateMachine,
  runtimePetStateClass,
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

    machine.motion("approaching", 1000);
    expect(machine.current()).toBe("approaching");

    machine.motion("stopped", 1100);
    expect(machine.current()).toBe("stopped");

    machine.advance(RUNTIME_PET_STATE_TIMING.stoppedToWaitingMs - 1, 1100 + RUNTIME_PET_STATE_TIMING.stoppedToWaitingMs - 1);
    expect(machine.current()).toBe("stopped");

    machine.advance(1, 1100 + RUNTIME_PET_STATE_TIMING.stoppedToWaitingMs);
    expect(machine.current()).toBe("waiting");
  });

  test("keeps clicked visual state briefly before returning to waiting", () => {
    const machine = createRuntimePetStateMachine();

    machine.tap(2000);
    expect(machine.current()).toBe("clicked");

    machine.advance(RUNTIME_PET_STATE_TIMING.clickedMs - 1, 2000 + RUNTIME_PET_STATE_TIMING.clickedMs - 1);
    expect(machine.current()).toBe("clicked");

    machine.advance(1, 2000 + RUNTIME_PET_STATE_TIMING.clickedMs);
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

    machine.motion("approaching", 1000);
    machine.motion("stopped", 1100);
    machine.tap(1200);
    machine.working(1300);
    machine.motion("approaching", 1400);

    expect(machine.observed()).toEqual<RuntimePetState[]>([
      "waiting",
      "approaching",
      "stopped",
      "clicked",
      "working"
    ]);
  });
});

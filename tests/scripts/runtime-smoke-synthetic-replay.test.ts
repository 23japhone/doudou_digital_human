import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "vitest";
import {
  RUNTIME_SMOKE_SYNTHETIC_REPLAY_PLAN_ENV,
  createRuntimeSmokeSyntheticReplayPlan,
  hasRuntimeSmokeSyntheticReplayEvidence,
  serializeRuntimeSmokeSyntheticReplayPlan
} from "../../src/scripts/runtime-smoke-synthetic-replay.js";
import {
  createRuntimeSmokeProcessEnv,
  resolveRuntimeSmokeOptions
} from "../../src/scripts/runtime-smoke.js";
import {
  RUNTIME_INTERACTION_REPLAY_FIXTURE_IDS,
  hasPetInteractionReplayPrivacyLeak,
  type PetInteractionReplayFixture
} from "../../src/runtime/interaction-replay.js";
import {
  RUNTIME_SMOKE_SYNTHETIC_REPLAY_SCHEMA_VERSION,
  type RuntimeSmokeSyntheticReplayEvidence
} from "../../src/runtime/runtime-types.js";

const fixtureDir = path.join("fixtures", "runtime", "interaction_replay");

describe("runtime smoke synthetic replay adapter", () => {
  test("builds a sanitized renderer adapter plan from committed replay fixtures", async () => {
    const fixtures = await readFixtures();

    const plan = createRuntimeSmokeSyntheticReplayPlan(fixtures);

    expect(plan).toMatchObject({
      enabled: true,
      fixtureIds: [...RUNTIME_INTERACTION_REPLAY_FIXTURE_IDS],
      schemaVersion: RUNTIME_SMOKE_SYNTHETIC_REPLAY_SCHEMA_VERSION
    });
    expect(plan.events.length).toBe(fixtures.reduce((total, fixture) => total + fixture.events.length, 0));
    expect(plan.events.map((event) => event.type)).toEqual(expect.arrayContaining([
      "poke",
      "motion_cue",
      "drag_started",
      "drag_ended",
      "scale_changed",
      "work_started",
      "work_ended",
      "cursor_alpha_entered",
      "quiet_tick"
    ]));
    expect(plan.events.every((event) => RUNTIME_INTERACTION_REPLAY_FIXTURE_IDS.includes(event.fixtureId))).toBe(true);
    expect(hasPetInteractionReplayPrivacyLeak(plan)).toBe(false);
  });

  test("rejects non-allowlisted fixture ids without echoing private values", async () => {
    const fixture = await readFixture("single-poke");
    fixture.id = "/Users/private/source.png";

    expect(() => createRuntimeSmokeSyntheticReplayPlan([fixture])).toThrow("invalid_fixture_schema");
  });

  test("validates DOM and IPC evidence against the synthetic replay plan", async () => {
    const plan = createRuntimeSmokeSyntheticReplayPlan(await readFixtures());
    const evidence: RuntimeSmokeSyntheticReplayEvidence = {
      appliedEventTypes: [
        "runtime_started",
        "poke",
        "motion_cue",
        "drag_started",
        "drag_ended",
        "scale_changed",
        "work_started",
        "work_ended"
      ],
      completed: true,
      domEventsDispatched: 2,
      enabled: true,
      eventCount: plan.events.length,
      fixtureIds: plan.fixtureIds,
      ipcEventsDispatched: 4,
      privacySanitized: true
    };

    expect(hasRuntimeSmokeSyntheticReplayEvidence(evidence, plan)).toBe(true);
    expect(hasRuntimeSmokeSyntheticReplayEvidence({
      ...evidence,
      domEventsDispatched: 0
    }, plan)).toBe(false);
    expect(hasRuntimeSmokeSyntheticReplayEvidence({
      ...evidence,
      ipcEventsDispatched: 0
    }, plan)).toBe(false);
    expect(hasRuntimeSmokeSyntheticReplayEvidence({
      ...evidence,
      appliedEventTypes: evidence.appliedEventTypes.filter((eventType) => eventType !== "work_started")
    }, plan)).toBe(false);
  });

  test("passes a serialized plan to Electron only when synthetic replay is enabled", async () => {
    const plan = createRuntimeSmokeSyntheticReplayPlan(await readFixtures());

    expect(resolveRuntimeSmokeOptions(["--synthetic-replay"], {})).toMatchObject({ syntheticReplay: true });
    expect(resolveRuntimeSmokeOptions([], { DOUDOU_RUNTIME_SMOKE_SYNTHETIC_REPLAY: "1" })).toMatchObject({
      syntheticReplay: true
    });
    expect(resolveRuntimeSmokeOptions([], {})).toMatchObject({ syntheticReplay: false });

    const enabledEnv = createRuntimeSmokeProcessEnv({
      baseEnv: {},
      runtimeUserDataDir: "/tmp/runtime-smoke-user-data",
      syntheticReplayPlan: plan
    });
    expect(enabledEnv[RUNTIME_SMOKE_SYNTHETIC_REPLAY_PLAN_ENV]).toBe(serializeRuntimeSmokeSyntheticReplayPlan(plan));

    const defaultEnv = createRuntimeSmokeProcessEnv({
      baseEnv: {},
      runtimeUserDataDir: "/tmp/runtime-smoke-user-data",
      syntheticReplayPlan: null
    });
    expect(defaultEnv[RUNTIME_SMOKE_SYNTHETIC_REPLAY_PLAN_ENV]).toBeUndefined();
  });
});

async function readFixtures(): Promise<PetInteractionReplayFixture[]> {
  const fileNames = (await readdir(fixtureDir)).filter((name) => name.endsWith(".json")).sort();
  const fixtures = await Promise.all(fileNames.map((fileName) => readFixture(fileName.replace(/\.json$/, ""))));
  return fixtures.sort((left, right) => fixtureSortIndex(left.id) - fixtureSortIndex(right.id));
}

async function readFixture(id: string): Promise<PetInteractionReplayFixture> {
  return JSON.parse(await readFile(path.join(fixtureDir, `${id}.json`), "utf8")) as PetInteractionReplayFixture;
}

function fixtureSortIndex(fixtureId: string): number {
  const index = RUNTIME_INTERACTION_REPLAY_FIXTURE_IDS.findIndex((candidate) => candidate === fixtureId);
  return index === -1 ? RUNTIME_INTERACTION_REPLAY_FIXTURE_IDS.length : index;
}

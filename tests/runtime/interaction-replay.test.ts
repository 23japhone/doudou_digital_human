import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "vitest";
import {
  PET_INTERACTION_REPLAY_SCHEMA_VERSION,
  RUNTIME_INTERACTION_REPLAY_FIXTURE_IDS,
  hasPetInteractionReplayPrivacyLeak,
  runPetInteractionReplay,
  type PetInteractionReplayFixture
} from "../../src/runtime/interaction-replay.js";
import { RUNTIME_EMOTION_MEMORY_CONFIG } from "../../src/runtime/reaction.js";

const fixtureDir = path.join("fixtures", "runtime", "interaction_replay");

describe("runtime interaction replay", () => {
  test("runs all committed interaction replay fixtures", async () => {
    const fixtures = await readFixtures();

    expect(fixtures.map((fixture) => fixture.id).sort()).toEqual([...RUNTIME_INTERACTION_REPLAY_FIXTURE_IDS].sort());
    for (const fixture of fixtures) {
      const result = runPetInteractionReplay(fixture);
      expect(result, fixture.id).toMatchObject({
        id: fixture.id,
        ok: true,
        failedChecks: []
      });
      expect(result.observed.passiveCursorMovedWindow, fixture.id).toBe(false);
      expect(result.observed.maxWariness, fixture.id).toBeGreaterThanOrEqual(0);
      expect(result.observed.maxWariness, fixture.id).toBeLessThanOrEqual(1);
      expect(result.trace.length, fixture.id).toBeGreaterThan(0);
      expect(result.trace.every((entry) => entry.presentation.schemaVersion === "doudou.pet-presentation-envelope.v0.1")).toBe(true);
      expect(result.trace.map((entry) => entry.presentation.reactionAct)).toEqual(result.trace.map((entry) => entry.reactionAct));
      expect(result.trace.map((entry) => entry.presentation.scenario)).toEqual(result.trace.map((entry) => entry.scenario));
      expect(result.trace.map((entry) => entry.presentation.emotionId)).toEqual(result.trace.map((entry) => entry.emotionId));
      expect(result.trace.every((entry) => entry.performancePlan.schemaVersion === "doudou.pet-performance-governor.v0.1")).toBe(true);
      expect(result.trace.every((entry) => entry.performancePlan.readabilityCatalogVersion === "doudou.pet-performance-readability-catalog.v0.1")).toBe(true);
      expect(result.trace.map((entry) => entry.performancePlan.readabilityEmotionId)).toEqual(
        result.trace.map((entry) => entry.presentation.emotionId)
      );
      expect(result.trace.map((entry) => entry.performancePlan.motionBudget)).toEqual(
        result.trace.map((entry) => entry.presentation.policy.motionBudget)
      );
    }
  });

  test("proves single poke stays short and does not become repeat-poke retreat", async () => {
    const result = runPetInteractionReplay(await readFixture("single-poke"));

    expect(result.observed.states).toContain("poked");
    expect(result.observed.states).not.toContain("retreating");
    expect(result.observed.states).not.toContain("watching");
    expect(result.observed.scenarios).toContain("tap");
    expect(result.observed.scenarios).not.toContain("repeat_poke_retreat");
    expect(result.observed.emotionIds).toContain("surprised");
    expect(result.observed.reactionActs).toContain("poke_pop");
    expect(result.observed.tapReactFrameObserved).toBe(true);
    expect(result.observed.maxWariness).toBeGreaterThan(0);
    expect(result.observed.maxWariness).toBeLessThan(RUNTIME_EMOTION_MEMORY_CONFIG.waryDodgeThreshold);
    expect(result.final.state).toBe("waiting");
  });

  test("proves repeat poke retreats, watches, and then quiet recovery settles", async () => {
    const repeatResult = runPetInteractionReplay(await readFixture("repeat-poke-retreat-watch"));
    const recoveryResult = runPetInteractionReplay(await readFixture("quiet-recovery"));

    expect(repeatResult.observed.maxWariness).toBeGreaterThanOrEqual(RUNTIME_EMOTION_MEMORY_CONFIG.waryDodgeThreshold);
    expect(repeatResult.observed.motionPhases).toEqual(expect.arrayContaining(["retreating", "watching"]));
    expect(repeatResult.observed.states).toEqual(expect.arrayContaining(["retreating", "watching"]));
    expect(repeatResult.observed.scenarios).toEqual(expect.arrayContaining(["repeat_poke_retreat", "repeat_poke_watch"]));
    expect(repeatResult.observed.emotionIds).toEqual(expect.arrayContaining(["annoyed_pout", "teary"]));

    expect(recoveryResult.observed.motionPhases).toContain("recovering");
    expect(recoveryResult.observed.motionPhases).toContain("settled");
    expect(recoveryResult.observed.scenarios).toContain("quiet_recovery");
    expect(recoveryResult.observed.emotionIds).toContain("comfort_soft");
    expect(recoveryResult.observed.reactionActs).toContain("quiet_recovery");
    expect(recoveryResult.final.state).toBe("waiting");
    expect(recoveryResult.final.emotionId).toBe("calm_idle");
    expect(recoveryResult.final.wariness).toBeLessThan(0.2);
  });

  test("keeps drag, scale, and explicit work sessions in working without wariness or motion stealing", async () => {
    for (const fixtureId of ["working-drag", "working-scale", "working-session"] as const) {
      const result = runPetInteractionReplay(await readFixture(fixtureId));

      expect(result.observed.states, fixtureId).toContain("working");
      expect(result.observed.scenarios, fixtureId).toContain("working");
      expect(result.observed.emotionIds, fixtureId).toContain("focused_working");
      expect(result.observed.reactionActs, fixtureId).toContain("work_hold");
      expect(result.observed.maxWariness, fixtureId).toBe(0);
      expect(result.failedChecks, fixtureId).not.toContain("state_stolen_during_working");
      expect(result.final.state, fixtureId).toBe("waiting");
    }
  });

  test("lets explicit work-ended release working before the next motion cue", async () => {
    const result = runPetInteractionReplay(await readFixture("working-session"));

    expect(result.observed.states).toEqual(expect.arrayContaining(["working", "stopped"]));
    expect(result.observed.scenarios).toEqual(expect.arrayContaining(["working", "motion_stop"]));
    expect(result.observed.emotionIds).toEqual(expect.arrayContaining(["focused_working", "happy_smile"]));
    expect(result.observed.reactionActs).toEqual(expect.arrayContaining(["work_hold", "motion_stop_rebound"]));
    expect(result.failedChecks).not.toContain("state_stolen_during_working");
    expect(result.final.state).toBe("waiting");
  });

  test("keeps replay fixtures and results privacy-safe", async () => {
    const fixtures = await readFixtures();
    const results = fixtures.map((fixture) => runPetInteractionReplay(fixture));

    expect(hasPetInteractionReplayPrivacyLeak(fixtures)).toBe(false);
    expect(hasPetInteractionReplayPrivacyLeak(results)).toBe(false);
    expect(results.every((result) => result.ok)).toBe(true);
  });

  test("rejects invalid fixture schema with a fixed failure code", () => {
    const nonMonotonicResult = runPetInteractionReplay({
      schemaVersion: PET_INTERACTION_REPLAY_SCHEMA_VERSION,
      id: "invalid-order",
      titleZh: "无效顺序",
      initial: { atMs: 0, state: "waiting", wariness: 0 },
      events: [
        { atMs: 200, target: "runtime", type: "assert_trace" },
        { atMs: 100, target: "runtime", type: "assert_trace" }
      ],
      expect: {
        privacySanitized: true
      }
    });

    expect(nonMonotonicResult.ok).toBe(false);
    expect(nonMonotonicResult.failedChecks).toContain("invalid_fixture_schema");

    const unsupportedInitialStateResult = runPetInteractionReplay({
      schemaVersion: PET_INTERACTION_REPLAY_SCHEMA_VERSION,
      id: "invalid-initial-state",
      titleZh: "无效初始状态",
      initial: { atMs: 0, state: "working", wariness: 0 },
      events: [{ atMs: 100, target: "runtime", type: "runtime_started" }],
      expect: {
        privacySanitized: true
      }
    });

    expect(unsupportedInitialStateResult.ok).toBe(false);
    expect(unsupportedInitialStateResult.failedChecks).toContain("invalid_fixture_schema");
  });
});

async function readFixtures(): Promise<PetInteractionReplayFixture[]> {
  const fileNames = (await readdir(fixtureDir)).filter((name) => name.endsWith(".json")).sort();
  return Promise.all(fileNames.map((fileName) => readFixture(fileName.replace(/\.json$/, ""))));
}

async function readFixture(id: string): Promise<PetInteractionReplayFixture> {
  const fixturePath = path.join(fixtureDir, `${id}.json`);
  return JSON.parse(await readFile(fixturePath, "utf8")) as PetInteractionReplayFixture;
}

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  PET_INTERACTION_REPLAY_SCHEMA_VERSION,
  RUNTIME_INTERACTION_REPLAY_FIXTURE_IDS,
  hasPetInteractionReplayPrivacyLeak,
  runPetInteractionReplay,
  type PetInteractionReplayFailureCode,
  type PetInteractionReplayFixture,
  type PetInteractionReplayFixtureId
} from "../runtime/interaction-replay.js";
import type {
  DefaultDoudouEmotionId,
  DefaultDoudouEmotionScenario
} from "../runtime/default-doudou-emotions.js";
import type { RuntimeEmotionMotionPhase } from "../runtime/reaction.js";
import type { RuntimePetState } from "../runtime/state.js";
import type { PetReactionAct } from "../runtime/interaction-replay.js";

export const RUNTIME_INTERACTION_REPLAY_OUTPUT_PREFIX = "runtime replay: ";

export interface RuntimeInteractionReplaySuiteOptions {
  cwd?: string;
  fixtureDir?: string;
}

export interface RuntimeInteractionReplayFailedFixture {
  failedChecks: PetInteractionReplayFailureCode[];
  id: string;
}

export interface RuntimeInteractionReplaySummary {
  expectedFixtureIds: PetInteractionReplayFixtureId[];
  failedFixtures: RuntimeInteractionReplayFailedFixture[];
  fixtureCount: number;
  fixtureIds: string[];
  observed: {
    emotionIds: DefaultDoudouEmotionId[];
    maxWariness: number;
    motionPhases: RuntimeEmotionMotionPhase[];
    passiveCursorMovedWindow: boolean;
    reactionActs: PetReactionAct[];
    scenarios: DefaultDoudouEmotionScenario[];
    stateStolenDuringWorking: boolean;
    states: RuntimePetState[];
    tapReactFrameObserved: boolean;
  };
  ok: boolean;
  privacySanitized: boolean;
  schemaVersion: typeof PET_INTERACTION_REPLAY_SCHEMA_VERSION;
}

export async function runRuntimeInteractionReplaySuite(
  options: RuntimeInteractionReplaySuiteOptions = {}
): Promise<RuntimeInteractionReplaySummary> {
  const fixtureDir = options.fixtureDir ?? path.join(options.cwd ?? process.cwd(), "fixtures/runtime/interaction_replay");
  let fixtures: PetInteractionReplayFixture[];
  try {
    fixtures = await readRuntimeInteractionReplayFixtures(fixtureDir);
  } catch {
    return createFixtureReadFailureSummary();
  }
  const results = fixtures.map((fixture) => runPetInteractionReplay(fixture));
  const rawFixtureIds = fixtures.map((fixture) => fixture.id);
  const failedFixtures = results
    .filter((result) => !result.ok)
    .map((result) => ({
      failedChecks: result.failedChecks,
      id: publicFixtureId(result.id)
    }));
  if (!hasExpectedFixtureIds(rawFixtureIds)) {
    failedFixtures.push({
      failedChecks: ["invalid_fixture_schema"],
      id: "fixture-id-set"
    });
  }

  const observed = {
    emotionIds: unique(results.flatMap((result) => result.observed.emotionIds)),
    maxWariness: Math.max(0, ...results.map((result) => result.observed.maxWariness)),
    motionPhases: unique(results.flatMap((result) => result.observed.motionPhases)),
    passiveCursorMovedWindow: results.some((result) => result.observed.passiveCursorMovedWindow),
    reactionActs: unique(results.flatMap((result) => result.observed.reactionActs)),
    scenarios: unique(results.flatMap((result) => result.observed.scenarios)),
    stateStolenDuringWorking: results.some((result) => result.observed.stateStolenDuringWorking),
    states: unique(results.flatMap((result) => result.observed.states)),
    tapReactFrameObserved: results.some((result) => result.observed.tapReactFrameObserved)
  };
  const summary: RuntimeInteractionReplaySummary = {
    expectedFixtureIds: [...RUNTIME_INTERACTION_REPLAY_FIXTURE_IDS],
    failedFixtures,
    fixtureCount: fixtures.length,
    fixtureIds: rawFixtureIds.map(publicFixtureId),
    observed,
    ok: failedFixtures.length === 0,
    privacySanitized: false,
    schemaVersion: PET_INTERACTION_REPLAY_SCHEMA_VERSION
  };
  summary.privacySanitized = !hasPetInteractionReplayPrivacyLeak({
    results,
    summary
  });
  if (!summary.privacySanitized) {
    summary.ok = false;
    summary.failedFixtures.push({
      failedChecks: ["trace_privacy_leak"],
      id: "privacy"
    });
  }
  return summary;
}

function createFixtureReadFailureSummary(): RuntimeInteractionReplaySummary {
  return {
    expectedFixtureIds: [...RUNTIME_INTERACTION_REPLAY_FIXTURE_IDS],
    failedFixtures: [{
      failedChecks: ["invalid_fixture_schema"],
      id: "fixture-read"
    }],
    fixtureCount: 0,
    fixtureIds: [],
    observed: {
      emotionIds: [],
      maxWariness: 0,
      motionPhases: [],
      passiveCursorMovedWindow: false,
      reactionActs: [],
      scenarios: [],
      stateStolenDuringWorking: false,
      states: [],
      tapReactFrameObserved: false
    },
    ok: false,
    privacySanitized: true,
    schemaVersion: PET_INTERACTION_REPLAY_SCHEMA_VERSION
  };
}

export function formatRuntimeInteractionReplaySummary(summary: RuntimeInteractionReplaySummary): string {
  return `${RUNTIME_INTERACTION_REPLAY_OUTPUT_PREFIX}${JSON.stringify(summary)}`;
}

async function readRuntimeInteractionReplayFixtures(fixtureDir: string): Promise<PetInteractionReplayFixture[]> {
  const fileNames = (await readdir(fixtureDir)).filter((fileName) => fileName.endsWith(".json")).sort();
  const fixtures = await Promise.all(fileNames.map(async (fileName) => {
    const fixture = JSON.parse(await readFile(path.join(fixtureDir, fileName), "utf8")) as PetInteractionReplayFixture;
    return fixture;
  }));
  return fixtures.sort((left, right) => fixtureSortIndex(left.id) - fixtureSortIndex(right.id));
}

function hasExpectedFixtureIds(fixtureIds: string[]): boolean {
  return (
    fixtureIds.length === RUNTIME_INTERACTION_REPLAY_FIXTURE_IDS.length &&
    RUNTIME_INTERACTION_REPLAY_FIXTURE_IDS.every((fixtureId, index) => fixtureIds[index] === fixtureId)
  );
}

function fixtureSortIndex(fixtureId: string): number {
  const index = RUNTIME_INTERACTION_REPLAY_FIXTURE_IDS.findIndex((candidate) => candidate === fixtureId);
  return index === -1 ? RUNTIME_INTERACTION_REPLAY_FIXTURE_IDS.length : index;
}

function publicFixtureId(fixtureId: string): string {
  return RUNTIME_INTERACTION_REPLAY_FIXTURE_IDS.includes(fixtureId as PetInteractionReplayFixtureId)
    ? fixtureId
    : "unknown-fixture";
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  void runRuntimeInteractionReplaySuite()
    .then((summary) => {
      console.log(formatRuntimeInteractionReplaySummary(summary));
      if (!summary.ok) {
        process.exitCode = 1;
      }
    })
    .catch(() => {
      console.log(formatRuntimeInteractionReplaySummary(createFixtureReadFailureSummary()));
      process.exitCode = 1;
    });
}

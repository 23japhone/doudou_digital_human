import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import {
  RUNTIME_INTERACTION_REPLAY_FIXTURE_IDS,
  hasPetInteractionReplayPrivacyLeak,
  type PetInteractionReplayFixture,
  type PetInteractionReplayFixtureId
} from "../runtime/interaction-replay.js";
import {
  RUNTIME_SMOKE_SYNTHETIC_REPLAY_PLAN_ENV,
  RUNTIME_SMOKE_SYNTHETIC_REPLAY_SCHEMA_VERSION,
  type RuntimeSmokeSyntheticReplayEvidence,
  type RuntimeSmokeSyntheticReplayEvent,
  type RuntimeSmokeSyntheticReplayPlan
} from "../runtime/runtime-types.js";

export { RUNTIME_SMOKE_SYNTHETIC_REPLAY_PLAN_ENV };

export async function createRuntimeSmokeSyntheticReplayPlanFromFixtureDir(
  fixtureDir: string
): Promise<RuntimeSmokeSyntheticReplayPlan> {
  const fileNames = (await readdir(fixtureDir)).filter((fileName) => fileName.endsWith(".json")).sort();
  const fixtures = await Promise.all(fileNames.map(async (fileName) =>
    JSON.parse(await readFile(path.join(fixtureDir, fileName), "utf8")) as PetInteractionReplayFixture
  ));
  return createRuntimeSmokeSyntheticReplayPlan(
    fixtures.sort((left, right) => fixtureSortIndex(left.id) - fixtureSortIndex(right.id))
  );
}

export function createRuntimeSmokeSyntheticReplayPlan(
  fixtures: PetInteractionReplayFixture[]
): RuntimeSmokeSyntheticReplayPlan {
  const fixtureIds = fixtures.map((fixture) => publicFixtureIdOrThrow(fixture.id));
  if (!hasExpectedFixtureIds(fixtureIds) || hasPetInteractionReplayPrivacyLeak(fixtures)) {
    throw new Error("invalid_fixture_schema");
  }
  const events: RuntimeSmokeSyntheticReplayEvent[] = fixtures.flatMap((fixture) => {
    const fixtureId = publicFixtureIdOrThrow(fixture.id);
    return fixture.events.map((event) => ({
      atMs: event.atMs,
      direction: event.direction,
      fixtureId,
      motionIntensity: event.motionIntensity,
      point: event.point,
      state: event.state,
      type: event.type
    }));
  });
  const plan: RuntimeSmokeSyntheticReplayPlan = {
    enabled: true,
    events,
    fixtureIds,
    schemaVersion: RUNTIME_SMOKE_SYNTHETIC_REPLAY_SCHEMA_VERSION
  };
  if (hasPetInteractionReplayPrivacyLeak(plan)) {
    throw new Error("invalid_fixture_schema");
  }
  return plan;
}

export function serializeRuntimeSmokeSyntheticReplayPlan(plan: RuntimeSmokeSyntheticReplayPlan): string {
  return JSON.stringify(plan);
}

export function hasRuntimeSmokeSyntheticReplayEvidence(
  evidence: RuntimeSmokeSyntheticReplayEvidence | undefined,
  plan: RuntimeSmokeSyntheticReplayPlan
): boolean {
  return Boolean(
    evidence &&
    evidence.enabled &&
    evidence.completed &&
    evidence.privacySanitized &&
    evidence.eventCount === plan.events.length &&
    evidence.domEventsDispatched > 0 &&
    evidence.ipcEventsDispatched > 0 &&
    hasSameFixtureIds(evidence.fixtureIds, plan.fixtureIds) &&
    ["poke", "motion_cue", "drag_started", "drag_ended", "scale_changed"].every((eventType) =>
      evidence.appliedEventTypes.includes(eventType as RuntimeSmokeSyntheticReplayEvent["type"])
    )
  );
}

function publicFixtureIdOrThrow(fixtureId: string): PetInteractionReplayFixtureId {
  if (RUNTIME_INTERACTION_REPLAY_FIXTURE_IDS.includes(fixtureId as PetInteractionReplayFixtureId)) {
    return fixtureId as PetInteractionReplayFixtureId;
  }
  throw new Error("invalid_fixture_schema");
}

function hasExpectedFixtureIds(fixtureIds: readonly PetInteractionReplayFixtureId[]): boolean {
  return (
    fixtureIds.length === RUNTIME_INTERACTION_REPLAY_FIXTURE_IDS.length &&
    RUNTIME_INTERACTION_REPLAY_FIXTURE_IDS.every((fixtureId, index) => fixtureIds[index] === fixtureId)
  );
}

function hasSameFixtureIds(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && right.every((fixtureId, index) => left[index] === fixtureId);
}

function fixtureSortIndex(fixtureId: string): number {
  const index = RUNTIME_INTERACTION_REPLAY_FIXTURE_IDS.findIndex((candidate) => candidate === fixtureId);
  return index === -1 ? RUNTIME_INTERACTION_REPLAY_FIXTURE_IDS.length : index;
}

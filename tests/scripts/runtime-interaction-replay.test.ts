import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import {
  RUNTIME_INTERACTION_REPLAY_OUTPUT_PREFIX,
  formatRuntimeInteractionReplaySummary,
  runRuntimeInteractionReplaySuite
} from "../../src/scripts/runtime-interaction-replay.js";
import {
  RUNTIME_SMOKE_REPLAY_OUTPUT_PREFIX,
  runRuntimeSmokeReplayPreflight
} from "../../src/scripts/runtime-smoke.js";
import {
  RUNTIME_INTERACTION_REPLAY_FIXTURE_IDS,
  hasPetInteractionReplayPrivacyLeak
} from "../../src/runtime/interaction-replay.js";

describe("runtime interaction replay script", () => {
  test("summarizes all committed replay fixtures for the standalone script", async () => {
    const summary = await runRuntimeInteractionReplaySuite();

    expect(summary).toMatchObject({
      ok: true,
      fixtureCount: RUNTIME_INTERACTION_REPLAY_FIXTURE_IDS.length,
      failedFixtures: [],
      privacySanitized: true,
      schemaVersion: "doudou.interaction-replay.v0.1"
    });
    expect(summary.fixtureIds).toEqual([...RUNTIME_INTERACTION_REPLAY_FIXTURE_IDS]);
    expect(summary.observed.states).toEqual(expect.arrayContaining(["waiting", "poked", "retreating", "watching", "working"]));
    expect(summary.observed.scenarios).toEqual(expect.arrayContaining([
      "idle",
      "tap",
      "repeat_poke_retreat",
      "repeat_poke_watch",
      "quiet_recovery",
      "working"
    ]));
    expect(summary.observed.emotionIds).toEqual(expect.arrayContaining([
      "calm_idle",
      "surprised",
      "annoyed_pout",
      "teary",
      "comfort_soft",
      "focused_working"
    ]));
    expect(summary.observed.maxWariness).toBeGreaterThan(0.5);
    expect(summary.observed.passiveCursorMovedWindow).toBe(false);
    expect(summary.observed.stateStolenDuringWorking).toBe(false);
    expect(hasPetInteractionReplayPrivacyLeak(summary)).toBe(false);
  });

  test("formats a stable sanitized CLI output line", async () => {
    const summary = await runRuntimeInteractionReplaySuite();
    const line = formatRuntimeInteractionReplaySummary(summary);

    expect(line.startsWith(RUNTIME_INTERACTION_REPLAY_OUTPUT_PREFIX)).toBe(true);
    expect(JSON.parse(line.slice(RUNTIME_INTERACTION_REPLAY_OUTPUT_PREFIX.length))).toMatchObject({
      ok: true,
      fixtureCount: 6,
      failedFixtures: []
    });
    expect(line).not.toContain("/Users/");
    expect(line).not.toContain("file://");
    expect(line).not.toContain("secret");
    expect(line).not.toContain("provider payload");
  });

  test("returns a sanitized failure summary when fixtures cannot be read", async () => {
    const missingFixtureDir = path.join(tmpdir(), `missing-runtime-replay-fixtures-${Date.now()}`);

    const summary = await runRuntimeInteractionReplaySuite({ fixtureDir: missingFixtureDir });

    expect(summary).toMatchObject({
      ok: false,
      fixtureCount: 0,
      fixtureIds: [],
      failedFixtures: [{
        failedChecks: ["invalid_fixture_schema"],
        id: "fixture-read"
      }],
      privacySanitized: true
    });
    expect(JSON.stringify(summary)).not.toContain(missingFixtureDir);
  });

  test("does not echo private-looking fixture ids in failure summaries", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "runtime-replay-fixture-id-test-"));
    try {
      const fixture = JSON.parse(
        await readFile(path.join("fixtures", "runtime", "interaction_replay", "single-poke.json"), "utf8")
      ) as Record<string, unknown>;
      fixture.id = "/Users/private/source.png";
      await writeFile(path.join(tempDir, "leaky-id.json"), `${JSON.stringify(fixture, null, 2)}\n`);

      const summary = await runRuntimeInteractionReplaySuite({ fixtureDir: tempDir });
      const serialized = JSON.stringify(summary);

      expect(summary.ok).toBe(false);
      expect(summary.fixtureIds).toEqual(["unknown-fixture"]);
      expect(summary.failedFixtures.every((fixtureFailure) => fixtureFailure.id !== "/Users/private/source.png")).toBe(true);
      expect(serialized).not.toContain("/Users/private/source.png");
      expect(serialized).not.toContain("source.png");
    } finally {
      await rm(tempDir, { force: true, recursive: true });
    }
  });

  test("exposes the same replay fixture gate through runtime smoke preflight", async () => {
    const summary = await runRuntimeSmokeReplayPreflight();

    expect(RUNTIME_SMOKE_REPLAY_OUTPUT_PREFIX).toBe("runtime smoke replay: ");
    expect(summary.ok).toBe(true);
    expect(summary.fixtureIds).toEqual([...RUNTIME_INTERACTION_REPLAY_FIXTURE_IDS]);
    expect(summary.failedFixtures).toEqual([]);
  });

  test("registers team scripts without replacing Electron runtime smoke evidence", async () => {
    const packageJson = JSON.parse(await readFile("package.json", "utf8")) as {
      scripts: Record<string, string>;
    };

    expect(packageJson.scripts["replay:runtime"]).toBe(
      "npm run build:main && node dist/src/scripts/runtime-interaction-replay.js"
    );
    expect(packageJson.scripts["smoke:runtime"]).toBe(
      "npm run build && NODE_OPTIONS= node dist/src/scripts/runtime-smoke.js"
    );
  });
});

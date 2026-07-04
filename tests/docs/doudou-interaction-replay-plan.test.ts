import { readFile } from "node:fs/promises";
import { describe, expect, test } from "vitest";

const specPath = "docs/DOUDOU_INTERACTION_REPLAY_PLAN.md";

const requiredSections = [
  "## 目标",
  "## 非目标",
  "## Fixture Schema",
  "## Trace 输出",
  "## 最小 Fixtures",
  "## 验收指标",
  "## Runner 实现建议",
  "## Review 清单"
];

const requiredFixtureIds = [
  "single-poke",
  "repeat-poke-retreat-watch",
  "quiet-recovery",
  "working-drag",
  "working-scale",
  "privacy-trace"
];

const requiredRuntimeTerms = [
  "PetInteractionTraceEntry",
  "PetInteractionReplayResult",
  "doudou.interaction-replay.v0.1",
  "poke_pop",
  "repeat_poke_retreat",
  "repeat_poke_watch",
  "quiet_recovery",
  "work_hold",
  "waryDodgeThreshold",
  "focused_working",
  "comfort_soft"
];

describe("doudou interaction replay plan", () => {
  test("defines the required replay plan sections", async () => {
    const markdown = await readSpec();

    for (const section of requiredSections) {
      expect(markdown).toContain(section);
    }
    expect(markdown).toContain("兜兜");
    expect(markdown).toContain("pet bundle v0.1");
  });

  test("covers every minimal replay fixture", async () => {
    const markdown = await readSpec();

    for (const fixtureId of requiredFixtureIds) {
      expect(markdown).toContain(`\`${fixtureId}\``);
      expect(markdown).toContain(`fixtures/runtime/interaction_replay/${fixtureId}.json`);
    }
  });

  test("keeps replay terms tied to the state bus contract", async () => {
    const markdown = await readSpec();

    for (const term of requiredRuntimeTerms) {
      expect(markdown).toContain(term);
    }
  });

  test("documents privacy-sensitive forbidden fields", async () => {
    const markdown = await readSpec();

    for (const forbiddenTerm of [
      "source path",
      "raw prompt",
      "provider payload",
      "token",
      "secret",
      "absolute path",
      "remote URL",
      "screen text",
      "window title"
    ]) {
      expect(markdown).toContain(forbiddenTerm);
    }
  });
});

async function readSpec(): Promise<string> {
  return readFile(specPath, "utf8");
}

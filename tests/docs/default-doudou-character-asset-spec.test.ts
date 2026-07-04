import { readFile } from "node:fs/promises";
import { describe, expect, test } from "vitest";
import { DEFAULT_DOUDOU_EMOTION_IDS } from "../../src/runtime/default-doudou-emotions.js";

const specPath = "docs/DEFAULT_DOUDOU_CHARACTER_ASSET_SPEC.md";
const requiredSections = [
  "## Scope",
  "## Character Identity",
  "## Visual Design Lock",
  "## Hair Specification",
  "## Outfit Specification",
  "## Expression Asset QA",
  "## Motion Asset QA",
  "## Bundle And Privacy Boundaries",
  "## Acceptance Checklist",
  "## Verification"
];
const requiredRuntimeScenarios = [
  "idle",
  "tap",
  "cursor_approach",
  "cursor_dodge",
  "repeat_poke_retreat",
  "repeat_poke_watch",
  "quiet_recovery",
  "motion_stop",
  "working"
];

describe("default doudou character asset spec", () => {
  test("defines the required anime digital-human asset sections", async () => {
    const markdown = await readSpec();

    for (const section of requiredSections) {
      expect(markdown).toContain(section);
    }
    expect(markdown).toContain("兜兜");
    expect(markdown).toContain("二次元数字人");
    expect(markdown).toContain("pet bundle v0.1");
    expect(markdown).toContain("128px");
    expect(markdown).toContain("256px");
  });

  test("covers hair, outfit, expression, motion, and safety QA requirements", async () => {
    const markdown = await readSpec();

    expect(markdown).toContain("棕色");
    expect(markdown).toContain("侧分刘海");
    expect(markdown).toContain("红色发饰");
    expect(markdown).toContain("黄色开衫");
    expect(markdown).toContain("深色水手领");
    expect(markdown).toContain("禁止猫耳");
    expect(markdown).toContain("禁止尾巴");
    expect(markdown).toContain("不性感化");
    expect(markdown).toContain("不幼态化");
    expect(markdown).toContain("source image");
    expect(markdown).toContain("raw prompt");
    expect(markdown).toContain("provider payload");
  });

  test("keeps every default emotion and runtime scenario tied to asset QA", async () => {
    const markdown = await readSpec();

    for (const emotionId of DEFAULT_DOUDOU_EMOTION_IDS) {
      expect(markdown).toContain(`\`${emotionId}\``);
    }
    for (const scenario of requiredRuntimeScenarios) {
      expect(markdown).toContain(`\`${scenario}\``);
    }
  });
});

async function readSpec(): Promise<string> {
  return readFile(specPath, "utf8");
}

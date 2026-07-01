import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "vitest";

const repoRoot = process.cwd();

const disallowedUiTextByFile: Record<string, string[]> = {
  "src/app/index.html": [
    "豆豆",
    "Doudou Pet Studio",
    "No image selected",
    "Select Image",
    ">Generation<",
    ">Mode<",
    ">Local<",
    ">Mock Cloud<",
    ">OpenAI Live<",
    "Not used",
    "I confirm this source image may be sent to the selected provider.",
    "Style Compare",
    ">Generate<",
    "QA Preview",
    ">Accept<",
    ">Launch<",
    ">Stop<",
    "Delete Draft",
    "Delete Accepted",
    "Pet workflow",
    "Workflow status",
    ">Source<",
    ">Generated<",
    ">Reviewed<",
    ">Accepted<",
    ">Launched<",
    "QA Checks",
    "Pet preview",
    "Developer style comparison",
    "Style Comparison",
    "Local stylizer comparison contact sheet",
    ">Preview<",
    "Generated pet preview",
    "Sprite Sheet",
    "Generated pet sprite sheet"
  ],
  "src/app/renderer.ts": [
    "\"No image selected\"",
    "\"none\"",
    "\"Not used\"",
    "\"Live disabled\"",
    "\"Configured\"",
    "\"Missing config\"",
    "\"Launched\"",
    "\"Source selected\"",
    "\"Generated\"",
    "\"Needs review\"",
    "\"Accepted\"",
    "\"Idle\"",
    "(default)",
    "local stylizer preview"
  ],
  "src/app/main.ts": [
    "豆豆",
    "title: \"Doudou Pet Studio\"",
    "title: \"Select source image\"",
    "name: \"Images\"",
    "\"Pet bundle validation failed.\"",
    "\"Unknown app error.\""
  ],
  "src/runtime/index.html": [
    "豆豆",
    "<html lang=\"en\">",
    "Doudou Pet Runtime",
    "desktop pet"
  ],
  "src/runtime/main.ts": [
    "label: \"Quit\""
  ]
};

describe("frontend localization", () => {
  test("keeps visible frontend labels in Chinese", async () => {
    for (const [file, labels] of Object.entries(disallowedUiTextByFile)) {
      const text = await readFile(path.join(repoRoot, file), "utf8");
      for (const label of labels) {
        expect(text, `${file} should not expose English UI label: ${label}`).not.toContain(label);
      }
    }
  });

  test("records Chinese frontend copy as a project rule", async () => {
    const agents = await readFile(path.join(repoRoot, "AGENTS.md"), "utf8");

    expect(agents).toContain("前端");
    expect(agents).toContain("中文");
  });

  test("uses 兜兜 in visible app and runtime titles", async () => {
    const appHtml = await readFile(path.join(repoRoot, "src/app/index.html"), "utf8");
    const appMain = await readFile(path.join(repoRoot, "src/app/main.ts"), "utf8");
    const runtimeHtml = await readFile(path.join(repoRoot, "src/runtime/index.html"), "utf8");

    expect(appHtml).toContain("兜兜桌宠工作台");
    expect(appMain).toContain("title: \"兜兜桌宠工作台\"");
    expect(runtimeHtml).toContain("兜兜桌宠运行时");
  });

  test("records the Doudou brand spelling as 兜兜", async () => {
    const agents = await readFile(path.join(repoRoot, "AGENTS.md"), "utf8");

    expect(agents).toContain("doudou");
    expect(agents).toContain("兜兜");
    expect(agents).toContain("豆豆");
  });
});

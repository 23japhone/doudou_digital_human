import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "vitest";

const repoRoot = process.cwd();

describe("frontend layout safeguards", () => {
  test("keeps Chinese app controls resilient to wrapping and narrow window heights", async () => {
    const css = await readFile(path.join(repoRoot, "src/app/styles.css"), "utf8");

    expect(css).toContain("white-space: normal;");
    expect(css).toContain("overflow-wrap: anywhere;");
    expect(css).toContain("overflow-y: auto;");
    expect(css).toContain("grid-auto-rows: minmax(40px, auto);");
    expect(css).toContain("grid-template-rows: repeat(5, auto);");
  });

  test("exposes the guided app visual QA command", async () => {
    const packageJson = JSON.parse(await readFile(path.join(repoRoot, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };

    expect(packageJson.scripts["qa:app:visual"]).toContain("app-visual-qa.js");
  });
});

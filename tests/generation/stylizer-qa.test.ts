import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { PNG } from "pngjs";
import { afterEach, describe, expect, test } from "vitest";
import { runStylizerQaCli } from "../../src/scripts/stylizer-qa.js";
import { runStylizerQaCorpus } from "../../src/generation/stylizer-qa.js";
import { validatePetBundle } from "../../src/pet_bundle/validate.js";

const tempDirs: string[] = [];
const fixedNow = new Date("2026-07-01T12:00:00.000Z");

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { force: true, recursive: true })));
});

describe("runStylizerQaCorpus", () => {
  test("writes a rights-safe visual QA corpus with tunable preset outputs", async () => {
    const workspace = await createTempDir();
    const outputDir = path.join(workspace, "stylizer-qa");

    const result = await runStylizerQaCorpus({ outputDir, now: fixedNow });

    expect(result.report.schemaVersion).toBe("stylizer-qa.v0.1");
    expect(result.report.createdAt).toBe(fixedNow.toISOString());
    expect(result.report.rightsSafe).toMatchObject({
      source: "project-owned synthetic geometric images",
      containsPersonalImage: false,
      containsExternalAsset: false
    });
    expect(result.report.presets.map((preset) => preset.id)).toEqual(["balanced", "soft_mask", "bold_edges"]);
    for (const preset of result.report.presets) {
      expect(preset.params).toHaveProperty("crop");
      expect(preset.params).toHaveProperty("mask");
      expect(preset.params).toHaveProperty("color");
      expect(preset.params).toHaveProperty("edge");
    }
    expect(result.report.cases.map((corpusCase) => corpusCase.id)).toEqual([
      "split_palette_square",
      "wide_letterbox",
      "tall_gradient",
      "transparent_cutout"
    ]);

    await expect(stat(result.reportPath)).resolves.toMatchObject({ isFile: expect.any(Function) });
    await expect(stat(result.contactSheetPath)).resolves.toMatchObject({ isFile: expect.any(Function) });
    const contactSheet = PNG.sync.read(await readFile(result.contactSheetPath));
    expect(contactSheet.width).toBe(1024);
    expect(contactSheet.height).toBe(1024);
    expect(hasNonTransparentPixel(contactSheet)).toBe(true);

    for (const corpusCase of result.report.cases) {
      await expect(stat(path.join(outputDir, corpusCase.source.path))).resolves.toMatchObject({ isFile: expect.any(Function) });
      expect(corpusCase.source.rightsSafe).toBe(true);
      expect(corpusCase.runs).toHaveLength(3);
      for (const run of corpusCase.runs) {
        await expect(validatePetBundle(path.join(outputDir, run.bundleDir))).resolves.toMatchObject({
          manifest: expect.objectContaining({
            privacy: {
              sourceImageStored: false,
              cloudGenerated: false
            }
          })
        });
        await expect(stat(path.join(outputDir, run.previewPath))).resolves.toMatchObject({ isFile: expect.any(Function) });
        await expect(stat(path.join(outputDir, run.atlasPath))).resolves.toMatchObject({ isFile: expect.any(Function) });
        expect(run.metrics.nonTransparentPixels).toBeGreaterThan(8000);
        expect(run.metrics.visibleBounds.width).toBeGreaterThan(80);
        expect(run.metrics.visibleBounds.height).toBeGreaterThan(100);
      }
    }

    const reportText = await readFile(result.reportPath, "utf8");
    expect(reportText).not.toContain(outputDir);
    expect(reportText).not.toContain("prompt");
    expect(reportText).not.toContain("rawResponse");
    expect(reportText).not.toContain("token");
    expect(reportText).not.toContain("secret");
  });

  test("preset variants produce different previews for batch tuning", async () => {
    const workspace = await createTempDir();
    const outputDir = path.join(workspace, "stylizer-qa");

    const result = await runStylizerQaCorpus({ outputDir, now: fixedNow });
    const firstCase = result.report.cases[0]!;
    const balanced = await readFile(path.join(outputDir, firstCase.runs.find((run) => run.presetId === "balanced")!.previewPath));
    const boldEdges = await readFile(path.join(outputDir, firstCase.runs.find((run) => run.presetId === "bold_edges")!.previewPath));

    expect(boldEdges.equals(balanced)).toBe(false);
  });
});

describe("runStylizerQaCli", () => {
  test("runs the corpus command and returns zero", async () => {
    const workspace = await createTempDir();
    const outputDir = path.join(workspace, "cli-stylizer-qa");

    const exitCode = await runStylizerQaCli(["node", "stylizer-qa", outputDir], { now: fixedNow });

    expect(exitCode).toBe(0);
    await expect(stat(path.join(outputDir, "stylizer-qa-report.json"))).resolves.toMatchObject({
      isFile: expect.any(Function)
    });
  });

  test("returns usage error without an output directory", async () => {
    const exitCode = await runStylizerQaCli(["node", "stylizer-qa"], { now: fixedNow });

    expect(exitCode).toBe(2);
  });
});

async function createTempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "stylizer-qa-test-"));
  tempDirs.push(dir);
  return dir;
}

function hasNonTransparentPixel(png: PNG): boolean {
  for (let index = 3; index < png.data.length; index += 4) {
    if (png.data[index] > 0) {
      return true;
    }
  }
  return false;
}

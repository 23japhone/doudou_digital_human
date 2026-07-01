import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { PNG } from "pngjs";
import { afterEach, describe, expect, test } from "vitest";
import { runStylizerQaCli } from "../../src/scripts/stylizer-qa.js";
import {
  evaluateDefaultParameterChangeEvidence,
  runStylizerQaCorpus,
  type StylizerManualScoringTemplate
} from "../../src/generation/stylizer-qa.js";
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
    expect(result.report.artifacts).toMatchObject({
      manualScoringChecklist: "manual-scoring-checklist.md",
      manualScoringTemplate: "manual-scoring-template.json"
    });
    await expect(stat(path.join(outputDir, "manual-scoring-checklist.md"))).resolves.toMatchObject({
      isFile: expect.any(Function)
    });
    await expect(stat(path.join(outputDir, "manual-scoring-template.json"))).resolves.toMatchObject({
      isFile: expect.any(Function)
    });

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

    const scoringTemplateText = await readFile(path.join(outputDir, "manual-scoring-template.json"), "utf8");
    const scoringTemplate = JSON.parse(scoringTemplateText) as StylizerManualScoringTemplate;
    expect(scoringTemplate).toMatchObject({
      schemaVersion: "stylizer-manual-score.v0.1",
      status: "needs_scoring",
      defaultParameterChangeGate: {
        candidateDefaultPresetId: null,
        approved: false,
        minimumAverageScore: 4,
        minimumDimensionScore: 3
      }
    });
    expect(scoringTemplate.dimensions.map((dimension) => dimension.id)).toEqual([
      "crop_fit",
      "mask_silhouette",
      "color_preservation",
      "edge_clarity",
      "pet_cuteness"
    ]);
    expect(scoringTemplate.entries).toHaveLength(result.report.cases.length * result.report.presets.length);
    for (const entry of scoringTemplate.entries) {
      expect(entry.scores).toEqual({
        crop_fit: null,
        mask_silhouette: null,
        color_preservation: null,
        edge_clarity: null,
        pet_cuteness: null
      });
      expect(entry.notes).toBe("");
      expect(entry.previewPath).toMatch(/^previews\//);
    }
    expect(scoringTemplateText).not.toContain(outputDir);
    expect(scoringTemplateText).not.toContain("prompt");
    expect(scoringTemplateText).not.toContain("rawResponse");
    expect(scoringTemplateText).not.toContain("token");
    expect(scoringTemplateText).not.toContain("secret");
    const checklistText = await readFile(path.join(outputDir, "manual-scoring-checklist.md"), "utf8");
    expect(checklistText).toContain("crop fit");
    expect(checklistText).toContain("mask silhouette");
    expect(checklistText).toContain("color preservation");
    expect(checklistText).toContain("edge clarity");
    expect(checklistText).toContain("pet cuteness");
    expect(checklistText).toContain("split_palette_square");
    expect(checklistText).toContain("bold_edges");
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

  test("requires completed manual scoring evidence before a preset can become the default", async () => {
    const workspace = await createTempDir();
    const outputDir = path.join(workspace, "stylizer-qa");
    const result = await runStylizerQaCorpus({ outputDir, now: fixedNow });
    const template = JSON.parse(
      await readFile(path.join(outputDir, "manual-scoring-template.json"), "utf8")
    ) as StylizerManualScoringTemplate;

    expect(evaluateDefaultParameterChangeEvidence(template, "bold_edges")).toMatchObject({
      ok: false,
      code: "SCORING_NOT_COMPLETE"
    });

    const completed = completeScores(template, "bold_edges", 4);
    expect(evaluateDefaultParameterChangeEvidence(completed, "bold_edges")).toMatchObject({
      ok: true,
      candidateDefaultPresetId: "bold_edges"
    });

    const weakEvidence = completeScores(template, "bold_edges", 2);
    expect(evaluateDefaultParameterChangeEvidence(weakEvidence, "bold_edges")).toMatchObject({
      ok: false,
      code: "SCORE_BELOW_THRESHOLD"
    });
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

function completeScores(
  template: StylizerManualScoringTemplate,
  candidateDefaultPresetId: string,
  score: number
): StylizerManualScoringTemplate {
  return {
    ...template,
    status: "scored",
    reviewer: "QA Reviewer",
    reviewedAt: "2026-07-01T12:30:00.000Z",
    defaultParameterChangeGate: {
      ...template.defaultParameterChangeGate,
      candidateDefaultPresetId,
      approved: true
    },
    entries: template.entries.map((entry) => ({
      ...entry,
      scores: {
        crop_fit: score,
        mask_silhouette: score,
        color_preservation: score,
        edge_clarity: score,
        pet_cuteness: score
      }
    }))
  };
}

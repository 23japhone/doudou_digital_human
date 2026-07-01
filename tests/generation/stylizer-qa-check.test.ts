import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  checkStylizerQaScoring,
  runStylizerQaCheckCli
} from "../../src/scripts/stylizer-qa-check.js";
import {
  STYLIZER_SCORE_DIMENSIONS,
  type StylizerManualScoringTemplate
} from "../../src/generation/stylizer-qa.js";

const tempDirs: string[] = [];
const fixedNowIso = "2026-07-01T12:00:00.000Z";

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { force: true, recursive: true })));
});

describe("checkStylizerQaScoring", () => {
  test("approves completed scoring evidence for the requested candidate preset", async () => {
    const workspace = await createTempDir();
    const scoringPath = path.join(workspace, "manual-scoring-template.json");
    await writeFile(scoringPath, JSON.stringify(completeScores(createTemplate(), "bold_edges", 4), null, 2));

    await expect(checkStylizerQaScoring({ scoringPath, candidatePresetId: "bold_edges" })).resolves.toMatchObject({
      ok: true,
      candidateDefaultPresetId: "bold_edges",
      averageScore: 4
    });
  });

  test("rejects incomplete scoring evidence without throwing", async () => {
    const workspace = await createTempDir();
    const scoringPath = path.join(workspace, "manual-scoring-template.json");
    await writeFile(scoringPath, JSON.stringify(createTemplate(), null, 2));

    await expect(checkStylizerQaScoring({ scoringPath, candidatePresetId: "bold_edges" })).resolves.toMatchObject({
      ok: false,
      code: "SCORING_NOT_COMPLETE"
    });
  });

  test("rejects invalid JSON with a stable sanitized error code", async () => {
    const workspace = await createTempDir();
    const scoringPath = path.join(workspace, "bad-scoring.json");
    await writeFile(scoringPath, "{ this is not json and should not echo sk-test-secret }");

    const result = await checkStylizerQaScoring({ scoringPath, candidatePresetId: "bold_edges" });

    expect(result).toMatchObject({
      ok: false,
      code: "SCORING_FILE_INVALID"
    });
    expect(JSON.stringify(result)).not.toContain(scoringPath);
    expect(JSON.stringify(result)).not.toContain("sk-test-secret");
  });

  test("rejects malformed scoring templates before evaluating scores", async () => {
    const workspace = await createTempDir();
    const scoringPath = path.join(workspace, "malformed-scoring.json");
    await writeFile(scoringPath, JSON.stringify({
      schemaVersion: "stylizer-manual-score.v0.1",
      status: "scored",
      reviewer: "QA Reviewer",
      reviewedAt: fixedNowIso,
      defaultParameterChangeGate: {
        candidateDefaultPresetId: "bold_edges",
        approved: true,
        minimumAverageScore: 4,
        minimumDimensionScore: 3
      },
      presets: [],
      cases: [],
      entries: []
    }));

    await expect(checkStylizerQaScoring({ scoringPath, candidatePresetId: "bold_edges" })).resolves.toMatchObject({
      ok: false,
      code: "SCORING_FILE_INVALID"
    });
  });

  test("rejects source-image fields and unsafe preview paths in scoring evidence", async () => {
    const workspace = await createTempDir();
    const withSourceUriPath = path.join(workspace, "source-uri-scoring.json");
    await writeFile(withSourceUriPath, JSON.stringify({
      ...completeScores(createTemplate(), "bold_edges", 5),
      sourceImageUri: "file:///Users/example/private-source.png"
    }, null, 2));

    const sourceUriResult = await checkStylizerQaScoring({
      scoringPath: withSourceUriPath,
      candidatePresetId: "bold_edges"
    });

    expect(sourceUriResult).toMatchObject({
      ok: false,
      code: "SCORING_FILE_INVALID"
    });
    expect(JSON.stringify(sourceUriResult)).not.toContain("private-source.png");

    const unsafePreviewPath = path.join(workspace, "unsafe-preview-scoring.json");
    const template = completeScores(createTemplate(), "bold_edges", 5);
    template.entries[0]!.previewPath = path.join(workspace, "preview.png");
    await writeFile(unsafePreviewPath, JSON.stringify(template, null, 2));

    await expect(checkStylizerQaScoring({
      scoringPath: unsafePreviewPath,
      candidatePresetId: "bold_edges"
    })).resolves.toMatchObject({
      ok: false,
      code: "SCORING_FILE_INVALID"
    });
  });
});

describe("runStylizerQaCheckCli", () => {
  test("returns zero and prints pass JSON for accepted candidate evidence", async () => {
    const workspace = await createTempDir();
    const scoringPath = path.join(workspace, "manual-scoring-template.json");
    await writeFile(scoringPath, JSON.stringify(completeScores(createTemplate(), "bold_edges", 5), null, 2));
    const consoleCapture = captureConsole();

    const exitCode = await runStylizerQaCheckCli(["node", "stylizer-qa-check", scoringPath, "bold_edges"]);

    expect(exitCode).toBe(0);
    expect(JSON.parse(consoleCapture.stdout.join("\n"))).toMatchObject({
      ok: true,
      candidateDefaultPresetId: "bold_edges",
      averageScore: 5
    });
    expect(consoleCapture.stderr).toEqual([]);
    expect(consoleCapture.stdout.join("\n")).not.toContain(scoringPath);
  });

  test("returns one and prints fail JSON for rejected candidate evidence", async () => {
    const workspace = await createTempDir();
    const scoringPath = path.join(workspace, "manual-scoring-template.json");
    await writeFile(scoringPath, JSON.stringify(createTemplate(), null, 2));
    const consoleCapture = captureConsole();

    const exitCode = await runStylizerQaCheckCli(["node", "stylizer-qa-check", scoringPath, "bold_edges"]);

    expect(exitCode).toBe(1);
    expect(JSON.parse(consoleCapture.stderr.join("\n"))).toMatchObject({
      ok: false,
      code: "SCORING_NOT_COMPLETE"
    });
    expect(consoleCapture.stdout).toEqual([]);
    expect(consoleCapture.stderr.join("\n")).not.toContain(scoringPath);
  });

  test("returns usage error when required arguments are missing", async () => {
    const consoleCapture = captureConsole();

    const exitCode = await runStylizerQaCheckCli(["node", "stylizer-qa-check"]);

    expect(exitCode).toBe(2);
    expect(consoleCapture.stderr.join("\n")).toContain("Usage: stylizer-qa-check");
  });
});

async function createTempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "stylizer-qa-check-test-"));
  tempDirs.push(dir);
  return dir;
}

function createTemplate(): StylizerManualScoringTemplate {
  const presets = [
    { id: "balanced", title: "Balanced default" },
    { id: "bold_edges", title: "Bolder edges and tighter posterization" }
  ];
  const cases = [
    { id: "split_palette_square", title: "Square split warm/cool palette" },
    { id: "wide_letterbox", title: "Wide source with horizontal bands" }
  ];

  return {
    schemaVersion: "stylizer-manual-score.v0.1",
    status: "needs_scoring",
    createdAt: fixedNowIso,
    reviewer: "",
    reviewedAt: null,
    dimensions: STYLIZER_SCORE_DIMENSIONS,
    defaultParameterChangeGate: {
      candidateDefaultPresetId: null,
      approved: false,
      minimumAverageScore: 4,
      minimumDimensionScore: 3
    },
    presets,
    cases,
    entries: cases.flatMap((corpusCase) => presets.map((preset) => ({
      caseId: corpusCase.id,
      presetId: preset.id,
      previewPath: `previews/${preset.id}-${corpusCase.id}.png`,
      scores: {
        crop_fit: null,
        mask_silhouette: null,
        color_preservation: null,
        edge_clarity: null,
        pet_cuteness: null
      },
      notes: ""
    })))
  };
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
    reviewedAt: fixedNowIso,
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

function captureConsole(): { stdout: string[]; stderr: string[] } {
  const stdout: string[] = [];
  const stderr: string[] = [];
  vi.spyOn(console, "log").mockImplementation((message?: unknown) => {
    stdout.push(String(message));
  });
  vi.spyOn(console, "error").mockImplementation((message?: unknown) => {
    stderr.push(String(message));
  });
  return { stdout, stderr };
}

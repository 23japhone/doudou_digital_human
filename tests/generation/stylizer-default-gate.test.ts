import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  runStylizerDefaultGateCli,
  shouldRunStylizerDefaultGate
} from "../../src/scripts/stylizer-default-gate.js";
import {
  STYLIZER_SCORE_DIMENSIONS,
  type StylizerManualScoringTemplate
} from "../../src/generation/stylizer-qa.js";

const tempDirs: string[] = [];
const fixedNowIso = "2026-07-01T12:00:00.000Z";
const defaultParamsPath = "src/generation/adapters/deterministic-stylized-png-adapter.ts";

afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { force: true, recursive: true })));
});

describe("shouldRunStylizerDefaultGate", () => {
  test("requires scoring only when default stylizer parameter files changed", () => {
    expect(shouldRunStylizerDefaultGate([defaultParamsPath])).toEqual({
      required: true,
      changedDefaultParameterFiles: [defaultParamsPath]
    });

    expect(shouldRunStylizerDefaultGate([
      "docs/TESTING.md",
      "src/generation/stylizer-qa.ts",
      "tests/generation/deterministic-stylized-png-adapter.test.ts"
    ])).toEqual({
      required: false,
      changedDefaultParameterFiles: []
    });
  });
});

describe("runStylizerDefaultGateCli", () => {
  test("skips without scoring arguments when default stylizer parameters did not change", async () => {
    const consoleCapture = captureConsole();

    const exitCode = await runStylizerDefaultGateCli([
      "node",
      "stylizer-default-gate",
      "--changed-file",
      "docs/TESTING.md"
    ]);

    expect(exitCode).toBe(0);
    expect(JSON.parse(consoleCapture.stdout.join("\n"))).toMatchObject({
      ok: true,
      code: "STYLIZER_DEFAULT_UNCHANGED"
    });
    expect(consoleCapture.stderr).toEqual([]);
  });

  test("fails with a usage error when default stylizer parameters changed without scoring evidence", async () => {
    const consoleCapture = captureConsole();

    const exitCode = await runStylizerDefaultGateCli([
      "node",
      "stylizer-default-gate",
      "--changed-file",
      defaultParamsPath
    ]);

    expect(exitCode).toBe(2);
    expect(JSON.parse(consoleCapture.stderr.join("\n"))).toMatchObject({
      ok: false,
      code: "SCORING_ARGUMENTS_REQUIRED",
      changedDefaultParameterFiles: [defaultParamsPath]
    });
    expect(consoleCapture.stdout).toEqual([]);
  });

  test("passes when changed default stylizer parameters have approved scoring evidence", async () => {
    const workspace = await createTempDir();
    const scoringPath = path.join(workspace, "manual-scoring-template.json");
    await writeFile(scoringPath, JSON.stringify(completeScores(createTemplate(), "bold_edges", 5), null, 2));
    const consoleCapture = captureConsole();

    const exitCode = await runStylizerDefaultGateCli([
      "node",
      "stylizer-default-gate",
      "--changed-file",
      defaultParamsPath,
      scoringPath,
      "bold_edges"
    ]);

    expect(exitCode).toBe(0);
    expect(JSON.parse(consoleCapture.stdout.join("\n"))).toMatchObject({
      ok: true,
      code: "STYLIZER_DEFAULT_GATE_PASSED",
      candidateDefaultPresetId: "bold_edges",
      averageScore: 5,
      changedDefaultParameterFiles: [defaultParamsPath]
    });
    expect(consoleCapture.stdout.join("\n")).not.toContain(scoringPath);
    expect(consoleCapture.stderr).toEqual([]);
  });

  test("accepts scoring evidence from environment variables for standard check scripts", async () => {
    const workspace = await createTempDir();
    const scoringPath = path.join(workspace, "manual-scoring-template.json");
    await writeFile(scoringPath, JSON.stringify(completeScores(createTemplate(), "bold_edges", 5), null, 2));
    vi.stubEnv("STYLIZER_SCORING_FILE", scoringPath);
    vi.stubEnv("STYLIZER_CANDIDATE_PRESET", "bold_edges");
    const consoleCapture = captureConsole();

    const exitCode = await runStylizerDefaultGateCli([
      "node",
      "stylizer-default-gate",
      "--changed-file",
      defaultParamsPath
    ]);

    expect(exitCode).toBe(0);
    expect(JSON.parse(consoleCapture.stdout.join("\n"))).toMatchObject({
      ok: true,
      code: "STYLIZER_DEFAULT_GATE_PASSED",
      candidateDefaultPresetId: "bold_edges",
      changedDefaultParameterFiles: [defaultParamsPath]
    });
    expect(consoleCapture.stdout.join("\n")).not.toContain(scoringPath);
  });

  test("fails when changed default stylizer parameters have incomplete scoring evidence", async () => {
    const workspace = await createTempDir();
    const scoringPath = path.join(workspace, "manual-scoring-template.json");
    await writeFile(scoringPath, JSON.stringify(createTemplate(), null, 2));
    const consoleCapture = captureConsole();

    const exitCode = await runStylizerDefaultGateCli([
      "node",
      "stylizer-default-gate",
      "--changed-file",
      defaultParamsPath,
      scoringPath,
      "bold_edges"
    ]);

    expect(exitCode).toBe(1);
    expect(JSON.parse(consoleCapture.stderr.join("\n"))).toMatchObject({
      ok: false,
      code: "SCORING_NOT_COMPLETE",
      changedDefaultParameterFiles: [defaultParamsPath]
    });
    expect(consoleCapture.stderr.join("\n")).not.toContain(scoringPath);
    expect(consoleCapture.stdout).toEqual([]);
  });
});

async function createTempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "stylizer-default-gate-test-"));
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

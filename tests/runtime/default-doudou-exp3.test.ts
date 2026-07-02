import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import { DEFAULT_DOUDOU_EMOTION_IDS } from "../../src/runtime/default-doudou-emotions.js";
import { doudouLive2DExpressionForEmotion } from "../../src/runtime/default-doudou-live2d.js";
import {
  DEFAULT_DOUDOU_EXP3_FIXTURE_DIR,
  exportDefaultDoudouLive2DExp3Directory,
  toDoudouLive2DExp3Json,
  validateDoudouLive2DExp3Directory
} from "../../src/runtime/default-doudou-exp3.js";
import { runDoudouLive2DExp3Cli } from "../../src/cli/doudou-live2d-exp3.js";

const tempDirs: string[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { force: true, recursive: true })));
});

describe("default doudou exp3 serialization", () => {
  test("serializes a Stage B expression spec into real Live2D exp3 fields only", () => {
    const exp3 = toDoudouLive2DExp3Json(doudouLive2DExpressionForEmotion("delighted"));

    expect(exp3).toEqual({
      Type: "Live2D Expression",
      FadeInTime: 0.28,
      FadeOutTime: 0.4,
      Parameters: [
        { Id: "ParamEyeLOpen", Value: 0.98, Blend: "Multiply" },
        { Id: "ParamEyeROpen", Value: 0.98, Blend: "Multiply" },
        { Id: "ParamEyeLSmile", Value: 0.74, Blend: "Add" },
        { Id: "ParamEyeRSmile", Value: 0.74, Blend: "Add" },
        { Id: "ParamEyeBallForm", Value: 0.24, Blend: "Add" },
        { Id: "ParamBrowLY", Value: 0.24, Blend: "Add" },
        { Id: "ParamBrowRY", Value: 0.24, Blend: "Add" },
        { Id: "ParamMouthForm", Value: 0.85, Blend: "Add" },
        { Id: "ParamMouthOpenY", Value: 0.42, Blend: "Add" },
        { Id: "ParamCheek", Value: 0.25, Blend: "Add" },
        { Id: "ParamDoudouSparkle", Value: 1, Blend: "Overwrite" }
      ]
    });
    expect(Object.keys(exp3).sort()).toEqual(["FadeInTime", "FadeOutTime", "Parameters", "Type"]);
  });

  test("matches the committed fixture snapshot for all default expressions", async () => {
    const validation = await validateDoudouLive2DExp3Directory(DEFAULT_DOUDOU_EXP3_FIXTURE_DIR);
    expect(validation).toEqual({
      ok: true,
      expressionCount: DEFAULT_DOUDOU_EMOTION_IDS.length,
      files: DEFAULT_DOUDOU_EMOTION_IDS.map((emotionId) => `expressions/doudou_${emotionId}.exp3.json`)
    });

    for (const emotionId of DEFAULT_DOUDOU_EMOTION_IDS) {
      const fixturePath = path.join(DEFAULT_DOUDOU_EXP3_FIXTURE_DIR, "expressions", `doudou_${emotionId}.exp3.json`);
      const fixtureJson = JSON.parse(await readFile(fixturePath, "utf8")) as unknown;
      expect(fixtureJson).toEqual(toDoudouLive2DExp3Json(doudouLive2DExpressionForEmotion(emotionId)));
    }
  });
});

describe("default doudou exp3 CLI", () => {
  test("exports and validates the complete default expression set", async () => {
    const outputDir = await createTempDir();
    const consoleCapture = captureConsole();

    const exportCode = await runDoudouLive2DExp3Cli(["node", "doudou-live2d-exp3", "export", outputDir]);
    const exportResult = JSON.parse(consoleCapture.stdout.join("\n")) as {
      ok: boolean;
      expressionCount: number;
      files: string[];
    };

    expect(exportCode).toBe(0);
    expect(exportResult).toEqual({
      ok: true,
      expressionCount: DEFAULT_DOUDOU_EMOTION_IDS.length,
      files: DEFAULT_DOUDOU_EMOTION_IDS.map((emotionId) => `expressions/doudou_${emotionId}.exp3.json`)
    });
    expect(consoleCapture.stderr).toEqual([]);
    expect(consoleCapture.stdout.join("\n")).not.toContain(outputDir);

    const validateCode = await runDoudouLive2DExp3Cli(["node", "doudou-live2d-exp3", "validate", outputDir]);
    const validateResult = JSON.parse(consoleCapture.stdout.at(-1) ?? "{}") as { ok: boolean };

    expect(validateCode).toBe(0);
    expect(validateResult.ok).toBe(true);
  });

  test("rejects malformed expression files with sanitized errors", async () => {
    const outputDir = await createTempDir();
    await exportDefaultDoudouLive2DExp3Directory(outputDir);
    await writeFile(
      path.join(outputDir, "expressions", "doudou_delighted.exp3.json"),
      JSON.stringify({ Type: "Live2D Expression", Parameters: [] }, null, 2)
    );
    const consoleCapture = captureConsole();

    const exitCode = await runDoudouLive2DExp3Cli(["node", "doudou-live2d-exp3", "validate", outputDir]);
    const result = JSON.parse(consoleCapture.stderr.join("\n")) as { ok: false; issues: string[] };

    expect(exitCode).toBe(1);
    expect(result.ok).toBe(false);
    expect(result.issues.join("\n")).toContain("doudou_delighted.exp3.json");
    expect(result.issues.join("\n")).not.toContain(outputDir);
    expect(consoleCapture.stdout).toEqual([]);
  });

  test("rejects unexpected expression files with sanitized errors", async () => {
    const outputDir = await createTempDir();
    await exportDefaultDoudouLive2DExp3Directory(outputDir);
    await writeFile(
      path.join(outputDir, "expressions", "doudou_legacy_extra.exp3.json"),
      JSON.stringify(toDoudouLive2DExp3Json(doudouLive2DExpressionForEmotion("delighted")), null, 2)
    );
    const consoleCapture = captureConsole();

    const exitCode = await runDoudouLive2DExp3Cli(["node", "doudou-live2d-exp3", "validate", outputDir]);
    const result = JSON.parse(consoleCapture.stderr.join("\n")) as { ok: false; issues: string[] };

    expect(exitCode).toBe(1);
    expect(result.ok).toBe(false);
    expect(result.issues.join("\n")).toContain("expressions/doudou_legacy_extra.exp3.json");
    expect(result.issues.join("\n")).not.toContain(outputDir);
    expect(consoleCapture.stdout).toEqual([]);
  });

  test("returns sanitized JSON when export cannot write to the target", async () => {
    const outputParent = await createTempDir();
    const blockedTarget = path.join(outputParent, "not-a-directory");
    await writeFile(blockedTarget, "blocked");
    const consoleCapture = captureConsole();

    const exitCode = await runDoudouLive2DExp3Cli(["node", "doudou-live2d-exp3", "export", blockedTarget]);
    const result = JSON.parse(consoleCapture.stderr.join("\n")) as { ok: false; issues: string[] };

    expect(exitCode).toBe(1);
    expect(result).toEqual({
      ok: false,
      issues: ["Unable to export default Doudou Live2D expressions."]
    });
    expect(consoleCapture.stderr.join("\n")).not.toContain(outputParent);
    expect(consoleCapture.stdout).toEqual([]);
  });

  test("returns usage errors for invalid commands", async () => {
    const consoleCapture = captureConsole();

    const exitCode = await runDoudouLive2DExp3Cli(["node", "doudou-live2d-exp3"]);

    expect(exitCode).toBe(2);
    expect(consoleCapture.stderr.join("\n")).toContain("Usage: doudou-live2d-exp3");
  });
});

async function createTempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "doudou-exp3-test-"));
  tempDirs.push(dir);
  return dir;
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

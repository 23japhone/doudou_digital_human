import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import { DEFAULT_DOUDOU_EMOTION_IDS } from "../../src/runtime/default-doudou-emotions.js";
import { validateDoudouLive2DExp3Directory } from "../../src/runtime/default-doudou-exp3.js";
import {
  prepareDoudouLive2DSampleModel,
  runPrepareDoudouLive2DSampleModelCli
} from "../../src/scripts/prepare-doudou-live2d-sample-model.js";

const tempDirs: string[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { force: true, recursive: true })));
});

describe("prepareDoudouLive2DSampleModel", () => {
  test("copies an official sample model into a default-doudou-shaped local model directory", async () => {
    const root = await createTempDir();
    const sdkDir = path.join(root, "CubismSdkForWeb");
    const outputDir = path.join(root, "local_live2d_models", "default-doudou-sample");
    await writeSyntheticSampleModel(sdkDir, "Mao");

    const result = await prepareDoudouLive2DSampleModel({
      outputDir,
      sampleName: "Mao",
      sdkDir
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected sample preparation to succeed");
    }
    expect(result).toEqual({
      ok: true,
      expressionCount: DEFAULT_DOUDOU_EMOTION_IDS.length,
      files: DEFAULT_DOUDOU_EMOTION_IDS.map((emotionId) => `expressions/doudou_${emotionId}.exp3.json`),
      model3Json: "default-doudou.model3.json",
      sampleName: "Mao",
      sourceModel3Json: "Mao.model3.json"
    });
    expect(JSON.stringify(result)).not.toContain(root);
    await expect(stat(path.join(outputDir, "default-doudou.model3.json"))).resolves.toMatchObject({ size: expect.any(Number) });
    await expect(stat(path.join(outputDir, "mao.moc3"))).resolves.toMatchObject({ size: expect.any(Number) });
    await expect(stat(path.join(outputDir, "textures", "texture_00.png"))).resolves.toMatchObject({
      size: expect.any(Number)
    });
    await expect(stat(path.join(outputDir, "expressions", "original.exp3.json"))).rejects.toThrow();

    const model3 = JSON.parse(await readFile(path.join(outputDir, "default-doudou.model3.json"), "utf8")) as {
      FileReferences: {
        Expressions: Array<{ File: string; Name: string }>;
      };
    };
    expect(model3.FileReferences.Expressions.map((expression) => expression.File)).toEqual(result.files);
    expect(model3.FileReferences.Expressions.map((expression) => expression.Name)).toHaveLength(
      DEFAULT_DOUDOU_EMOTION_IDS.length
    );
    await expect(validateDoudouLive2DExp3Directory(outputDir)).resolves.toMatchObject({
      ok: true,
      expressionCount: DEFAULT_DOUDOU_EMOTION_IDS.length
    });
  });
});

describe("prepareDoudouLive2DSampleModel CLI", () => {
  test("prints sanitized JSON for a prepared sample model", async () => {
    const root = await createTempDir();
    const sdkDir = path.join(root, "CubismSdkForWeb");
    const outputDir = path.join(root, "local_live2d_models", "default-doudou-sample");
    await writeSyntheticSampleModel(sdkDir, "Hiyori");
    const consoleCapture = captureConsole();

    const exitCode = await runPrepareDoudouLive2DSampleModelCli([
      "node",
      "prepare-doudou-live2d-sample-model",
      "--sdk-dir",
      sdkDir,
      "--sample",
      "Hiyori",
      "--out",
      outputDir
    ]);

    expect(exitCode).toBe(0);
    const result = JSON.parse(consoleCapture.stdout.join("\n")) as { ok: true; sampleName: string };
    expect(result.sampleName).toBe("Hiyori");
    expect(consoleCapture.stdout.join("\n")).not.toContain(root);
    expect(consoleCapture.stderr).toEqual([]);
  });

  test("rejects missing sample data without printing local paths", async () => {
    const root = await createTempDir();
    const consoleCapture = captureConsole();

    const exitCode = await runPrepareDoudouLive2DSampleModelCli([
      "node",
      "prepare-doudou-live2d-sample-model",
      "--sdk-dir",
      path.join(root, "CubismSdkForWeb"),
      "--sample",
      "MissingSample",
      "--out",
      path.join(root, "local_live2d_models", "default-doudou-sample")
    ]);

    expect(exitCode).toBe(1);
    expect(JSON.parse(consoleCapture.stderr.join("\n"))).toEqual({
      ok: false,
      reason: "sample_model_missing"
    });
    expect(consoleCapture.stderr.join("\n")).not.toContain(root);
    expect(consoleCapture.stdout).toEqual([]);
  });
});

async function createTempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "doudou-sample-model-test-"));
  tempDirs.push(dir);
  return dir;
}

async function writeSyntheticSampleModel(sdkDir: string, sampleName: string): Promise<void> {
  const sampleDir = path.join(sdkDir, "Samples", "Resources", sampleName);
  await mkdir(path.join(sampleDir, "textures"), { recursive: true });
  await mkdir(path.join(sampleDir, "expressions"), { recursive: true });
  await writeFile(path.join(sampleDir, "mao.moc3"), "synthetic moc");
  await writeFile(path.join(sampleDir, "textures", "texture_00.png"), "synthetic texture");
  await writeFile(
    path.join(sampleDir, "expressions", "original.exp3.json"),
    JSON.stringify({ Type: "Live2D Expression", Parameters: [] })
  );
  await writeFile(
    path.join(sampleDir, `${sampleName}.model3.json`),
    JSON.stringify({
      Version: 3,
      FileReferences: {
        Moc: "mao.moc3",
        Textures: ["textures/texture_00.png"],
        Expressions: [
          {
            Name: "original",
            File: "expressions/original.exp3.json"
          }
        ]
      }
    }, null, 2)
  );
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

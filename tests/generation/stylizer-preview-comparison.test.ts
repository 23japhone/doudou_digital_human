import { mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { PNG } from "pngjs";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  runStylizerPreviewComparison,
  runStylizerPreviewComparisonCli
} from "../../src/scripts/stylizer-preview-comparison.js";

const tempDirs: string[] = [];
const fixedNow = new Date("2026-07-01T12:00:00.000Z");

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { force: true, recursive: true })));
});

describe("runStylizerPreviewComparison", () => {
  test("writes three local stylizer previews and a privacy-safe report without copying the source image", async () => {
    const workspace = await createTempDir();
    const sourcePath = path.join(workspace, "private-source.png");
    const outputDir = path.join(workspace, "comparison");
    const normalizationTempRoot = path.join(workspace, "normalization");
    const sourceBytes = createSplitPngSource();
    await writeFile(sourcePath, sourceBytes);

    const result = await runStylizerPreviewComparison({
      sourceImagePath: sourcePath,
      outputDir,
      normalizationTempRoot,
      now: fixedNow
    });

    expect(result.report.schemaVersion).toBe("stylizer-preview-comparison.v0.1");
    expect(result.report.createdAt).toBe(fixedNow.toISOString());
    expect(result.report.source).toEqual({
      inputMime: "image/png",
      inputBytes: sourceBytes.length,
      width: 48,
      height: 48,
      sourceImageStored: false
    });
    expect(result.report.artifacts).toEqual({
      contactSheet: "contact-sheet.png",
      previewsDir: "previews"
    });
    expect(result.report.presets.map((preset) => preset.id)).toEqual(["balanced", "soft_mask", "bold_edges"]);
    expect(result.report.presets.find((preset) => preset.id === "bold_edges")).toMatchObject({
      currentDefault: true
    });
    expect(result.report.previews.map((preview) => preview.path)).toEqual([
      "previews/balanced.png",
      "previews/soft_mask.png",
      "previews/bold_edges.png"
    ]);

    await expect(stat(result.reportPath)).resolves.toMatchObject({ isFile: expect.any(Function) });
    await expect(stat(result.contactSheetPath)).resolves.toMatchObject({ isFile: expect.any(Function) });
    const contactSheet = PNG.sync.read(await readFile(result.contactSheetPath));
    expect(contactSheet.width).toBe(768);
    expect(contactSheet.height).toBe(256);
    expect(hasNonTransparentPixel(contactSheet)).toBe(true);

    for (const preview of result.report.previews) {
      const previewPng = PNG.sync.read(await readFile(path.join(outputDir, preview.path)));
      expect(previewPng.width).toBe(256);
      expect(previewPng.height).toBe(256);
      expect(hasNonTransparentPixel(previewPng)).toBe(true);
      expect(preview.metrics.nonTransparentPixels).toBeGreaterThan(8000);
      expect(preview.metrics.visibleBounds.width).toBeGreaterThan(80);
      expect(preview.metrics.visibleBounds.height).toBeGreaterThan(100);
    }
    const balanced = await readFile(path.join(outputDir, "previews/balanced.png"));
    const boldEdges = await readFile(path.join(outputDir, "previews/bold_edges.png"));
    expect(balanced.equals(boldEdges)).toBe(false);

    await expect(stat(path.join(outputDir, "private-source.png"))).rejects.toMatchObject({ code: "ENOENT" });
    await expect(readdir(normalizationTempRoot)).resolves.toEqual([]);

    const reportText = await readFile(result.reportPath, "utf8");
    expect(reportText).not.toContain(sourcePath);
    expect(reportText).not.toContain("private-source");
    expect(reportText).not.toContain("sourceImagePath");
    expect(reportText).not.toContain("prompt");
    expect(reportText).not.toContain("rawResponse");
    expect(reportText).not.toContain("token");
    expect(reportText).not.toContain("secret");
  });
});

describe("runStylizerPreviewComparisonCli", () => {
  test("runs the comparison command and returns zero", async () => {
    const workspace = await createTempDir();
    const sourcePath = path.join(workspace, "input.png");
    const outputDir = path.join(workspace, "cli-comparison");
    await writeFile(sourcePath, createSplitPngSource());
    const consoleCapture = captureConsole();

    const exitCode = await runStylizerPreviewComparisonCli([
      "node",
      "stylizer-preview-comparison",
      sourcePath,
      outputDir
    ], { now: fixedNow });

    expect(exitCode).toBe(0);
    const output = JSON.parse(consoleCapture.stdout.join("\n")) as {
      ok: boolean;
      report: string;
      contactSheet: string;
      presets: string[];
    };
    expect(output).toEqual({
      ok: true,
      report: "stylizer-preview-comparison-report.json",
      contactSheet: "contact-sheet.png",
      presets: ["balanced", "soft_mask", "bold_edges"]
    });
    await expect(stat(path.join(outputDir, "stylizer-preview-comparison-report.json"))).resolves.toMatchObject({
      isFile: expect.any(Function)
    });
    expect(consoleCapture.stdout.join("\n")).not.toContain(sourcePath);
  });

  test("returns usage error without a source image and output directory", async () => {
    const consoleCapture = captureConsole();

    const exitCode = await runStylizerPreviewComparisonCli(["node", "stylizer-preview-comparison"], {
      now: fixedNow
    });

    expect(exitCode).toBe(2);
    expect(consoleCapture.stderr.join("\n")).toContain("Usage: stylizer-preview-comparison");
  });
});

async function createTempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "stylizer-preview-comparison-test-"));
  tempDirs.push(dir);
  return dir;
}

function createSplitPngSource(): Buffer {
  const png = new PNG({ width: 48, height: 48 });
  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      const index = (png.width * y + x) << 2;
      if (x < png.width / 2) {
        png.data[index] = 230;
        png.data[index + 1] = 60;
        png.data[index + 2] = 50;
      } else {
        png.data[index] = 50;
        png.data[index + 1] = 210;
        png.data[index + 2] = 90;
      }
      png.data[index + 3] = 255;
    }
  }
  return PNG.sync.write(png);
}

function hasNonTransparentPixel(png: PNG): boolean {
  for (let index = 3; index < png.data.length; index += 4) {
    if (png.data[index] > 0) {
      return true;
    }
  }
  return false;
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

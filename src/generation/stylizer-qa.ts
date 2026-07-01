import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { PNG } from "pngjs";
import { validatePetBundle } from "../pet_bundle/validate.js";
import { generatePetBundleFromSource } from "./generate-pet.js";
import {
  createDeterministicStylizedPngAdapter,
  resolveDeterministicStylizerParams,
  type DeterministicStylizerParams,
  type DeterministicStylizerParamsInput
} from "./adapters/deterministic-stylized-png-adapter.js";

type Rgb = [number, number, number];

interface StylizerQaCorpusCase {
  id: string;
  title: string;
  width: number;
  height: number;
  draw(png: PNG): void;
}

export interface StylizerQaPreset {
  id: string;
  title: string;
  params: DeterministicStylizerParamsInput;
}

export interface StylizerQaReport {
  schemaVersion: "stylizer-qa.v0.1";
  createdAt: string;
  rightsSafe: {
    source: "project-owned synthetic geometric images";
    containsPersonalImage: false;
    containsExternalAsset: false;
  };
  artifacts: {
    contactSheet: string;
    columns: string[];
  };
  presets: Array<{
    id: string;
    title: string;
    params: DeterministicStylizerParams;
  }>;
  cases: StylizerQaCaseReport[];
}

export interface StylizerQaCaseReport {
  id: string;
  title: string;
  source: {
    path: string;
    width: number;
    height: number;
    rightsSafe: true;
  };
  runs: StylizerQaRunReport[];
}

export interface StylizerQaRunReport {
  presetId: string;
  bundleDir: string;
  previewPath: string;
  atlasPath: string;
  metrics: StylizerQaMetrics;
}

export interface StylizerQaMetrics {
  nonTransparentPixels: number;
  darkEdgePixels: number;
  visibleBounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface RunStylizerQaCorpusOptions {
  outputDir: string;
  now?: Date;
}

export interface RunStylizerQaCorpusResult {
  outputDir: string;
  reportPath: string;
  contactSheetPath: string;
  report: StylizerQaReport;
}

const CONTACT_SHEET_CELL_SIZE = 256;

export const STYLIZER_QA_PRESETS: StylizerQaPreset[] = [
  {
    id: "balanced",
    title: "Balanced default",
    params: {}
  },
  {
    id: "soft_mask",
    title: "Softer mask and warmer colors",
    params: {
      crop: { visibleBoundsPaddingPx: 8 },
      mask: { headRadiusX: 88, headRadiusY: 92, bodyRadiusX: 76, edgeFeather: 0.16, outlineRadiusPx: 2 },
      color: { saturation: 1.18, contrast: 1.02, brightness: 8, posterizeStep: 40 },
      edge: { weakThreshold: 40, strongThreshold: 68, weakMix: 0.22, strongMix: 0.52 }
    }
  },
  {
    id: "bold_edges",
    title: "Bolder edges and tighter posterization",
    params: {
      crop: { visibleBoundsPaddingPx: 18 },
      mask: { headRadiusX: 92, bodyRadiusX: 74, edgeFeather: 0.1, outlineRadiusPx: 4 },
      color: { saturation: 1.55, contrast: 1.16, brightness: 0, posterizeStep: 24 },
      edge: { weakThreshold: 18, strongThreshold: 24, weakMix: 0.48, strongMix: 0.88 }
    }
  }
];

const STYLIZER_QA_CORPUS: StylizerQaCorpusCase[] = [
  {
    id: "split_palette_square",
    title: "Square split warm/cool palette",
    width: 64,
    height: 64,
    draw(png) {
      forEachPixel(png, (x, y) => (x < png.width / 2 ? [230, 60, 50] : [50, 210, 90]), 255);
      fillCircle(png, 22, 22, 10, [255, 214, 86], 255);
      fillCircle(png, 44, 42, 9, [42, 130, 230], 255);
    }
  },
  {
    id: "wide_letterbox",
    title: "Wide source with horizontal bands",
    width: 256,
    height: 64,
    draw(png) {
      forEachPixel(png, (_x, y) => (y < png.height / 2 ? [40, 120, 230] : [255, 194, 64]), 255);
      fillCircle(png, 72, 32, 18, [255, 95, 95], 235);
      fillCircle(png, 184, 32, 18, [80, 220, 156], 235);
    }
  },
  {
    id: "tall_gradient",
    title: "Tall gradient portrait-like shape",
    width: 64,
    height: 256,
    draw(png) {
      forEachPixel(png, (x, y) => [
        82 + Math.round((y / (png.height - 1)) * 130),
        62 + Math.round((x / (png.width - 1)) * 118),
        220 - Math.round((y / (png.height - 1)) * 90)
      ], 255);
      fillCircle(png, 32, 70, 22, [248, 190, 132], 255);
      fillRect(png, 20, 110, 24, 94, [72, 196, 178], 255);
    }
  },
  {
    id: "transparent_cutout",
    title: "Transparent geometric cutout",
    width: 160,
    height: 160,
    draw(png) {
      fillCircle(png, 80, 72, 44, [242, 146, 78], 255);
      fillCircle(png, 56, 56, 16, [82, 176, 226], 255);
      fillCircle(png, 104, 56, 16, [144, 222, 118], 255);
      fillRect(png, 54, 106, 52, 28, [58, 72, 118], 255);
    }
  }
];

export async function runStylizerQaCorpus(options: RunStylizerQaCorpusOptions): Promise<RunStylizerQaCorpusResult> {
  const outputDir = path.resolve(options.outputDir);
  await prepareEmptyOutputDir(outputDir);
  await mkdir(path.join(outputDir, "sources"), { recursive: true });
  await mkdir(path.join(outputDir, "bundles"), { recursive: true });
  await mkdir(path.join(outputDir, "previews"), { recursive: true });
  await mkdir(path.join(outputDir, "atlases"), { recursive: true });

  const report: StylizerQaReport = {
    schemaVersion: "stylizer-qa.v0.1",
    createdAt: (options.now ?? new Date()).toISOString(),
    rightsSafe: {
      source: "project-owned synthetic geometric images",
      containsPersonalImage: false,
      containsExternalAsset: false
    },
    artifacts: {
      contactSheet: "contact-sheet.png",
      columns: ["source", ...STYLIZER_QA_PRESETS.map((preset) => preset.id)]
    },
    presets: STYLIZER_QA_PRESETS.map((preset) => ({
      id: preset.id,
      title: preset.title,
      params: resolveDeterministicStylizerParams(preset.params)
    })),
    cases: []
  };

  for (const corpusCase of STYLIZER_QA_CORPUS) {
    const sourceRelativePath = toReportPath(path.join("sources", `${corpusCase.id}.png`));
    const sourcePath = path.join(outputDir, sourceRelativePath);
    await writeFile(sourcePath, createSourceImage(corpusCase));
    const caseReport: StylizerQaCaseReport = {
      id: corpusCase.id,
      title: corpusCase.title,
      source: {
        path: sourceRelativePath,
        width: corpusCase.width,
        height: corpusCase.height,
        rightsSafe: true
      },
      runs: []
    };

    for (const preset of STYLIZER_QA_PRESETS) {
      const bundleDir = path.join(outputDir, "bundles", preset.id, corpusCase.id);
      await generatePetBundleFromSource({
        sourceImagePath: sourcePath,
        outputBundleDir: bundleDir,
        normalizationTempRoot: path.join(outputDir, ".normalization", preset.id, corpusCase.id),
        adapter: createDeterministicStylizedPngAdapter({ params: preset.params }),
        now: options.now
      });
      await validatePetBundle(bundleDir);

      const previewRelativePath = toReportPath(path.join("previews", `${preset.id}-${corpusCase.id}.png`));
      const atlasRelativePath = toReportPath(path.join("atlases", `${preset.id}-${corpusCase.id}.png`));
      const previewBytes = await readFile(path.join(bundleDir, "preview.png"));
      const atlasBytes = await readFile(path.join(bundleDir, "atlases", "main.png"));
      await writeFile(path.join(outputDir, previewRelativePath), previewBytes);
      await writeFile(path.join(outputDir, atlasRelativePath), atlasBytes);

      caseReport.runs.push({
        presetId: preset.id,
        bundleDir: toReportPath(path.relative(outputDir, bundleDir)),
        previewPath: previewRelativePath,
        atlasPath: atlasRelativePath,
        metrics: analyzePreview(PNG.sync.read(previewBytes))
      });
    }

    report.cases.push(caseReport);
  }

  const contactSheetPath = path.join(outputDir, "contact-sheet.png");
  await writeFile(contactSheetPath, await createContactSheet(outputDir, report));
  const reportPath = path.join(outputDir, "stylizer-qa-report.json");
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  await rm(path.join(outputDir, ".normalization"), { force: true, recursive: true });

  return {
    outputDir,
    reportPath,
    contactSheetPath,
    report
  };
}

async function prepareEmptyOutputDir(outputDir: string): Promise<void> {
  await mkdir(outputDir, { recursive: true });
  const entries = await readdir(outputDir);
  if (entries.length > 0) {
    throw new Error("Stylizer QA output directory must be empty.");
  }
}

function createSourceImage(corpusCase: StylizerQaCorpusCase): Buffer {
  const png = new PNG({ width: corpusCase.width, height: corpusCase.height });
  corpusCase.draw(png);
  return PNG.sync.write(png);
}

async function createContactSheet(outputDir: string, report: StylizerQaReport): Promise<Buffer> {
  const columns = report.artifacts.columns.length;
  const rows = report.cases.length;
  const sheet = new PNG({
    width: columns * CONTACT_SHEET_CELL_SIZE,
    height: rows * CONTACT_SHEET_CELL_SIZE
  });
  fillRect(sheet, 0, 0, sheet.width, sheet.height, [246, 248, 250], 255);

  for (let row = 0; row < report.cases.length; row += 1) {
    const corpusCase = report.cases[row]!;
    const y = row * CONTACT_SHEET_CELL_SIZE;
    blitScaled(PNG.sync.read(await readFile(path.join(outputDir, corpusCase.source.path))), sheet, 0, y);
    for (let runIndex = 0; runIndex < corpusCase.runs.length; runIndex += 1) {
      const run = corpusCase.runs[runIndex]!;
      const x = (runIndex + 1) * CONTACT_SHEET_CELL_SIZE;
      blitScaled(PNG.sync.read(await readFile(path.join(outputDir, run.previewPath))), sheet, x, y);
    }
  }

  drawGrid(sheet, columns, rows);
  return PNG.sync.write(sheet);
}

function analyzePreview(png: PNG): StylizerQaMetrics {
  let nonTransparentPixels = 0;
  let darkEdgePixels = 0;
  let minX = png.width;
  let minY = png.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      const index = (png.width * y + x) << 2;
      const alpha = png.data[index + 3] ?? 0;
      if (alpha <= 0) {
        continue;
      }
      nonTransparentPixels += 1;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      const luminance = (png.data[index] ?? 0) * 0.299 + (png.data[index + 1] ?? 0) * 0.587 + (png.data[index + 2] ?? 0) * 0.114;
      if (luminance < 80) {
        darkEdgePixels += 1;
      }
    }
  }

  return {
    nonTransparentPixels,
    darkEdgePixels,
    visibleBounds: maxX >= minX
      ? {
          x: minX,
          y: minY,
          width: maxX - minX + 1,
          height: maxY - minY + 1
        }
      : {
          x: 0,
          y: 0,
          width: 0,
          height: 0
        }
  };
}

function forEachPixel(png: PNG, rgbForPixel: (x: number, y: number) => Rgb, alpha: number): void {
  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      setPixel(png, x, y, rgbForPixel(x, y), alpha);
    }
  }
}

function fillCircle(png: PNG, centerX: number, centerY: number, radius: number, rgb: Rgb, alpha: number): void {
  for (let y = centerY - radius; y <= centerY + radius; y += 1) {
    for (let x = centerX - radius; x <= centerX + radius; x += 1) {
      const dx = x - centerX;
      const dy = y - centerY;
      if (dx * dx + dy * dy <= radius * radius) {
        setPixel(png, x, y, rgb, alpha);
      }
    }
  }
}

function fillRect(png: PNG, x: number, y: number, width: number, height: number, rgb: Rgb, alpha: number): void {
  for (let yy = y; yy < y + height; yy += 1) {
    for (let xx = x; xx < x + width; xx += 1) {
      setPixel(png, xx, yy, rgb, alpha);
    }
  }
}

function setPixel(png: PNG, x: number, y: number, rgb: Rgb, alpha: number): void {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height) {
    return;
  }
  const index = (png.width * y + x) << 2;
  png.data[index] = rgb[0];
  png.data[index + 1] = rgb[1];
  png.data[index + 2] = rgb[2];
  png.data[index + 3] = alpha;
}

function blitScaled(source: PNG, target: PNG, offsetX: number, offsetY: number): void {
  const scale = Math.min(CONTACT_SHEET_CELL_SIZE / source.width, CONTACT_SHEET_CELL_SIZE / source.height);
  const width = Math.max(1, Math.round(source.width * scale));
  const height = Math.max(1, Math.round(source.height * scale));
  const startX = offsetX + Math.floor((CONTACT_SHEET_CELL_SIZE - width) / 2);
  const startY = offsetY + Math.floor((CONTACT_SHEET_CELL_SIZE - height) / 2);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sourceX = Math.min(source.width - 1, Math.floor(x / scale));
      const sourceY = Math.min(source.height - 1, Math.floor(y / scale));
      const sourceIndex = (source.width * sourceY + sourceX) << 2;
      setPixel(target, startX + x, startY + y, [
        source.data[sourceIndex] ?? 0,
        source.data[sourceIndex + 1] ?? 0,
        source.data[sourceIndex + 2] ?? 0
      ], source.data[sourceIndex + 3] ?? 0);
    }
  }
}

function drawGrid(sheet: PNG, columns: number, rows: number): void {
  for (let column = 1; column < columns; column += 1) {
    fillRect(sheet, column * CONTACT_SHEET_CELL_SIZE - 1, 0, 2, sheet.height, [218, 225, 233], 255);
  }
  for (let row = 1; row < rows; row += 1) {
    fillRect(sheet, 0, row * CONTACT_SHEET_CELL_SIZE - 1, sheet.width, 2, [218, 225, 233], 255);
  }
}

function toReportPath(relativePath: string): string {
  return relativePath.split(path.sep).join("/");
}

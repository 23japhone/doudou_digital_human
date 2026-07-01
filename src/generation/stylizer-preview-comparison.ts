import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { PNG } from "pngjs";
import { validateSourceImage, type SourceImageInfo } from "../intake/source-image.js";
import {
  normalizeSourceImage,
  type NormalizedSourceImageHandle
} from "./normalization/source-normalizer.js";
import {
  STYLIZER_QA_PRESETS,
  type StylizerQaMetrics
} from "./stylizer-qa.js";
import { createDeterministicStylizedPngAdapter } from "./adapters/deterministic-stylized-png-adapter.js";

export interface RunStylizerPreviewComparisonOptions {
  sourceImagePath: string;
  outputDir: string;
  normalizationTempRoot?: string;
  now?: Date;
}

export interface RunStylizerPreviewComparisonResult {
  outputDir: string;
  reportPath: string;
  contactSheetPath: string;
  report: StylizerPreviewComparisonReport;
}

export interface StylizerPreviewComparisonReport {
  schemaVersion: "stylizer-preview-comparison.v0.1";
  createdAt: string;
  source: {
    inputMime: SourceImageInfo["mime"];
    inputBytes: number;
    width: number;
    height: number;
    sourceImageStored: false;
  };
  artifacts: {
    contactSheet: string;
    previewsDir: string;
  };
  presets: Array<{
    id: string;
    title: string;
    currentDefault: boolean;
  }>;
  previews: Array<{
    presetId: string;
    path: string;
    metrics: StylizerQaMetrics;
  }>;
}

export class StylizerPreviewComparisonError extends Error {
  readonly code:
    | "MISSING_SOURCE_IMAGE"
    | "MISSING_OUTPUT_DIR"
    | "OUTPUT_DIR_NOT_EMPTY";

  constructor(code: StylizerPreviewComparisonError["code"], message: string) {
    super(message);
    this.name = "StylizerPreviewComparisonError";
    this.code = code;
  }
}

export const STYLIZER_PREVIEW_COMPARISON_REPORT_PATH = "stylizer-preview-comparison-report.json";
export const STYLIZER_PREVIEW_COMPARISON_CONTACT_SHEET_PATH = "contact-sheet.png";

const PREVIEWS_DIR = "previews";
const CURRENT_DEFAULT_PRESET_ID = "bold_edges";
const CONTACT_SHEET_CELL_SIZE = 256;

export async function runStylizerPreviewComparison(
  options: RunStylizerPreviewComparisonOptions
): Promise<RunStylizerPreviewComparisonResult> {
  if (!options.sourceImagePath) {
    throw new StylizerPreviewComparisonError("MISSING_SOURCE_IMAGE", "A source image path is required.");
  }
  if (!options.outputDir) {
    throw new StylizerPreviewComparisonError("MISSING_OUTPUT_DIR", "An output directory is required.");
  }

  const sourceImage = await validateSourceImage(options.sourceImagePath);
  const outputDir = path.resolve(options.outputDir);
  await prepareEmptyOutputDir(outputDir);
  await mkdir(path.join(outputDir, PREVIEWS_DIR), { recursive: true });

  let normalizedSourceImage: NormalizedSourceImageHandle | null = null;
  const previews: StylizerPreviewComparisonReport["previews"] = [];
  try {
    normalizedSourceImage = await normalizeSourceImage({
      sourceImagePath: options.sourceImagePath,
      sourceImage,
      tempRoot: options.normalizationTempRoot
    });

    for (const preset of STYLIZER_QA_PRESETS) {
      const adapter = createDeterministicStylizedPngAdapter({ params: preset.params });
      const output = await adapter.generate({
        sourceImage,
        normalizedSourceImage: normalizedSourceImage.image
      });
      const previewPng = PNG.sync.read(output.previewPng);
      const previewPath = toReportPath(path.join(PREVIEWS_DIR, `${preset.id}.png`));
      await writeFile(path.join(outputDir, previewPath), output.previewPng);
      previews.push({
        presetId: preset.id,
        path: previewPath,
        metrics: analyzePreview(previewPng)
      });
    }
  } finally {
    await normalizedSourceImage?.cleanup();
  }

  const report: StylizerPreviewComparisonReport = {
    schemaVersion: "stylizer-preview-comparison.v0.1",
    createdAt: (options.now ?? new Date()).toISOString(),
    source: {
      inputMime: sourceImage.mime,
      inputBytes: sourceImage.bytes,
      width: sourceImage.width,
      height: sourceImage.height,
      sourceImageStored: false
    },
    artifacts: {
      contactSheet: STYLIZER_PREVIEW_COMPARISON_CONTACT_SHEET_PATH,
      previewsDir: PREVIEWS_DIR
    },
    presets: STYLIZER_QA_PRESETS.map((preset) => ({
      id: preset.id,
      title: preset.title,
      currentDefault: preset.id === CURRENT_DEFAULT_PRESET_ID
    })),
    previews
  };

  const contactSheetPath = path.join(outputDir, STYLIZER_PREVIEW_COMPARISON_CONTACT_SHEET_PATH);
  await writeFile(contactSheetPath, await createContactSheet(previews, outputDir));
  const reportPath = path.join(outputDir, STYLIZER_PREVIEW_COMPARISON_REPORT_PATH);
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);

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
    throw new StylizerPreviewComparisonError("OUTPUT_DIR_NOT_EMPTY", "Stylizer preview comparison output directory must be empty.");
  }
}

async function createContactSheet(previews: StylizerPreviewComparisonReport["previews"], outputDir: string): Promise<Buffer> {
  const sheet = new PNG({
    width: previews.length * CONTACT_SHEET_CELL_SIZE,
    height: CONTACT_SHEET_CELL_SIZE
  });
  fillRect(sheet, 0, 0, sheet.width, sheet.height, [246, 248, 250], 255);

  for (let index = 0; index < previews.length; index += 1) {
    const preview = previews[index]!;
    const png = PNG.sync.read(await readFile(path.join(outputDir, preview.path)));
    blit(png, sheet, index * CONTACT_SHEET_CELL_SIZE, 0);
  }
  drawGrid(sheet, previews.length);
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

function fillRect(png: PNG, x: number, y: number, width: number, height: number, rgb: [number, number, number], alpha: number): void {
  for (let yy = y; yy < y + height; yy += 1) {
    for (let xx = x; xx < x + width; xx += 1) {
      setPixel(png, xx, yy, rgb, alpha);
    }
  }
}

function blit(source: PNG, target: PNG, offsetX: number, offsetY: number): void {
  for (let y = 0; y < source.height; y += 1) {
    for (let x = 0; x < source.width; x += 1) {
      const sourceIndex = (source.width * y + x) << 2;
      const alpha = source.data[sourceIndex + 3] ?? 0;
      if (alpha <= 0) {
        continue;
      }
      setPixel(target, offsetX + x, offsetY + y, [
        source.data[sourceIndex] ?? 0,
        source.data[sourceIndex + 1] ?? 0,
        source.data[sourceIndex + 2] ?? 0
      ], alpha);
    }
  }
}

function drawGrid(sheet: PNG, columns: number): void {
  for (let column = 1; column < columns; column += 1) {
    fillRect(sheet, column * CONTACT_SHEET_CELL_SIZE - 1, 0, 2, sheet.height, [218, 225, 233], 255);
  }
}

function setPixel(png: PNG, x: number, y: number, rgb: [number, number, number], alpha: number): void {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height) {
    return;
  }
  const index = (png.width * y + x) << 2;
  png.data[index] = rgb[0];
  png.data[index + 1] = rgb[1];
  png.data[index + 2] = rgb[2];
  png.data[index + 3] = alpha;
}

function toReportPath(relativePath: string): string {
  return relativePath.split(path.sep).join("/");
}

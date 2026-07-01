import { pathToFileURL } from "node:url";
import {
  STYLIZER_PREVIEW_COMPARISON_CONTACT_SHEET_PATH,
  STYLIZER_PREVIEW_COMPARISON_REPORT_PATH,
  StylizerPreviewComparisonError,
  runStylizerPreviewComparison,
  type RunStylizerPreviewComparisonOptions
} from "../generation/stylizer-preview-comparison.js";
import { SourceImageIntakeError } from "../intake/source-image.js";
import { SourceImageNormalizationError } from "../generation/normalization/source-normalizer.js";

export { runStylizerPreviewComparison };
export type { StylizerPreviewComparisonReport } from "../generation/stylizer-preview-comparison.js";

export async function runStylizerPreviewComparisonCli(
  argv: string[],
  options: Pick<RunStylizerPreviewComparisonOptions, "now"> = {}
): Promise<number> {
  const sourceImagePath = argv[2];
  const outputDir = argv[3];
  if (!sourceImagePath || !outputDir || argv.length > 4) {
    console.error("Usage: stylizer-preview-comparison <source-image-path> <output-dir>");
    return 2;
  }

  try {
    const result = await runStylizerPreviewComparison({
      sourceImagePath,
      outputDir,
      now: options.now
    });
    console.log(JSON.stringify({
      ok: true,
      report: STYLIZER_PREVIEW_COMPARISON_REPORT_PATH,
      contactSheet: STYLIZER_PREVIEW_COMPARISON_CONTACT_SHEET_PATH,
      presets: result.report.presets.map((preset) => preset.id)
    }, null, 2));
    return 0;
  } catch (error) {
    if (
      error instanceof StylizerPreviewComparisonError ||
      error instanceof SourceImageIntakeError ||
      error instanceof SourceImageNormalizationError
    ) {
      console.error(JSON.stringify({
        ok: false,
        code: error.code,
        message: error.message
      }, null, 2));
      return 1;
    }
    console.error(JSON.stringify({
      ok: false,
      code: "STYLIZER_PREVIEW_COMPARISON_FAILED",
      message: "Stylizer preview comparison failed."
    }, null, 2));
    return 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  runStylizerPreviewComparisonCli(process.argv)
    .then((code) => {
      process.exitCode = code;
    })
    .catch(() => {
      console.error(JSON.stringify({
        ok: false,
        code: "STYLIZER_PREVIEW_COMPARISON_FAILED",
        message: "Stylizer preview comparison failed unexpectedly."
      }, null, 2));
      process.exitCode = 1;
    });
}

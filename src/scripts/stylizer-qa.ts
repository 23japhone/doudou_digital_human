import { pathToFileURL } from "node:url";
import { runStylizerQaCorpus, type RunStylizerQaCorpusOptions } from "../generation/stylizer-qa.js";

export async function runStylizerQaCli(
  argv: string[],
  options: Pick<RunStylizerQaCorpusOptions, "now"> = {}
): Promise<number> {
  const outputDir = argv[2];
  if (!outputDir) {
    console.error("Usage: stylizer-qa <output-dir>");
    return 2;
  }

  try {
    const result = await runStylizerQaCorpus({
      outputDir,
      now: options.now
    });
    console.log(JSON.stringify({
      ok: true,
      report: "stylizer-qa-report.json",
      contactSheet: "contact-sheet.png",
      cases: result.report.cases.length,
      presets: result.report.presets.map((preset) => preset.id)
    }, null, 2));
    return 0;
  } catch (error) {
    console.error(JSON.stringify({
      ok: false,
      message: error instanceof Error ? error.message : "Stylizer QA failed."
    }, null, 2));
    return 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  runStylizerQaCli(process.argv)
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    });
}

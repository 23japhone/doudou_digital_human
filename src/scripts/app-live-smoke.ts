import { pathToFileURL } from "node:url";
import { runGuidedAppSmoke } from "./app-smoke.js";

async function main(): Promise<void> {
  if (process.env.DOUDOU_ENABLE_OPENAI_LIVE !== "1" || !process.env.OPENAI_API_KEY) {
    console.log(
      JSON.stringify({
        skipped: true,
        reason: "Set DOUDOU_ENABLE_OPENAI_LIVE=1 and OPENAI_API_KEY to run the OpenAI live app smoke."
      })
    );
    return;
  }

  const result = await runGuidedAppSmoke({
    generationMode: "openai_live",
    sourceImagePath: resolveLiveSmokeSourceImage(process.argv, process.env)
  });
  console.log(`guided app live smoke: ${JSON.stringify(result)}`);
}

export function resolveLiveSmokeSourceImage(argv: string[], env: NodeJS.ProcessEnv): string | undefined {
  return readFlagValue(argv, "--source") ?? env.DOUDOU_APP_SMOKE_SOURCE_IMAGE;
}

function readFlagValue(argv: string[], flag: string): string | undefined {
  const index = argv.indexOf(flag);
  if (index === -1) {
    return undefined;
  }
  return argv[index + 1];
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  void main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}

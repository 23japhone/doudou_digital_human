import { pathToFileURL } from "node:url";
import { runGuidedAppSmoke } from "./app-smoke.js";

async function main(): Promise<void> {
  const sourceImagePath = resolveLiveSmokeSourceImage(process.argv, process.env);
  const skipReason = getLiveSmokeSkipReason(process.env, sourceImagePath);
  if (skipReason) {
    console.log(
      JSON.stringify({
        skipped: true,
        reason: skipReason
      })
    );
    return;
  }

  const result = await runGuidedAppSmoke({
    generationMode: "openai_live",
    sourceImagePath
  });
  console.log(`guided app live smoke: ${JSON.stringify(result)}`);
}

export function resolveLiveSmokeSourceImage(argv: string[], env: NodeJS.ProcessEnv): string | undefined {
  return readFlagValue(argv, "--source") ?? env.DOUDOU_APP_SMOKE_SOURCE_IMAGE;
}

export function getLiveSmokeSkipReason(env: NodeJS.ProcessEnv, sourceImagePath?: string): string | null {
  if (env.DOUDOU_ENABLE_OPENAI_LIVE !== "1" || !env.OPENAI_API_KEY) {
    return "Set DOUDOU_ENABLE_OPENAI_LIVE=1 and OPENAI_API_KEY to run the OpenAI live app smoke.";
  }
  if (sourceImagePath && env.DOUDOU_CONFIRM_SOURCE_UPLOAD !== "1") {
    return "Set DOUDOU_CONFIRM_SOURCE_UPLOAD=1 to upload an explicit source image in live smoke.";
  }
  return null;
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

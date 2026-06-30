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

  const result = await runGuidedAppSmoke({ generationMode: "openai_live" });
  console.log(`guided app live smoke: ${JSON.stringify(result)}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  void main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}

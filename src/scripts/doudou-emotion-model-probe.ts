import { pathToFileURL } from "node:url";
import {
  applyDoudouModelBehaviorCommandToRuntime,
  createDoudouLive2DBehaviorRuntimeTarget,
  queryDoudouEmotionModelBehavior,
  resolveDoudouEmotionModelBehaviorConfig
} from "../runtime/default-doudou-model-behavior-api.js";
import { DEFAULT_DOUDOU_EXP3_FIXTURE_DIR } from "../runtime/default-doudou-exp3.js";
import { loadDefaultDoudouLive2DPreviewLibrary } from "../runtime/default-doudou-live2d-preview.js";

export interface DoudouEmotionModelProbeOptions {
  env?: Partial<Record<string, string | undefined>>;
  fetch?: typeof fetch;
  nowMs?: number;
}

export interface DoudouEmotionModelProbeResult {
  exitCode: number;
  output: string;
}

export async function runDoudouEmotionModelProbe(
  options: DoudouEmotionModelProbeOptions = {}
): Promise<DoudouEmotionModelProbeResult> {
  const env = options.env ?? process.env;
  const config = resolveDoudouEmotionModelBehaviorConfig(env);
  if (!config.publicEvidence.configured) {
    return jsonResult(0, {
      skipped: true,
      providerConfig: config.publicEvidence,
      reason: "Set DOUDOU_EMOTION_MODEL_ENDPOINT, DOUDOU_EMOTION_MODEL_API_KEY, and DOUDOU_EMOTION_MODEL_ID to probe the 兜兜 emotion model."
    });
  }

  const behavior = await queryDoudouEmotionModelBehavior({
    apiKey: config.apiKey,
    endpoint: config.endpoint,
    fetch: options.fetch,
    input: {
      currentEmotionId: "calm_idle",
      runtimeStateLocked: false,
      safetyState: "clear",
      source: "llm",
      text: "今天做了一小步，想让兜兜给一个轻量、不打扰的情绪反馈。",
      userVisionConsent: false
    },
    model: config.model
  });

  if (!behavior.ok) {
    return jsonResult(1, {
      ok: false,
      code: behavior.code,
      providerConfig: config.publicEvidence
    });
  }

  const library = await loadDefaultDoudouLive2DPreviewLibrary(DEFAULT_DOUDOU_EXP3_FIXTURE_DIR);
  const runtimeTarget = createDoudouLive2DBehaviorRuntimeTarget({
    applyMotionCue: () => true,
    library,
    switchExpression: async (targetLibrary, emotionId) => Boolean(targetLibrary.byEmotion[emotionId])
  });
  const runtimeApply = await applyDoudouModelBehaviorCommandToRuntime({
    command: behavior.command,
    nowMs: options.nowMs ?? Date.now(),
    target: runtimeTarget
  });

  return jsonResult(runtimeApply.ok ? 0 : 1, {
    ok: runtimeApply.ok,
    command: behavior.command,
    decision: behavior.decision,
    provider: behavior.provider,
    providerConfig: config.publicEvidence,
    runtimeApply,
    runtimeTarget: {
      expressionCount: library.expressionCount,
      kind: "default_doudou_preview_library"
    }
  });
}

function jsonResult(exitCode: number, payload: Record<string, unknown>): DoudouEmotionModelProbeResult {
  return {
    exitCode,
    output: `${JSON.stringify(payload, null, 2)}\n`
  };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  runDoudouEmotionModelProbe()
    .then((result) => {
      process.stdout.write(result.output);
      process.exitCode = result.exitCode;
    })
    .catch((error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    });
}

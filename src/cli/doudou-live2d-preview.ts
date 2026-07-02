import { pathToFileURL } from "node:url";
import {
  DEFAULT_DOUDOU_EMOTION_IDS,
  type DefaultDoudouEmotionId
} from "../runtime/default-doudou-emotions.js";
import { type DoudouSafeModelIntent } from "../runtime/default-doudou-live2d.js";
import {
  applyDoudouLive2DArbitratedPreviewSwitch,
  createDoudouLive2DPreviewState,
  loadDefaultDoudouLive2DPreviewLibrary,
  switchDoudouLive2DPreviewExpression,
  type DoudouLive2DPreviewTransition
} from "../runtime/default-doudou-live2d-preview.js";

export async function runDoudouLive2DPreviewCli(argv: string[]): Promise<number> {
  const expressionsDir = argv[2];
  const fromEmotionId = argv[3];
  const toEmotionId = argv[4];
  if (!expressionsDir || !isDefaultDoudouEmotionId(fromEmotionId) || !isDefaultDoudouEmotionId(toEmotionId) || argv.length > 5) {
    console.error("Usage: doudou-live2d-preview <expressions-dir> <from-emotion-id> <to-emotion-id>");
    return 2;
  }

  try {
    const library = await loadDefaultDoudouLive2DPreviewLibrary(expressionsDir);
    const previewState = createDoudouLive2DPreviewState(library, fromEmotionId);
    const switchResult = switchDoudouLive2DPreviewExpression(library, previewState, toEmotionId, 0);
    const arbitrationResult = applyDoudouLive2DArbitratedPreviewSwitch(
      library,
      previewState,
      {
        source: "llm",
        intent: intentForEmotion(toEmotionId),
        suggestedEmotionId: toEmotionId,
        confidence: 0.99,
        reasonCode: "explicit_user_prompt",
        ttlMs: 8000
      },
      {
        currentEmotionId: fromEmotionId,
        runtimeStateLocked: false,
        safetyState: "clear",
        userVisionConsent: false
      },
      0
    );

    console.log(
      JSON.stringify(
        {
          ok: true,
          expressionCount: library.expressionCount,
          loadedExpressionFiles: library.loadRequests.map((request) => request.expressionFile),
          switch: summarizeTransition(switchResult.transition),
          arbitrationProbe: {
            accepted: arbitrationResult.decision.accepted,
            reason: arbitrationResult.decision.reason,
            emotionId: arbitrationResult.decision.emotionId,
            expressionFile: arbitrationResult.transition?.expressionFile ?? null,
            parameterCount: arbitrationResult.transition?.parameterCount ?? 0
          }
        },
        null,
        2
      )
    );
    return 0;
  } catch {
    console.error(
      JSON.stringify(
        {
          ok: false,
          issues: ["Unable to preview default Doudou Live2D expressions."]
        },
        null,
        2
      )
    );
    return 1;
  }
}

function summarizeTransition(transition: DoudouLive2DPreviewTransition): Omit<DoudouLive2DPreviewTransition, "cubismExpression"> {
  return {
    fromEmotionId: transition.fromEmotionId,
    toEmotionId: transition.toEmotionId,
    expressionFile: transition.expressionFile,
    expressionName: transition.expressionName,
    motionCue: transition.motionCue,
    startedAtMs: transition.startedAtMs,
    fadeInTime: transition.fadeInTime,
    fadeOutTime: transition.fadeOutTime,
    parameterCount: transition.parameterCount
  };
}

function intentForEmotion(emotionId: DefaultDoudouEmotionId): DoudouSafeModelIntent {
  if (emotionId === "happy_smile" || emotionId === "delighted") {
    return "celebrate_small_success";
  }
  if (emotionId === "curious_tilt") {
    return "curiosity_prompt";
  }
  if (emotionId === "sleepy") {
    return "low_energy_rest";
  }
  if (emotionId === "focused_working") {
    return "focus_companion";
  }
  if (emotionId === "shy_blush") {
    return "acknowledge_affection";
  }
  if (emotionId === "sad_soft" || emotionId === "teary" || emotionId === "comfort_soft") {
    return "soft_comfort";
  }
  return "offer_quiet_presence";
}

function isDefaultDoudouEmotionId(value: unknown): value is DefaultDoudouEmotionId {
  return typeof value === "string" && DEFAULT_DOUDOU_EMOTION_IDS.includes(value as DefaultDoudouEmotionId);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  runDoudouLive2DPreviewCli(process.argv)
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    });
}

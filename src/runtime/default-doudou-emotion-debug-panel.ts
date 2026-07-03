import { doudouLive2DExpressionForEmotion } from "./default-doudou-live2d.js";
import type {
  DoudouRuntimeEmotionBehaviorApplyResult,
  DoudouRuntimeEmotionBehaviorTriggerResult
} from "./default-doudou-emotion-trigger.js";

export type DoudouEmotionDebugPanelTone = "error" | "idle" | "pending" | "success" | "warning";

export interface DoudouEmotionDebugPanelStatus {
  details: string[];
  heading: string;
  tone: DoudouEmotionDebugPanelTone;
}

export interface CreateDoudouEmotionDebugPanelStatusInput {
  applyResult?: DoudouRuntimeEmotionBehaviorApplyResult | null;
  pending?: boolean;
  result?: DoudouRuntimeEmotionBehaviorTriggerResult | null;
}

export const DOUDOU_EMOTION_DEBUG_PANEL_SMOKE_TEXT =
  "我想让兜兜给一个轻快但不打扰的表情反馈。";

export function resolveDoudouEmotionDebugPanelEnabled(input: {
  env: Partial<Record<string, string | undefined>>;
  optionEnabled: boolean;
}): boolean {
  return input.optionEnabled || input.env.DOUDOU_EMOTION_TRIGGER_PANEL === "1";
}

export function resolveDoudouEmotionDebugPanelSmokeConsent(
  env: Partial<Record<string, string | undefined>>
): boolean {
  return env.DOUDOU_EMOTION_PANEL_SMOKE_CONSENT === "1";
}

export function isDoudouEmotionDebugPanelSmokeStatusSanitized(statusText: string): boolean {
  return ![
    DOUDOU_EMOTION_DEBUG_PANEL_SMOKE_TEXT,
    "应用：",
    "调用",
    "choices",
    "keep_current",
    "http",
    "模型",
    "命令",
    "Qwen",
    "sk-",
    "set_expression",
    "unit-test-model",
    "user_positive_text"
  ].some((blockedFragment) => statusText.includes(blockedFragment));
}

export function createDoudouEmotionDebugPanelStatus(
  input: CreateDoudouEmotionDebugPanelStatusInput = {}
): DoudouEmotionDebugPanelStatus {
  if (input.pending) {
    return {
      details: ["本次授权只用于这次回应"],
      heading: "兜兜在感受",
      tone: "pending"
    };
  }
  if (!input.result) {
    return {
      details: ["说一句想告诉兜兜的话"],
      heading: "兜兜在听",
      tone: "idle"
    };
  }
  if (!input.result.ok) {
    return {
      details: ["稍后再试一次"],
      heading: failureHeading(input.result.code),
      tone: "error"
    };
  }
  if (input.result.skipped) {
    return {
      details: skippedDetails(input.result.reason),
      heading: skippedHeading(input.result.reason),
      tone: input.result.reason === "empty_user_input" ? "idle" : "warning"
    };
  }
  if (input.result.command.kind === "keep_current") {
    return {
      details: ["兜兜会先安静陪着你"],
      heading: "兜兜先保持现在的状态",
      tone: "warning"
    };
  }

  const expression = doudouLive2DExpressionForEmotion(input.result.command.emotionId);
  if (input.applyResult?.ok === false) {
    return {
      details: ["稍后再试一次"],
      heading: "兜兜这次没切换成功",
      tone: "error"
    };
  }
  return {
    details: [
      `表情反馈：${expression.expressionName}`,
      "兜兜已经切换状态"
    ],
    heading: `兜兜回应了：${expression.expressionName}`,
    tone: "success"
  };
}

function skippedHeading(reason: "empty_user_input" | "user_consent_required"): string {
  return reason === "empty_user_input" ? "写一句想告诉兜兜的话" : "需要本次授权";
}

function skippedDetails(reason: "empty_user_input" | "user_consent_required"): string[] {
  return reason === "empty_user_input"
    ? ["兜兜需要先听到你的话"]
    : ["勾选本次授权后再告诉兜兜"];
}

function failureHeading(code: "model_output_invalid" | "provider_error" | "provider_not_configured"): string {
  if (code === "provider_not_configured") {
    return "兜兜暂时还不能回应";
  }
  return "兜兜这次没听清";
}

import {
  doudouLive2DExpressionForEmotion,
  type DoudouLive2DExpressionSpec
} from "./default-doudou-live2d.js";
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

export function resolveDoudouEmotionDebugPanelEnabled(input: {
  env: Partial<Record<string, string | undefined>>;
  optionEnabled: boolean;
}): boolean {
  return input.optionEnabled || input.env.DOUDOU_EMOTION_TRIGGER_PANEL === "1";
}

export function createDoudouEmotionDebugPanelStatus(
  input: CreateDoudouEmotionDebugPanelStatusInput = {}
): DoudouEmotionDebugPanelStatus {
  if (input.pending) {
    return {
      details: ["调用：等待中", "命令：等待中"],
      heading: "正在请求",
      tone: "pending"
    };
  }
  if (!input.result) {
    return {
      details: ["调用：未开始", "命令：无"],
      heading: "等待输入",
      tone: "idle"
    };
  }
  if (!input.result.ok) {
    return {
      details: [
        `调用：${input.result.provider.called ? "是" : "否"}`,
        ...(input.result.provider.called ? [`模型：${input.result.provider.model}`] : []),
        `错误：${failureCodeLabel(input.result.code)}`
      ],
      heading: "未应用表情",
      tone: "error"
    };
  }
  if (input.result.skipped) {
    return {
      details: [
        "调用：否",
        `原因：${skipReasonLabel(input.result.reason)}`,
        "命令：无"
      ],
      heading: skippedHeading(input.result.reason),
      tone: input.result.reason === "empty_user_input" ? "idle" : "warning"
    };
  }
  if (input.result.command.kind === "keep_current") {
    return {
      details: [
        `调用：${input.result.provider.called ? "是" : "否"}`,
        ...(input.result.provider.called ? [`模型：${input.result.provider.model}`] : []),
        "命令：keep_current",
        `原因：${keepCurrentReasonLabel(input.result.command.reason)}`,
        `应用：${applyResultLabel(input.applyResult)}`
      ],
      heading: "保持当前表情",
      tone: "warning"
    };
  }

  const expression = doudouLive2DExpressionForEmotion(input.result.command.emotionId);
  return {
    details: [
      `调用：${input.result.provider.called ? "是" : "否"}`,
      ...(input.result.provider.called ? [`模型：${input.result.provider.model}`] : []),
      "命令：set_expression",
      `表情：${expression.expressionName}`,
      `动作：${motionCueLabel(input.result.command.motionCue)}`,
      `应用：${applyResultLabel(input.applyResult)}`
    ],
    heading: `已触发：${expression.expressionName}`,
    tone: input.applyResult?.ok === false ? "error" : "success"
  };
}

function skippedHeading(reason: "empty_user_input" | "user_consent_required"): string {
  return reason === "empty_user_input" ? "请输入内容" : "未授权，模型未调用";
}

function skipReasonLabel(reason: "empty_user_input" | "user_consent_required"): string {
  return reason === "empty_user_input" ? "没有输入内容" : "需要勾选授权";
}

function failureCodeLabel(code: "model_output_invalid" | "provider_error" | "provider_not_configured"): string {
  if (code === "provider_not_configured") {
    return "模型未配置";
  }
  if (code === "provider_error") {
    return "模型调用失败";
  }
  return "模型输出无效";
}

function keepCurrentReasonLabel(reason: string): string {
  if (reason === "confidence_too_low") {
    return "置信度不足";
  }
  if (reason === "ttl_too_long") {
    return "持续时间过长";
  }
  if (reason === "runtime_state_locked") {
    return "运行状态锁定";
  }
  if (reason === "safety_blocked") {
    return "安全策略拦截";
  }
  if (reason === "vision_without_consent") {
    return "缺少视觉授权";
  }
  return "保持当前";
}

function motionCueLabel(motionCue: DoudouLive2DExpressionSpec["motionCue"]): string {
  if (motionCue === "small_pop") {
    return "轻快弹一下";
  }
  if (motionCue === "soft_breath") {
    return "轻轻呼吸";
  }
  if (motionCue === "short_retreat") {
    return "小退一步";
  }
  if (motionCue === "sleepy_sway") {
    return "困困摇晃";
  }
  return "无";
}

function applyResultLabel(result: DoudouRuntimeEmotionBehaviorApplyResult | null | undefined): string {
  if (!result) {
    return "未应用";
  }
  if (!result.ok) {
    return "应用失败";
  }
  return result.applied ? "已应用" : "未应用";
}

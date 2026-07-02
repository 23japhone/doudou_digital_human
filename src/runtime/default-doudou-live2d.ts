import {
  DEFAULT_DOUDOU_EMOTION_IDS,
  type DefaultDoudouEmotionId
} from "./default-doudou-emotions.js";

export type DoudouLive2DBlendMode = "Add" | "Multiply" | "Overwrite";

export type DoudouLive2DStandardParameterId =
  | "ParamAngleX"
  | "ParamAngleY"
  | "ParamAngleZ"
  | "ParamEyeLOpen"
  | "ParamEyeROpen"
  | "ParamEyeLSmile"
  | "ParamEyeRSmile"
  | "ParamEyeBallX"
  | "ParamEyeBallY"
  | "ParamEyeBallForm"
  | "ParamBrowLY"
  | "ParamBrowRY"
  | "ParamBrowLAngle"
  | "ParamBrowRAngle"
  | "ParamBrowLForm"
  | "ParamBrowRForm"
  | "ParamMouthForm"
  | "ParamMouthOpenY"
  | "ParamCheek"
  | "ParamBodyAngleX"
  | "ParamBodyAngleY"
  | "ParamBodyAngleZ"
  | "ParamBreath";

export type DoudouLive2DCustomParameterId =
  | "ParamDoudouSparkle"
  | "ParamDoudouTear"
  | "ParamDoudouSleepBubble";

export type DoudouLive2DParameterId = DoudouLive2DStandardParameterId | DoudouLive2DCustomParameterId;

export interface DoudouLive2DParameterTarget {
  id: DoudouLive2DParameterId;
  value: number;
  blend: DoudouLive2DBlendMode;
  noteZh: string;
}

export interface DoudouLive2DExpressionSpec {
  emotionId: DefaultDoudouEmotionId;
  type: "Live2D Expression";
  expressionName: string;
  expressionFile: `expressions/doudou_${DefaultDoudouEmotionId}.exp3.json`;
  fadeInSec: number;
  fadeOutSec: number;
  parameters: readonly DoudouLive2DParameterTarget[];
  motionCue: "none" | "soft_breath" | "small_pop" | "short_retreat" | "sleepy_sway";
}

interface DoudouLive2DParameterRange {
  min: number;
  max: number;
  allowedBlends: readonly DoudouLive2DBlendMode[];
}

const STANDARD_ADD = ["Add"] as const;
const STANDARD_MULTIPLY = ["Multiply"] as const;
const CUSTOM_OVERWRITE = ["Overwrite"] as const;

export const DEFAULT_DOUDOU_LIVE2D_PARAMETER_RANGES: Record<DoudouLive2DParameterId, DoudouLive2DParameterRange> = {
  ParamAngleX: { min: -30, max: 30, allowedBlends: STANDARD_ADD },
  ParamAngleY: { min: -30, max: 30, allowedBlends: STANDARD_ADD },
  ParamAngleZ: { min: -30, max: 30, allowedBlends: STANDARD_ADD },
  ParamEyeLOpen: { min: 0, max: 1.5, allowedBlends: STANDARD_MULTIPLY },
  ParamEyeROpen: { min: 0, max: 1.5, allowedBlends: STANDARD_MULTIPLY },
  ParamEyeLSmile: { min: 0, max: 1, allowedBlends: STANDARD_ADD },
  ParamEyeRSmile: { min: 0, max: 1, allowedBlends: STANDARD_ADD },
  ParamEyeBallX: { min: -1, max: 1, allowedBlends: STANDARD_ADD },
  ParamEyeBallY: { min: -1, max: 1, allowedBlends: STANDARD_ADD },
  ParamEyeBallForm: { min: -1, max: 1, allowedBlends: STANDARD_ADD },
  ParamBrowLY: { min: -1, max: 1, allowedBlends: STANDARD_ADD },
  ParamBrowRY: { min: -1, max: 1, allowedBlends: STANDARD_ADD },
  ParamBrowLAngle: { min: -1, max: 1, allowedBlends: STANDARD_ADD },
  ParamBrowRAngle: { min: -1, max: 1, allowedBlends: STANDARD_ADD },
  ParamBrowLForm: { min: -1, max: 1, allowedBlends: STANDARD_ADD },
  ParamBrowRForm: { min: -1, max: 1, allowedBlends: STANDARD_ADD },
  ParamMouthForm: { min: -1, max: 1, allowedBlends: STANDARD_ADD },
  ParamMouthOpenY: { min: 0, max: 1.5, allowedBlends: STANDARD_ADD },
  ParamCheek: { min: 0, max: 1, allowedBlends: STANDARD_ADD },
  ParamBodyAngleX: { min: -10, max: 10, allowedBlends: STANDARD_ADD },
  ParamBodyAngleY: { min: -10, max: 10, allowedBlends: STANDARD_ADD },
  ParamBodyAngleZ: { min: -10, max: 10, allowedBlends: STANDARD_ADD },
  ParamBreath: { min: 0, max: 1, allowedBlends: STANDARD_ADD },
  ParamDoudouSparkle: { min: 0, max: 1, allowedBlends: CUSTOM_OVERWRITE },
  ParamDoudouTear: { min: 0, max: 1, allowedBlends: CUSTOM_OVERWRITE },
  ParamDoudouSleepBubble: { min: 0, max: 1, allowedBlends: CUSTOM_OVERWRITE }
};

export const DEFAULT_DOUDOU_LIVE2D_EXPRESSION_SPECS: readonly DoudouLive2DExpressionSpec[] = [
  expression("calm_idle", "兜兜安静陪伴", "soft_breath", [
    ...eyeOpen(0.96),
    add("ParamEyeLSmile", 0.08, "轻微笑眼"),
    add("ParamEyeRSmile", 0.08, "轻微笑眼"),
    add("ParamMouthForm", 0.08, "平静嘴角"),
    add("ParamMouthOpenY", 0, "闭口安静"),
    add("ParamCheek", 0.04, "低饱和温度"),
    add("ParamBreath", 0.12, "保留呼吸感")
  ]),
  expression("happy_smile", "兜兜轻快微笑", "small_pop", [
    ...eyeOpen(0.9),
    add("ParamEyeLSmile", 0.5, "笑眼"),
    add("ParamEyeRSmile", 0.5, "笑眼"),
    add("ParamBrowLY", 0.12, "眉眼上扬"),
    add("ParamBrowRY", 0.12, "眉眼上扬"),
    add("ParamMouthForm", 0.62, "明显微笑"),
    add("ParamMouthOpenY", 0.16, "轻微开口"),
    add("ParamCheek", 0.15, "开心红润")
  ]),
  expression("delighted", "兜兜开心发光", "small_pop", [
    ...eyeOpen(0.98),
    add("ParamEyeLSmile", 0.74, "强笑眼"),
    add("ParamEyeRSmile", 0.74, "强笑眼"),
    add("ParamEyeBallForm", 0.24, "眼睛高光放大"),
    add("ParamBrowLY", 0.24, "眉峰抬高"),
    add("ParamBrowRY", 0.24, "眉峰抬高"),
    add("ParamMouthForm", 0.85, "大笑嘴角"),
    add("ParamMouthOpenY", 0.42, "开心开口"),
    add("ParamCheek", 0.25, "开心脸红"),
    overwrite("ParamDoudouSparkle", 1, "启用星星或高光贴片")
  ]),
  expression("shy_blush", "兜兜害羞脸红", "soft_breath", [
    ...eyeOpen(0.72),
    add("ParamEyeBallY", -0.22, "视线略低"),
    add("ParamAngleZ", -4, "轻轻侧头"),
    add("ParamBrowLY", -0.08, "眉眼收敛"),
    add("ParamBrowRY", -0.08, "眉眼收敛"),
    add("ParamMouthForm", 0.2, "小幅害羞微笑"),
    add("ParamMouthOpenY", 0.04, "轻微开口"),
    add("ParamCheek", 0.7, "脸红主表达")
  ]),
  expression("curious_tilt", "兜兜好奇歪头", "soft_breath", [
    ...eyeOpen(1.04),
    add("ParamAngleZ", -6, "歪头"),
    add("ParamEyeBallX", 0.18, "视线追随"),
    add("ParamEyeBallY", 0.12, "略向上看"),
    add("ParamBrowLY", 0.26, "一侧好奇眉"),
    add("ParamBrowRY", 0.08, "另一侧保持柔和"),
    add("ParamMouthForm", 0.12, "轻微好奇嘴角"),
    add("ParamMouthOpenY", 0.08, "一点点开口")
  ]),
  expression("comfort_soft", "兜兜温柔恢复", "soft_breath", [
    ...eyeOpen(0.84),
    add("ParamEyeLSmile", 0.18, "温柔笑眼"),
    add("ParamEyeRSmile", 0.18, "温柔笑眼"),
    add("ParamBrowLY", 0.05, "眉眼放松"),
    add("ParamBrowRY", 0.05, "眉眼放松"),
    add("ParamBrowLForm", 0.18, "减少紧张"),
    add("ParamBrowRForm", 0.18, "减少紧张"),
    add("ParamMouthForm", 0.18, "温和嘴角"),
    add("ParamCheek", 0.08, "柔和红润"),
    add("ParamBreath", 0.18, "恢复时慢呼吸")
  ]),
  expression("sad_soft", "兜兜轻轻共情", "soft_breath", [
    ...eyeOpen(0.78),
    add("ParamEyeBallY", -0.16, "视线下垂"),
    add("ParamBrowLY", -0.2, "眉头降低"),
    add("ParamBrowRY", -0.2, "眉头降低"),
    add("ParamBrowLForm", 0.34, "共情眉形"),
    add("ParamBrowRForm", 0.34, "共情眉形"),
    add("ParamMouthForm", -0.32, "轻微难过嘴角"),
    add("ParamMouthOpenY", 0.03, "闭口克制"),
    add("ParamCheek", 0.04, "保留温度")
  ]),
  expression("teary", "兜兜委屈观察", "soft_breath", [
    ...eyeOpen(0.86),
    add("ParamEyeBallForm", 0.16, "眼睛湿润放大"),
    add("ParamEyeBallY", -0.08, "委屈视线"),
    add("ParamBrowLY", -0.34, "委屈眉"),
    add("ParamBrowRY", -0.34, "委屈眉"),
    add("ParamBrowLForm", 0.46, "眉形压软"),
    add("ParamBrowRForm", 0.46, "眉形压软"),
    add("ParamMouthForm", -0.42, "委屈嘴角"),
    add("ParamCheek", 0.12, "委屈红润"),
    overwrite("ParamDoudouTear", 1, "启用泪光贴片")
  ]),
  expression("surprised", "兜兜被戳惊讶", "small_pop", [
    ...eyeOpen(1.32),
    add("ParamEyeBallForm", 0.32, "眼睛放大"),
    add("ParamBrowLY", 0.62, "眉毛上扬"),
    add("ParamBrowRY", 0.62, "眉毛上扬"),
    add("ParamMouthForm", -0.08, "圆口而非笑"),
    add("ParamMouthOpenY", 0.56, "惊讶开口"),
    add("ParamBodyAngleY", 2, "身体上弹"),
    add("ParamBreath", 0.08, "保持活体感")
  ]),
  expression("annoyed_pout", "兜兜鼓脸躲开", "short_retreat", [
    ...eyeOpen(0.72),
    add("ParamEyeBallX", -0.16, "侧目"),
    add("ParamBrowLAngle", -0.42, "轻微不满眉"),
    add("ParamBrowRAngle", -0.42, "轻微不满眉"),
    add("ParamBrowLForm", -0.34, "鼓脸眉形"),
    add("ParamBrowRForm", -0.34, "鼓脸眉形"),
    add("ParamMouthForm", -0.62, "鼓脸嘴角"),
    add("ParamMouthOpenY", 0.1, "小幅嘟嘴"),
    add("ParamCheek", 0.26, "鼓脸红润")
  ]),
  expression("sleepy", "兜兜困困打盹", "sleepy_sway", [
    ...eyeOpen(0.36),
    add("ParamEyeBallY", -0.18, "眼皮沉下"),
    add("ParamBrowLY", -0.12, "困倦眉"),
    add("ParamBrowRY", -0.12, "困倦眉"),
    add("ParamMouthForm", -0.04, "放松嘴角"),
    add("ParamMouthOpenY", 0.08, "轻微打盹开口"),
    add("ParamBreath", 0.24, "慢呼吸"),
    overwrite("ParamDoudouSleepBubble", 1, "启用困意气泡")
  ]),
  expression("focused_working", "兜兜认真陪伴", "none", [
    ...eyeOpen(0.92),
    add("ParamEyeBallY", 0.02, "稳定视线"),
    add("ParamBrowLY", 0.1, "认真眉"),
    add("ParamBrowRY", 0.1, "认真眉"),
    add("ParamBrowLForm", -0.08, "轻微专注"),
    add("ParamBrowRForm", -0.08, "轻微专注"),
    add("ParamMouthForm", 0.06, "克制微笑"),
    add("ParamMouthOpenY", 0, "闭口不打扰")
  ])
] as const;

export type DoudouSafeModelIntent =
  | "offer_quiet_presence"
  | "celebrate_small_success"
  | "acknowledge_affection"
  | "soft_comfort"
  | "curiosity_prompt"
  | "low_energy_rest"
  | "focus_companion"
  | "decline_unsafe";

export type DoudouModelSuggestionSource = "llm" | "vlm";

export type DoudouModelSuggestionReasonCode =
  | "user_positive_text"
  | "user_low_mood_text"
  | "user_affection_text"
  | "user_focus_context"
  | "quiet_time"
  | "explicit_user_prompt"
  | "user_selected_asset_quality"
  | "safety_refusal";

export interface DoudouModelEmotionSuggestion {
  source: DoudouModelSuggestionSource;
  intent: DoudouSafeModelIntent;
  suggestedEmotionId: DefaultDoudouEmotionId;
  confidence: number;
  reasonCode: DoudouModelSuggestionReasonCode;
  ttlMs: number;
}

export interface DoudouModelArbitrationContext {
  currentEmotionId: DefaultDoudouEmotionId;
  runtimeStateLocked: boolean;
  safetyState: "clear" | "blocked";
  userVisionConsent: boolean;
}

export type DoudouModelArbitrationReason =
  | "accepted"
  | "safety_blocked"
  | "runtime_state_locked"
  | "vision_without_consent"
  | "confidence_too_low"
  | "ttl_too_long";

export interface DoudouModelArbitrationDecision {
  accepted: boolean;
  emotionId: DefaultDoudouEmotionId;
  reason: DoudouModelArbitrationReason;
}

export const DEFAULT_DOUDOU_SAFE_MODEL_INTENTS: readonly DoudouSafeModelIntent[] = [
  "offer_quiet_presence",
  "celebrate_small_success",
  "acknowledge_affection",
  "soft_comfort",
  "curiosity_prompt",
  "low_energy_rest",
  "focus_companion",
  "decline_unsafe"
] as const;

export const DEFAULT_DOUDOU_MODEL_ARBITRATION_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["source", "intent", "suggestedEmotionId", "confidence", "reasonCode", "ttlMs"],
  properties: {
    source: { type: "string", enum: ["llm", "vlm"] },
    intent: { type: "string", enum: DEFAULT_DOUDOU_SAFE_MODEL_INTENTS },
    suggestedEmotionId: { type: "string", enum: DEFAULT_DOUDOU_EMOTION_IDS },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    reasonCode: {
      type: "string",
      enum: [
        "user_positive_text",
        "user_low_mood_text",
        "user_affection_text",
        "user_focus_context",
        "quiet_time",
        "explicit_user_prompt",
        "user_selected_asset_quality",
        "safety_refusal"
      ]
    },
    ttlMs: { type: "integer", minimum: 1000, maximum: 30000 }
  }
} as const;

export const DEFAULT_DOUDOU_MODEL_ARBITRATION_RESPONSE_FORMAT = {
  type: "json_schema",
  json_schema: {
    name: "doudou_emotion_suggestion",
    strict: true,
    schema: DEFAULT_DOUDOU_MODEL_ARBITRATION_JSON_SCHEMA
  }
} as const;

export function doudouLive2DExpressionForEmotion(emotionId: DefaultDoudouEmotionId): DoudouLive2DExpressionSpec {
  const expressionSpec = DEFAULT_DOUDOU_LIVE2D_EXPRESSION_SPECS.find((spec) => spec.emotionId === emotionId);
  if (!expressionSpec) {
    throw new Error(`Unknown default doudou Live2D expression: ${emotionId}`);
  }
  return expressionSpec;
}

export function validateDoudouLive2DExpressionSpecs(): string[] {
  const issues: string[] = [];
  const seenEmotionIds = new Set<DefaultDoudouEmotionId>();
  const seenExpressionFiles = new Set<string>();

  for (const spec of DEFAULT_DOUDOU_LIVE2D_EXPRESSION_SPECS) {
    if (seenEmotionIds.has(spec.emotionId)) {
      issues.push(`Duplicate emotion mapping: ${spec.emotionId}`);
    }
    seenEmotionIds.add(spec.emotionId);

    if (seenExpressionFiles.has(spec.expressionFile)) {
      issues.push(`Duplicate expression file: ${spec.expressionFile}`);
    }
    seenExpressionFiles.add(spec.expressionFile);

    const seenParameterIds = new Set<DoudouLive2DParameterId>();
    for (const target of spec.parameters) {
      if (seenParameterIds.has(target.id)) {
        issues.push(`${spec.emotionId} repeats parameter ${target.id}`);
      }
      seenParameterIds.add(target.id);

      const range = DEFAULT_DOUDOU_LIVE2D_PARAMETER_RANGES[target.id];
      if (!range) {
        issues.push(`${spec.emotionId} uses unknown parameter ${target.id}`);
        continue;
      }
      if (!range.allowedBlends.includes(target.blend)) {
        issues.push(`${spec.emotionId} uses ${target.blend} for ${target.id}`);
      }
      if (target.value < range.min || target.value > range.max) {
        issues.push(`${spec.emotionId} sets ${target.id}=${target.value} outside ${range.min}..${range.max}`);
      }
    }
  }

  for (const emotionId of DEFAULT_DOUDOU_EMOTION_IDS) {
    if (!seenEmotionIds.has(emotionId)) {
      issues.push(`Missing expression mapping: ${emotionId}`);
    }
  }

  return issues;
}

export function doudouArbitrateEmotionSuggestion(
  suggestion: DoudouModelEmotionSuggestion,
  context: DoudouModelArbitrationContext
): DoudouModelArbitrationDecision {
  if (context.safetyState === "blocked") {
    return { accepted: false, emotionId: context.currentEmotionId, reason: "safety_blocked" };
  }
  if (context.runtimeStateLocked) {
    return { accepted: false, emotionId: context.currentEmotionId, reason: "runtime_state_locked" };
  }
  if (suggestion.source === "vlm" && !context.userVisionConsent) {
    return { accepted: false, emotionId: context.currentEmotionId, reason: "vision_without_consent" };
  }
  if (suggestion.confidence < 0.65) {
    return { accepted: false, emotionId: context.currentEmotionId, reason: "confidence_too_low" };
  }
  if (suggestion.ttlMs > 30000) {
    return { accepted: false, emotionId: context.currentEmotionId, reason: "ttl_too_long" };
  }
  return { accepted: true, emotionId: suggestion.suggestedEmotionId, reason: "accepted" };
}

function expression(
  emotionId: DefaultDoudouEmotionId,
  expressionName: string,
  motionCue: DoudouLive2DExpressionSpec["motionCue"],
  parameters: readonly DoudouLive2DParameterTarget[],
  fadeInSec = 0.28,
  fadeOutSec = 0.4
): DoudouLive2DExpressionSpec {
  return {
    emotionId,
    type: "Live2D Expression",
    expressionName,
    expressionFile: `expressions/doudou_${emotionId}.exp3.json`,
    fadeInSec,
    fadeOutSec,
    parameters,
    motionCue
  };
}

function eyeOpen(value: number): readonly DoudouLive2DParameterTarget[] {
  return [
    {
      id: "ParamEyeLOpen",
      value,
      blend: "Multiply",
      noteZh: "左眼开合使用 Multiply，保留自然眨眼"
    },
    {
      id: "ParamEyeROpen",
      value,
      blend: "Multiply",
      noteZh: "右眼开合使用 Multiply，保留自然眨眼"
    }
  ];
}

function add(
  id: Exclude<DoudouLive2DParameterId, DoudouLive2DCustomParameterId | "ParamEyeLOpen" | "ParamEyeROpen">,
  value: number,
  noteZh: string
): DoudouLive2DParameterTarget {
  return { id, value, blend: "Add", noteZh };
}

function overwrite(id: DoudouLive2DCustomParameterId, value: number, noteZh: string): DoudouLive2DParameterTarget {
  return { id, value, blend: "Overwrite", noteZh };
}

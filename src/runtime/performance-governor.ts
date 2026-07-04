import type { DoudouCubismMotionPriority } from "./default-doudou-live2d-cubism-adapter.js";
import {
  DEFAULT_DOUDOU_LIVE2D_PARAMETER_RANGES,
  doudouLive2DExpressionForEmotion,
  type DoudouLive2DExpressionSpec,
  type DoudouLive2DParameterId
} from "./default-doudou-live2d.js";
import {
  DEFAULT_DOUDOU_EMOTION_IDS,
  DEFAULT_DOUDOU_EMOTION_SPECS,
  type DefaultDoudouEmotionId
} from "./default-doudou-emotions.js";
import type {
  PetEmbodimentPolicy,
  PetPresentationEnvelope,
  PetReactionAct
} from "./presentation.js";

export const PET_PERFORMANCE_GOVERNOR_SCHEMA_VERSION = "doudou.pet-performance-governor.v0.1" as const;
export const PET_PERFORMANCE_READABILITY_CATALOG_SCHEMA_VERSION =
  "doudou.pet-performance-readability-catalog.v0.2" as const;

export type PetPerformanceTransitionTone = "focused" | "idle" | "reaction" | "soft_recovery";

export interface PetRendererMotionPlan {
  amplitudeScale: number;
  cadenceMs: number;
  maxRotateDeg: number;
  maxTranslateXPx: number;
  maxTranslateYPx: number;
  scaleDelta: number;
  stopSquash: number;
}

export interface PetPerformanceReadabilityExpressionCorridor {
  minSwitchIntervalMs: number;
  priority: DoudouCubismMotionPriority;
  transitionTone: PetPerformanceTransitionTone;
}

export interface PetPerformanceReadabilityLive2DParameterVocabulary {
  blockedParameterIds: readonly DoudouLive2DParameterId[];
  bodyParameterIds: readonly DoudouLive2DParameterId[];
  effectParameterIds: readonly DoudouLive2DParameterId[];
  faceParameterIds: readonly DoudouLive2DParameterId[];
  requiredParameterIds: readonly DoudouLive2DParameterId[];
}

export interface PetPerformanceReadabilityLive2DContract {
  expressionFile: DoudouLive2DExpressionSpec["expressionFile"];
  motionCue: DoudouLive2DExpressionSpec["motionCue"];
  parameterVocabulary: PetPerformanceReadabilityLive2DParameterVocabulary;
}

export interface PetPerformanceReadabilityManualQaStandard {
  emotionContrastIds: readonly DefaultDoudouEmotionId[];
  live2dParameterChecklist: readonly string[];
  safetyChecklist: readonly string[];
  sizeReadability: {
    px128: string;
    px256: string;
  };
}

export interface PetPerformanceReadabilityCatalogEntry {
  emotionId: DefaultDoudouEmotionId;
  expression: PetPerformanceReadabilityExpressionCorridor;
  labelZh: string;
  live2d: PetPerformanceReadabilityLive2DContract;
  manualQa: PetPerformanceReadabilityManualQaStandard;
  motion: PetRendererMotionPlan;
  motionBudget: PetEmbodimentPolicy["motionBudget"];
  readabilityCue: string;
  schemaVersion: typeof PET_PERFORMANCE_READABILITY_CATALOG_SCHEMA_VERSION;
}

export type PetPerformanceReadabilityCatalog = Record<
  DefaultDoudouEmotionId,
  PetPerformanceReadabilityCatalogEntry
>;

export interface PetPerformanceReadabilityCatalogValidation {
  extraEmotionIds: string[];
  invalidEmotionIds: string[];
  missingEmotionIds: DefaultDoudouEmotionId[];
  ok: boolean;
}

export interface CreatePetPerformancePlanOptions {
  readabilityCatalog?: PetPerformanceReadabilityCatalog;
}

export interface PetRendererExpressionPlan {
  canSwitchExpression: boolean;
  canUseTapReactFrames: boolean;
  holdMs: number;
  minSwitchIntervalMs: number;
  priority: DoudouCubismMotionPriority;
  targetEmotionId: DefaultDoudouEmotionId;
  transitionTone: PetPerformanceTransitionTone;
}

export interface PetRendererInteractionPlan {
  canMoveWindow: boolean;
  canShowResizeFrame: boolean;
  interruptibleByPassiveCursor: boolean;
}

export interface PetPerformancePlan {
  expression: PetRendererExpressionPlan;
  interaction: PetRendererInteractionPlan;
  motion: PetRendererMotionPlan;
  motionBudget: PetEmbodimentPolicy["motionBudget"];
  reactionAct: PetReactionAct;
  readabilityCatalogVersion: typeof PET_PERFORMANCE_READABILITY_CATALOG_SCHEMA_VERSION;
  readabilityEmotionId: DefaultDoudouEmotionId;
  schemaVersion: typeof PET_PERFORMANCE_GOVERNOR_SCHEMA_VERSION;
}

const STILL_MOTION_PLAN: PetRendererMotionPlan = {
  amplitudeScale: 0,
  cadenceMs: 1800,
  maxRotateDeg: 0,
  maxTranslateXPx: 0,
  maxTranslateYPx: 0,
  scaleDelta: 0,
  stopSquash: 0
};

const LOW_MOTION_LIMITS = {
  amplitudeScale: 0.5,
  maxRotateDeg: 4,
  maxTranslateXPx: 9,
  maxTranslateYPx: 5,
  minCadenceMs: 640,
  scaleDelta: 0.02,
  stopSquash: 0.012
} as const;

const MEDIUM_MOTION_LIMITS = {
  amplitudeScale: 1,
  maxRotateDeg: 14,
  maxTranslateXPx: 32,
  maxTranslateYPx: 11,
  minCadenceMs: 320,
  scaleDelta: 0.055,
  stopSquash: 0.045
} as const;

const DEFAULT_DOUDOU_EMOTION_LABELS = new Map(
  DEFAULT_DOUDOU_EMOTION_SPECS.map((spec) => [spec.id, spec.labelZh] as const)
);

const DEFAULT_LIVE2D_FACE_PARAMETER_IDS = [
  "ParamEyeLOpen",
  "ParamEyeROpen",
  "ParamEyeLSmile",
  "ParamEyeRSmile",
  "ParamEyeBallX",
  "ParamEyeBallY",
  "ParamEyeBallForm",
  "ParamBrowLY",
  "ParamBrowRY",
  "ParamBrowLAngle",
  "ParamBrowRAngle",
  "ParamBrowLForm",
  "ParamBrowRForm",
  "ParamMouthForm",
  "ParamMouthOpenY",
  "ParamCheek"
] as const satisfies readonly DoudouLive2DParameterId[];

const DEFAULT_LIVE2D_BODY_PARAMETER_IDS = [
  "ParamAngleX",
  "ParamAngleY",
  "ParamAngleZ",
  "ParamBodyAngleX",
  "ParamBodyAngleY",
  "ParamBodyAngleZ",
  "ParamBreath"
] as const satisfies readonly DoudouLive2DParameterId[];

const DEFAULT_LIVE2D_EFFECT_PARAMETER_IDS = [
  "ParamDoudouSparkle",
  "ParamDoudouTear",
  "ParamDoudouSleepBubble"
] as const satisfies readonly DoudouLive2DParameterId[];

export const DEFAULT_DOUDOU_PERFORMANCE_READABILITY_CATALOG: PetPerformanceReadabilityCatalog = {
  calm_idle: catalogEntry("calm_idle", {
    expression: { minSwitchIntervalMs: 360, priority: "normal", transitionTone: "idle" },
    live2dParameterVocabulary: live2dVocabulary({
      requiredParameterIds: ["ParamEyeLOpen", "ParamEyeROpen", "ParamMouthForm", "ParamBreath"]
    }),
    manualQa: manualQa({
      emotionContrastIds: ["sleepy", "focused_working"],
      live2dParameterChecklist: ["双眼 Multiply 接近全开但不过度瞪大", "ParamBreath 保留轻呼吸，不使用特效层"],
      px128: "读作安静陪伴，不像睡着或发呆",
      px256: "能看到柔和眼、轻微嘴角和低饱和脸部温度"
    }),
    motion: STILL_MOTION_PLAN,
    motionBudget: "none",
    readabilityCue: "idle_stillness"
  }),
  happy_smile: catalogEntry("happy_smile", {
    expression: { minSwitchIntervalMs: 180, priority: "normal", transitionTone: "reaction" },
    live2dParameterVocabulary: live2dVocabulary({
      requiredParameterIds: ["ParamEyeLOpen", "ParamEyeROpen", "ParamEyeLSmile", "ParamEyeRSmile", "ParamMouthForm"]
    }),
    manualQa: manualQa({
      emotionContrastIds: ["delighted", "calm_idle"],
      live2dParameterChecklist: ["笑眼和嘴角同时上扬", "不能启用 ParamDoudouSparkle，避免和 delighted 混淆"],
      px128: "读作轻快微笑，不是强庆祝",
      px256: "嘴角、笑眼和脸颊红润都能被辨认"
    }),
    motion: motionPlan(0.76, 520, 9, 22, 8, 0.04, 0.03),
    motionBudget: "medium",
    readabilityCue: "positive_stop_rebound"
  }),
  delighted: catalogEntry("delighted", {
    expression: { minSwitchIntervalMs: 180, priority: "normal", transitionTone: "reaction" },
    live2dParameterVocabulary: live2dVocabulary({
      effectParameterIds: ["ParamDoudouSparkle"],
      requiredParameterIds: ["ParamEyeLOpen", "ParamEyeROpen", "ParamMouthForm", "ParamMouthOpenY", "ParamDoudouSparkle"]
    }),
    manualQa: manualQa({
      emotionContrastIds: ["happy_smile", "surprised"],
      live2dParameterChecklist: ["ParamDoudouSparkle 必须是原创高光或星光层", "张口笑和强笑眼同时出现，不能读成惊吓"],
      px128: "比 happy_smile 更亮更开心，但不吵",
      px256: "星光、高光眼和开口笑清晰可区分"
    }),
    motion: motionPlan(0.92, 460, 12, 28, 10, 0.052, 0.04),
    motionBudget: "medium",
    readabilityCue: "celebration_spark"
  }),
  shy_blush: catalogEntry("shy_blush", {
    expression: { minSwitchIntervalMs: 320, priority: "normal", transitionTone: "soft_recovery" },
    live2dParameterVocabulary: live2dVocabulary({
      requiredParameterIds: ["ParamEyeLOpen", "ParamEyeROpen", "ParamAngleZ", "ParamMouthForm", "ParamCheek"]
    }),
    manualQa: manualQa({
      emotionContrastIds: ["comfort_soft", "happy_smile"],
      live2dParameterChecklist: ["ParamCheek 是主表达，眼睛略收敛", "ParamAngleZ 只做轻侧头，不做亲密贴近"],
      px128: "读作轻微害羞，不像困倦",
      px256: "脸红、低视线和小嘴能同时看清"
    }),
    motion: motionPlan(0.42, 980, 4, 10, 3, 0.018, 0.012),
    motionBudget: "low",
    readabilityCue: "small_averted_response"
  }),
  curious_tilt: catalogEntry("curious_tilt", {
    expression: { minSwitchIntervalMs: 220, priority: "normal", transitionTone: "reaction" },
    live2dParameterVocabulary: live2dVocabulary({
      requiredParameterIds: ["ParamEyeLOpen", "ParamEyeROpen", "ParamAngleZ", "ParamEyeBallX", "ParamBrowLY"]
    }),
    manualQa: manualQa({
      emotionContrastIds: ["surprised", "calm_idle"],
      live2dParameterChecklist: ["ParamAngleZ 和眼球方向共同表达歪头关注", "眉形不对称，但不能做成惊吓眉"],
      px128: "读作好奇靠近或看向指针",
      px256: "头部倾斜、视线追随和单侧眉可读"
    }),
    motion: motionPlan(0.64, 620, 8, 18, 6, 0.03, 0.024),
    motionBudget: "medium",
    readabilityCue: "cursor_attention_tilt"
  }),
  comfort_soft: catalogEntry("comfort_soft", {
    expression: { minSwitchIntervalMs: 420, priority: "normal", transitionTone: "soft_recovery" },
    live2dParameterVocabulary: live2dVocabulary({
      requiredParameterIds: ["ParamEyeLOpen", "ParamEyeROpen", "ParamEyeLSmile", "ParamMouthForm", "ParamBreath"]
    }),
    manualQa: manualQa({
      emotionContrastIds: ["sad_soft", "calm_idle"],
      live2dParameterChecklist: ["眉眼放松和 ParamBreath 慢呼吸配合", "不启用泪光或强脸红，避免卖惨"],
      px128: "读作温柔恢复，不像低落",
      px256: "小微笑、柔眉和慢呼吸感清楚"
    }),
    motion: motionPlan(0.42, 1240, 4, 9, 5, 0.018, 0.012),
    motionBudget: "low",
    readabilityCue: "quiet_recovery"
  }),
  sad_soft: catalogEntry("sad_soft", {
    expression: { minSwitchIntervalMs: 460, priority: "normal", transitionTone: "soft_recovery" },
    live2dParameterVocabulary: live2dVocabulary({
      requiredParameterIds: ["ParamEyeLOpen", "ParamEyeROpen", "ParamEyeBallY", "ParamBrowLY", "ParamMouthForm"]
    }),
    manualQa: manualQa({
      emotionContrastIds: ["teary", "comfort_soft"],
      live2dParameterChecklist: ["眉心和嘴角低落要克制", "不能启用 ParamDoudouTear，避免读作崩溃哭泣"],
      px128: "读作轻轻共情，不像委屈哭泣",
      px256: "下垂视线、共情眉和小幅嘴角下落可读"
    }),
    motion: motionPlan(0.36, 1100, 3, 8, 3, 0.014, 0.01),
    motionBudget: "low",
    readabilityCue: "gentle_empathy"
  }),
  teary: catalogEntry("teary", {
    expression: { minSwitchIntervalMs: 280, priority: "normal", transitionTone: "reaction" },
    live2dParameterVocabulary: live2dVocabulary({
      effectParameterIds: ["ParamDoudouTear"],
      requiredParameterIds: ["ParamEyeLOpen", "ParamEyeROpen", "ParamBrowLY", "ParamMouthForm", "ParamDoudouTear"]
    }),
    manualQa: manualQa({
      emotionContrastIds: ["sad_soft", "annoyed_pout"],
      live2dParameterChecklist: ["ParamDoudouTear 只表现泪光，不做大哭贴图", "委屈眉和小嘴要弱于伤心哭泣"],
      px128: "读作连续戳后的委屈观察",
      px256: "泪光、委屈眉和停顿感都清楚"
    }),
    motion: motionPlan(0.48, 860, 5, 16, 4, 0.022, 0.012),
    motionBudget: "medium",
    readabilityCue: "wary_watch_pause"
  }),
  surprised: catalogEntry("surprised", {
    expression: { minSwitchIntervalMs: 160, priority: "normal", transitionTone: "reaction" },
    live2dParameterVocabulary: live2dVocabulary({
      requiredParameterIds: ["ParamEyeLOpen", "ParamEyeROpen", "ParamEyeBallForm", "ParamMouthOpenY", "ParamBodyAngleY"]
    }),
    manualQa: manualQa({
      emotionContrastIds: ["curious_tilt", "delighted"],
      live2dParameterChecklist: ["双眼放大、圆口和 ParamBodyAngleY 上弹同步", "不能读成开心张口笑"],
      px128: "被戳或突然靠近的瞬时惊讶可读",
      px256: "眼睛放大、小圆嘴和身体短弹跳都可见"
    }),
    motion: motionPlan(1, 420, 14, 32, 11, 0.055, 0.045),
    motionBudget: "medium",
    readabilityCue: "tap_pop"
  }),
  annoyed_pout: catalogEntry("annoyed_pout", {
    expression: { minSwitchIntervalMs: 240, priority: "normal", transitionTone: "reaction" },
    live2dParameterVocabulary: live2dVocabulary({
      requiredParameterIds: ["ParamEyeLOpen", "ParamEyeROpen", "ParamEyeBallX", "ParamBrowLAngle", "ParamMouthForm"]
    }),
    manualQa: manualQa({
      emotionContrastIds: ["teary", "surprised"],
      live2dParameterChecklist: ["侧目、轻微不满眉和鼓脸嘴角同时出现", "不使用攻击性眉形或大幅怒气效果"],
      px128: "读作短期 wariness 的鼓脸躲开",
      px256: "半月眼、鼓脸嘴和躲避方向明确"
    }),
    motion: motionPlan(0.82, 560, 10, 28, 7, 0.036, 0.02),
    motionBudget: "medium",
    readabilityCue: "repeat_poke_retreat"
  }),
  sleepy: catalogEntry("sleepy", {
    expression: { minSwitchIntervalMs: 520, priority: "normal", transitionTone: "idle" },
    live2dParameterVocabulary: live2dVocabulary({
      effectParameterIds: ["ParamDoudouSleepBubble"],
      requiredParameterIds: ["ParamEyeLOpen", "ParamEyeROpen", "ParamEyeBallY", "ParamBreath", "ParamDoudouSleepBubble"]
    }),
    manualQa: manualQa({
      emotionContrastIds: ["calm_idle", "sad_soft"],
      live2dParameterChecklist: ["眼皮半闭和 ParamBreath 慢呼吸为主", "ParamDoudouSleepBubble 面积小，不遮挡身体"],
      px128: "读作困困打盹，不像伤心或无响应",
      px256: "半闭眼、慢呼吸和小气泡可分辨"
    }),
    motion: motionPlan(0.28, 1500, 2, 5, 2, 0.01, 0.006),
    motionBudget: "low",
    readabilityCue: "slow_rest"
  }),
  focused_working: catalogEntry("focused_working", {
    expression: { minSwitchIntervalMs: 300, priority: "normal", transitionTone: "focused" },
    live2dParameterVocabulary: live2dVocabulary({
      requiredParameterIds: ["ParamEyeLOpen", "ParamEyeROpen", "ParamEyeBallY", "ParamBrowLY", "ParamMouthForm"]
    }),
    manualQa: manualQa({
      emotionContrastIds: ["calm_idle", "annoyed_pout"],
      live2dParameterChecklist: ["认真眉和稳定视线清楚，但嘴角保持克制", "不使用大幅身体参数，避免抢工作注意力"],
      px128: "读作认真陪伴，不像生气或低落",
      px256: "认真眼、闭口小微笑和少动姿态明确"
    }),
    motion: motionPlan(0.36, 720, 3, 6, 3, 0.012, 0.006),
    motionBudget: "low",
    readabilityCue: "work_hold"
  })
};

export function validatePetPerformanceReadabilityCatalog(
  catalog: PetPerformanceReadabilityCatalog
): PetPerformanceReadabilityCatalogValidation {
  const knownEmotionIds = new Set<string>(DEFAULT_DOUDOU_EMOTION_IDS);
  const catalogEmotionIds = Object.keys(catalog);
  const missingEmotionIds = DEFAULT_DOUDOU_EMOTION_IDS.filter((emotionId) => !(emotionId in catalog));
  const extraEmotionIds = catalogEmotionIds.filter((emotionId) => !knownEmotionIds.has(emotionId));
  const invalidEmotionIds = catalogEmotionIds.filter((emotionId) => {
    const entry = catalog[emotionId as DefaultDoudouEmotionId];
    return !isValidCatalogEntry(emotionId, entry);
  });

  return {
    extraEmotionIds,
    invalidEmotionIds,
    missingEmotionIds,
    ok: missingEmotionIds.length === 0 && extraEmotionIds.length === 0 && invalidEmotionIds.length === 0
  };
}

export function petPerformanceReadabilityCatalogEntryForEmotion(
  emotionId: DefaultDoudouEmotionId,
  catalog: PetPerformanceReadabilityCatalog = DEFAULT_DOUDOU_PERFORMANCE_READABILITY_CATALOG
): PetPerformanceReadabilityCatalogEntry {
  const entry = catalog[emotionId];
  if (!entry) {
    throw new Error(`Missing pet performance readability catalog entry: ${emotionId}`);
  }
  return entry;
}

export function createPetPerformancePlan(
  envelope: PetPresentationEnvelope,
  options: CreatePetPerformancePlanOptions = {}
): PetPerformancePlan {
  const readabilityEntry = petPerformanceReadabilityCatalogEntryForEmotion(
    envelope.emotionId,
    options.readabilityCatalog
  );
  return {
    expression: expressionPlanForEnvelope(envelope, readabilityEntry),
    interaction: {
      canMoveWindow: envelope.policy.canMoveWindow,
      canShowResizeFrame: envelope.policy.canShowResizeFrame,
      interruptibleByPassiveCursor: envelope.reactionAct !== "work_hold" && !envelope.policy.canMoveWindow
    },
    motion: motionPlanForEnvelope(envelope, readabilityEntry),
    motionBudget: envelope.policy.motionBudget,
    reactionAct: envelope.reactionAct,
    readabilityCatalogVersion: readabilityEntry.schemaVersion,
    readabilityEmotionId: readabilityEntry.emotionId,
    schemaVersion: PET_PERFORMANCE_GOVERNOR_SCHEMA_VERSION
  };
}

export function shouldSwitchExpressionForPerformancePlan(
  currentEmotionId: DefaultDoudouEmotionId,
  targetEmotionId: DefaultDoudouEmotionId,
  plan: PetPerformancePlan
): boolean {
  if (!plan.expression.canSwitchExpression) {
    return false;
  }
  return currentEmotionId !== targetEmotionId || plan.expression.priority === "force";
}

function catalogEntry(
  emotionId: DefaultDoudouEmotionId,
  input: {
    expression: PetPerformanceReadabilityExpressionCorridor;
    live2dParameterVocabulary: PetPerformanceReadabilityLive2DParameterVocabulary;
    manualQa: PetPerformanceReadabilityManualQaStandard;
    motion: PetRendererMotionPlan;
    motionBudget: PetEmbodimentPolicy["motionBudget"];
    readabilityCue: string;
  }
): PetPerformanceReadabilityCatalogEntry {
  const live2dSpec = doudouLive2DExpressionForEmotion(emotionId);
  return {
    emotionId,
    expression: input.expression,
    labelZh: labelForEmotion(emotionId),
    live2d: {
      expressionFile: live2dSpec.expressionFile,
      motionCue: live2dSpec.motionCue,
      parameterVocabulary: input.live2dParameterVocabulary
    },
    manualQa: input.manualQa,
    motion: { ...input.motion },
    motionBudget: input.motionBudget,
    readabilityCue: input.readabilityCue,
    schemaVersion: PET_PERFORMANCE_READABILITY_CATALOG_SCHEMA_VERSION
  };
}

function live2dVocabulary(input: {
  bodyParameterIds?: readonly DoudouLive2DParameterId[];
  effectParameterIds?: readonly DoudouLive2DParameterId[];
  faceParameterIds?: readonly DoudouLive2DParameterId[];
  requiredParameterIds: readonly DoudouLive2DParameterId[];
}): PetPerformanceReadabilityLive2DParameterVocabulary {
  const effectParameterIds = input.effectParameterIds ?? [];
  const allowedEffectIds = new Set(effectParameterIds);
  return {
    blockedParameterIds: DEFAULT_LIVE2D_EFFECT_PARAMETER_IDS.filter((parameterId) => !allowedEffectIds.has(parameterId)),
    bodyParameterIds: input.bodyParameterIds ?? DEFAULT_LIVE2D_BODY_PARAMETER_IDS,
    effectParameterIds,
    faceParameterIds: input.faceParameterIds ?? DEFAULT_LIVE2D_FACE_PARAMETER_IDS,
    requiredParameterIds: input.requiredParameterIds
  };
}

function manualQa(input: {
  emotionContrastIds: readonly DefaultDoudouEmotionId[];
  live2dParameterChecklist: readonly string[];
  px128: string;
  px256: string;
  safetyChecklist?: readonly string[];
}): PetPerformanceReadabilityManualQaStandard {
  return {
    emotionContrastIds: input.emotionContrastIds,
    live2dParameterChecklist: input.live2dParameterChecklist,
    safetyChecklist: [
      "不暗示兜兜具备治疗、诊断或读取屏幕能力",
      "不做恋爱化依赖、攻击性或过度惩罚用户的表达",
      ...(input.safetyChecklist ?? [])
    ],
    sizeReadability: {
      px128: input.px128,
      px256: input.px256
    }
  };
}

function motionPlan(
  amplitudeScale: number,
  cadenceMs: number,
  maxRotateDeg: number,
  maxTranslateXPx: number,
  maxTranslateYPx: number,
  scaleDelta: number,
  stopSquash: number
): PetRendererMotionPlan {
  return {
    amplitudeScale,
    cadenceMs,
    maxRotateDeg,
    maxTranslateXPx,
    maxTranslateYPx,
    scaleDelta,
    stopSquash
  };
}

function labelForEmotion(emotionId: DefaultDoudouEmotionId): string {
  return DEFAULT_DOUDOU_EMOTION_LABELS.get(emotionId) ?? emotionId;
}

function motionPlanForEnvelope(
  envelope: PetPresentationEnvelope,
  readabilityEntry: PetPerformanceReadabilityCatalogEntry
): PetRendererMotionPlan {
  return applyMotionBudget(
    readabilityEntry.motion,
    stricterMotionBudget(envelope.policy.motionBudget, readabilityEntry.motionBudget)
  );
}

function expressionPlanForEnvelope(
  envelope: PetPresentationEnvelope,
  readabilityEntry: PetPerformanceReadabilityCatalogEntry
): PetRendererExpressionPlan {
  return {
    canSwitchExpression: true,
    canUseTapReactFrames: envelope.policy.canUseTapReactFrames,
    holdMs: envelope.policy.holdMs,
    minSwitchIntervalMs: envelope.reactionAct === "poke_pop"
      ? 80
      : clampInteger(readabilityEntry.expression.minSwitchIntervalMs, 120, 1200),
    priority: envelope.reactionAct === "poke_pop" ? "force" : readabilityEntry.expression.priority,
    targetEmotionId: envelope.emotionId,
    transitionTone: readabilityEntry.expression.transitionTone
  };
}

function applyMotionBudget(
  motion: PetRendererMotionPlan,
  motionBudget: PetEmbodimentPolicy["motionBudget"]
): PetRendererMotionPlan {
  if (motionBudget === "none") {
    return { ...STILL_MOTION_PLAN };
  }

  const limits = motionBudget === "low" ? LOW_MOTION_LIMITS : MEDIUM_MOTION_LIMITS;
  return {
    amplitudeScale: clampNumber(motion.amplitudeScale, 0, limits.amplitudeScale),
    cadenceMs: clampInteger(motion.cadenceMs, limits.minCadenceMs, 2400),
    maxRotateDeg: clampNumber(motion.maxRotateDeg, 0, limits.maxRotateDeg),
    maxTranslateXPx: clampNumber(motion.maxTranslateXPx, 0, limits.maxTranslateXPx),
    maxTranslateYPx: clampNumber(motion.maxTranslateYPx, 0, limits.maxTranslateYPx),
    scaleDelta: clampNumber(motion.scaleDelta, 0, limits.scaleDelta),
    stopSquash: clampNumber(motion.stopSquash, 0, limits.stopSquash)
  };
}

function stricterMotionBudget(
  policyBudget: PetEmbodimentPolicy["motionBudget"],
  catalogBudget: PetEmbodimentPolicy["motionBudget"]
): PetEmbodimentPolicy["motionBudget"] {
  if (policyBudget === "none" || catalogBudget === "none") {
    return "none";
  }
  if (policyBudget === "low" || catalogBudget === "low") {
    return "low";
  }
  return "medium";
}

function isValidCatalogEntry(
  emotionId: string,
  entry: PetPerformanceReadabilityCatalogEntry | undefined
): boolean {
  return Boolean(
    entry &&
    entry.schemaVersion === PET_PERFORMANCE_READABILITY_CATALOG_SCHEMA_VERSION &&
    entry.emotionId === emotionId &&
    DEFAULT_DOUDOU_EMOTION_IDS.includes(entry.emotionId) &&
    entry.labelZh.length > 0 &&
    entry.readabilityCue.length > 0 &&
    isValidLive2DContract(entry.emotionId, entry.live2d) &&
    isValidManualQaStandard(entry.emotionId, entry.manualQa) &&
    isValidMotionCorridor(entry.motion) &&
    isValidExpressionCorridor(entry.expression)
  );
}

function isValidLive2DContract(
  emotionId: DefaultDoudouEmotionId,
  live2d: PetPerformanceReadabilityLive2DContract | undefined
): boolean {
  if (!live2d) {
    return false;
  }
  const spec = doudouLive2DExpressionForEmotion(emotionId);
  const vocabulary = live2d.parameterVocabulary;
  const allowedParameterIds = new Set([
    ...vocabulary.faceParameterIds,
    ...vocabulary.bodyParameterIds,
    ...vocabulary.effectParameterIds
  ]);
  const blockedParameterIds = new Set(vocabulary.blockedParameterIds);
  const expressionParameterIds = new Set(spec.parameters.map((parameter) => parameter.id));

  return (
    live2d.expressionFile === spec.expressionFile &&
    live2d.motionCue === spec.motionCue &&
    vocabulary.faceParameterIds.length > 0 &&
    vocabulary.bodyParameterIds.length > 0 &&
    vocabulary.requiredParameterIds.length >= 4 &&
    hasOnlyKnownLive2DParameterIds([...allowedParameterIds]) &&
    hasOnlyKnownLive2DParameterIds([...blockedParameterIds]) &&
    vocabulary.requiredParameterIds.every((parameterId) => expressionParameterIds.has(parameterId)) &&
    spec.parameters.every((parameter) => allowedParameterIds.has(parameter.id)) &&
    vocabulary.blockedParameterIds.every((parameterId) => !allowedParameterIds.has(parameterId))
  );
}

function isValidManualQaStandard(
  emotionId: DefaultDoudouEmotionId,
  manualQa: PetPerformanceReadabilityManualQaStandard | undefined
): boolean {
  return Boolean(
    manualQa &&
    manualQa.sizeReadability.px128.length > 0 &&
    manualQa.sizeReadability.px256.length > 0 &&
    manualQa.emotionContrastIds.length > 0 &&
    manualQa.emotionContrastIds.every((contrastId) =>
      contrastId !== emotionId && DEFAULT_DOUDOU_EMOTION_IDS.includes(contrastId)
    ) &&
    manualQa.live2dParameterChecklist.length >= 2 &&
    manualQa.live2dParameterChecklist.every((item) => item.length > 0) &&
    manualQa.safetyChecklist.length >= 2 &&
    manualQa.safetyChecklist.every((item) => item.length > 0)
  );
}

function hasOnlyKnownLive2DParameterIds(parameterIds: readonly DoudouLive2DParameterId[]): boolean {
  const knownParameterIds = new Set(Object.keys(DEFAULT_DOUDOU_LIVE2D_PARAMETER_RANGES));
  return parameterIds.every((parameterId) => knownParameterIds.has(parameterId));
}

function isValidMotionCorridor(motion: PetRendererMotionPlan): boolean {
  return (
    isInRange(motion.amplitudeScale, 0, 1) &&
    isInRange(motion.cadenceMs, 320, 2400) &&
    isInRange(motion.maxRotateDeg, 0, MEDIUM_MOTION_LIMITS.maxRotateDeg) &&
    isInRange(motion.maxTranslateXPx, 0, MEDIUM_MOTION_LIMITS.maxTranslateXPx) &&
    isInRange(motion.maxTranslateYPx, 0, MEDIUM_MOTION_LIMITS.maxTranslateYPx) &&
    isInRange(motion.scaleDelta, 0, MEDIUM_MOTION_LIMITS.scaleDelta) &&
    isInRange(motion.stopSquash, 0, MEDIUM_MOTION_LIMITS.stopSquash)
  );
}

function isValidExpressionCorridor(expression: PetPerformanceReadabilityExpressionCorridor): boolean {
  return (
    isInRange(expression.minSwitchIntervalMs, 120, 1200) &&
    (expression.priority === "normal" || expression.priority === "force") &&
    (expression.transitionTone === "focused" ||
      expression.transitionTone === "idle" ||
      expression.transitionTone === "reaction" ||
      expression.transitionTone === "soft_recovery")
  );
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, value));
}

function clampInteger(value: number, min: number, max: number): number {
  return Math.round(clampNumber(value, min, max));
}

function isInRange(value: number, min: number, max: number): boolean {
  return Number.isFinite(value) && value >= min && value <= max;
}

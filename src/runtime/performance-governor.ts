import type { DoudouCubismMotionPriority } from "./default-doudou-live2d-cubism-adapter.js";
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
  "doudou.pet-performance-readability-catalog.v0.1" as const;

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

export interface PetPerformanceReadabilityCatalogEntry {
  emotionId: DefaultDoudouEmotionId;
  expression: PetPerformanceReadabilityExpressionCorridor;
  labelZh: string;
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

export const DEFAULT_DOUDOU_PERFORMANCE_READABILITY_CATALOG: PetPerformanceReadabilityCatalog = {
  calm_idle: catalogEntry("calm_idle", {
    expression: { minSwitchIntervalMs: 360, priority: "normal", transitionTone: "idle" },
    motion: STILL_MOTION_PLAN,
    motionBudget: "none",
    readabilityCue: "idle_stillness"
  }),
  happy_smile: catalogEntry("happy_smile", {
    expression: { minSwitchIntervalMs: 180, priority: "normal", transitionTone: "reaction" },
    motion: motionPlan(0.76, 520, 9, 22, 8, 0.04, 0.03),
    motionBudget: "medium",
    readabilityCue: "positive_stop_rebound"
  }),
  delighted: catalogEntry("delighted", {
    expression: { minSwitchIntervalMs: 180, priority: "normal", transitionTone: "reaction" },
    motion: motionPlan(0.92, 460, 12, 28, 10, 0.052, 0.04),
    motionBudget: "medium",
    readabilityCue: "celebration_spark"
  }),
  shy_blush: catalogEntry("shy_blush", {
    expression: { minSwitchIntervalMs: 320, priority: "normal", transitionTone: "soft_recovery" },
    motion: motionPlan(0.42, 980, 4, 10, 3, 0.018, 0.012),
    motionBudget: "low",
    readabilityCue: "small_averted_response"
  }),
  curious_tilt: catalogEntry("curious_tilt", {
    expression: { minSwitchIntervalMs: 220, priority: "normal", transitionTone: "reaction" },
    motion: motionPlan(0.64, 620, 8, 18, 6, 0.03, 0.024),
    motionBudget: "medium",
    readabilityCue: "cursor_attention_tilt"
  }),
  comfort_soft: catalogEntry("comfort_soft", {
    expression: { minSwitchIntervalMs: 420, priority: "normal", transitionTone: "soft_recovery" },
    motion: motionPlan(0.42, 1240, 4, 9, 5, 0.018, 0.012),
    motionBudget: "low",
    readabilityCue: "quiet_recovery"
  }),
  sad_soft: catalogEntry("sad_soft", {
    expression: { minSwitchIntervalMs: 460, priority: "normal", transitionTone: "soft_recovery" },
    motion: motionPlan(0.36, 1100, 3, 8, 3, 0.014, 0.01),
    motionBudget: "low",
    readabilityCue: "gentle_empathy"
  }),
  teary: catalogEntry("teary", {
    expression: { minSwitchIntervalMs: 280, priority: "normal", transitionTone: "reaction" },
    motion: motionPlan(0.48, 860, 5, 16, 4, 0.022, 0.012),
    motionBudget: "medium",
    readabilityCue: "wary_watch_pause"
  }),
  surprised: catalogEntry("surprised", {
    expression: { minSwitchIntervalMs: 160, priority: "normal", transitionTone: "reaction" },
    motion: motionPlan(1, 420, 14, 32, 11, 0.055, 0.045),
    motionBudget: "medium",
    readabilityCue: "tap_pop"
  }),
  annoyed_pout: catalogEntry("annoyed_pout", {
    expression: { minSwitchIntervalMs: 240, priority: "normal", transitionTone: "reaction" },
    motion: motionPlan(0.82, 560, 10, 28, 7, 0.036, 0.02),
    motionBudget: "medium",
    readabilityCue: "repeat_poke_retreat"
  }),
  sleepy: catalogEntry("sleepy", {
    expression: { minSwitchIntervalMs: 520, priority: "normal", transitionTone: "idle" },
    motion: motionPlan(0.28, 1500, 2, 5, 2, 0.01, 0.006),
    motionBudget: "low",
    readabilityCue: "slow_rest"
  }),
  focused_working: catalogEntry("focused_working", {
    expression: { minSwitchIntervalMs: 300, priority: "normal", transitionTone: "focused" },
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
    motion: PetRendererMotionPlan;
    motionBudget: PetEmbodimentPolicy["motionBudget"];
    readabilityCue: string;
  }
): PetPerformanceReadabilityCatalogEntry {
  return {
    emotionId,
    expression: input.expression,
    labelZh: labelForEmotion(emotionId),
    motion: { ...input.motion },
    motionBudget: input.motionBudget,
    readabilityCue: input.readabilityCue,
    schemaVersion: PET_PERFORMANCE_READABILITY_CATALOG_SCHEMA_VERSION
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
    isValidMotionCorridor(entry.motion) &&
    isValidExpressionCorridor(entry.expression)
  );
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

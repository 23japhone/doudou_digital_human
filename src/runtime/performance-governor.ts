import type { DoudouCubismMotionPriority } from "./default-doudou-live2d-cubism-adapter.js";
import type { DefaultDoudouEmotionId } from "./default-doudou-emotions.js";
import type {
  PetEmbodimentPolicy,
  PetPresentationEnvelope,
  PetReactionAct
} from "./presentation.js";

export const PET_PERFORMANCE_GOVERNOR_SCHEMA_VERSION = "doudou.pet-performance-governor.v0.1" as const;

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
  schemaVersion: typeof PET_PERFORMANCE_GOVERNOR_SCHEMA_VERSION;
}

export function createPetPerformancePlan(envelope: PetPresentationEnvelope): PetPerformancePlan {
  return {
    expression: expressionPlanForEnvelope(envelope),
    interaction: {
      canMoveWindow: envelope.policy.canMoveWindow,
      canShowResizeFrame: envelope.policy.canShowResizeFrame,
      interruptibleByPassiveCursor: envelope.reactionAct !== "work_hold" && !envelope.policy.canMoveWindow
    },
    motion: motionPlanForEnvelope(envelope),
    motionBudget: envelope.policy.motionBudget,
    reactionAct: envelope.reactionAct,
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

function motionPlanForEnvelope(envelope: PetPresentationEnvelope): PetRendererMotionPlan {
  if (envelope.policy.motionBudget === "none") {
    return {
      amplitudeScale: 0,
      cadenceMs: 1800,
      maxRotateDeg: 0,
      maxTranslateXPx: 0,
      maxTranslateYPx: 0,
      scaleDelta: 0,
      stopSquash: 0
    };
  }
  if (envelope.reactionAct === "quiet_recovery") {
    return {
      amplitudeScale: 0.42,
      cadenceMs: 1240,
      maxRotateDeg: 4,
      maxTranslateXPx: 9,
      maxTranslateYPx: 5,
      scaleDelta: 0.018,
      stopSquash: 0.012
    };
  }
  if (envelope.reactionAct === "work_hold") {
    return {
      amplitudeScale: 0.36,
      cadenceMs: 720,
      maxRotateDeg: 3,
      maxTranslateXPx: 6,
      maxTranslateYPx: 3,
      scaleDelta: 0.012,
      stopSquash: 0.006
    };
  }
  return {
    amplitudeScale: 1,
    cadenceMs: 420,
    maxRotateDeg: 14,
    maxTranslateXPx: 32,
    maxTranslateYPx: 11,
    scaleDelta: 0.055,
    stopSquash: 0.045
  };
}

function expressionPlanForEnvelope(envelope: PetPresentationEnvelope): PetRendererExpressionPlan {
  return {
    canSwitchExpression: true,
    canUseTapReactFrames: envelope.policy.canUseTapReactFrames,
    holdMs: envelope.policy.holdMs,
    minSwitchIntervalMs: expressionSwitchIntervalMs(envelope.reactionAct),
    priority: envelope.reactionAct === "poke_pop" ? "force" : "normal",
    targetEmotionId: envelope.emotionId,
    transitionTone: transitionToneForReaction(envelope.reactionAct)
  };
}

function expressionSwitchIntervalMs(reactionAct: PetReactionAct): number {
  if (reactionAct === "poke_pop") {
    return 80;
  }
  if (reactionAct === "quiet_recovery") {
    return 420;
  }
  if (reactionAct === "work_hold") {
    return 300;
  }
  if (reactionAct === "none") {
    return 360;
  }
  return 160;
}

function transitionToneForReaction(reactionAct: PetReactionAct): PetPerformanceTransitionTone {
  if (reactionAct === "quiet_recovery") {
    return "soft_recovery";
  }
  if (reactionAct === "work_hold") {
    return "focused";
  }
  if (reactionAct === "none") {
    return "idle";
  }
  return "reaction";
}

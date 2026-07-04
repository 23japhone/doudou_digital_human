import {
  doudouEmotionForRuntimeScenario,
  doudouEmotionScenarioForRuntimeState,
  type DefaultDoudouEmotionId,
  type DefaultDoudouEmotionScenario
} from "./default-doudou-emotions.js";
import type { RuntimeMotionDirection } from "./motion.js";
import {
  RUNTIME_EMOTION_MEMORY_CONFIG,
  type RuntimeEmotionMemory,
  type RuntimeEmotionMotionPhase
} from "./reaction.js";
import {
  RUNTIME_PET_STATE_TIMING,
  type RuntimePetState,
  type RuntimePetStateTiming,
  type RuntimePetVisualPose
} from "./state.js";

export const PET_PRESENTATION_ENVELOPE_SCHEMA_VERSION = "doudou.pet-presentation-envelope.v0.1" as const;

export type PetInteractionEventType =
  | "runtime_started"
  | "cursor_alpha_entered"
  | "cursor_alpha_left"
  | "poke"
  | "drag_started"
  | "drag_ended"
  | "scale_started"
  | "scale_changed"
  | "scale_ended"
  | "quiet_tick"
  | "work_started"
  | "work_ended";

export type PetPresentationSyntheticEventType = "advance_time" | "assert_trace" | "motion_cue";
export type PetPresentationEventType = PetInteractionEventType | PetPresentationSyntheticEventType;
export type PetInteractionTarget = "interaction_frame" | "runtime" | "unknown" | "visible_alpha";
export type PetInteractionSource = "main" | "manager" | "renderer" | "replay" | "smoke";

export interface PetInteractionEvent {
  direction?: RuntimeMotionDirection;
  source: PetInteractionSource;
  target: PetInteractionTarget;
  type: PetPresentationEventType;
}

export type PetAffectStableState = "calm" | "curious" | "focused" | "wary";

export interface PetAffectCore {
  lastInteractionAtMs: number | null;
  stableState: PetAffectStableState;
  updatedAtMs: number | null;
  wariness: number;
}

export type PetReactionAct =
  | "none"
  | "look_toward_cursor"
  | "cursor_dodge"
  | "poke_pop"
  | "repeat_poke_retreat"
  | "repeat_poke_watch"
  | "quiet_recovery"
  | "work_hold"
  | "motion_stop_rebound";

export interface PetEmbodimentPolicy {
  canMoveWindow: boolean;
  canShowResizeFrame: boolean;
  canUseTapReactFrames: boolean;
  holdMs: number;
  motionBudget: "none" | "low" | "medium";
  recoverySpeed: "normal" | "slow";
}

export interface PetPresentationEnvelope {
  affect: PetAffectCore;
  emotionId: DefaultDoudouEmotionId;
  policy: PetEmbodimentPolicy;
  pose: RuntimePetVisualPose;
  reactionAct: PetReactionAct;
  scenario: DefaultDoudouEmotionScenario;
  schemaVersion: typeof PET_PRESENTATION_ENVELOPE_SCHEMA_VERSION;
  state: RuntimePetState;
  ttlMs: number;
}

export interface PetPresentationInput {
  event?: PetInteractionEvent;
  memory: RuntimeEmotionMemory;
  motionPhase: RuntimeEmotionMotionPhase;
  nowMs: number;
  pose: RuntimePetVisualPose;
  previousState?: RuntimePetState;
  state: RuntimePetState;
  timing?: RuntimePetStateTiming;
  ttlMs?: number;
}

export function createPetPresentationEnvelope(input: PetPresentationInput): PetPresentationEnvelope {
  const reactionAct = petReactionActForPresentation({
    motionPhase: input.motionPhase,
    previousState: input.previousState,
    state: input.state
  });
  const scenario = scenarioForPresentation(input.state, input.previousState, reactionAct);
  const emotionId = doudouEmotionForRuntimeScenario(scenario).id;
  const policy = petEmbodimentPolicyForPresentation({
    event: input.event,
    reactionAct,
    state: input.state,
    timing: input.timing ?? RUNTIME_PET_STATE_TIMING
  });

  return {
    affect: petAffectCoreFromRuntime({
      memory: input.memory,
      motionPhase: input.motionPhase,
      nowMs: input.nowMs,
      state: input.state
    }),
    emotionId,
    policy,
    pose: normalizePose(input.pose),
    reactionAct,
    scenario,
    schemaVersion: PET_PRESENTATION_ENVELOPE_SCHEMA_VERSION,
    state: input.state,
    ttlMs: Math.max(1, Math.round(input.ttlMs ?? policy.holdMs))
  };
}

export function petAffectCoreFromRuntime(input: {
  memory: RuntimeEmotionMemory;
  motionPhase: RuntimeEmotionMotionPhase;
  nowMs: number;
  state: RuntimePetState;
}): PetAffectCore {
  return {
    lastInteractionAtMs: finiteOrNull(input.memory.lastInteractionAtMs),
    stableState: stableStateForRuntime(input),
    updatedAtMs: finiteOrNull(input.memory.updatedAtMs ?? input.nowMs),
    wariness: clamp01(input.memory.wariness)
  };
}

export function petReactionActForPresentation(input: {
  motionPhase: RuntimeEmotionMotionPhase;
  previousState?: RuntimePetState;
  state: RuntimePetState;
}): PetReactionAct {
  if (input.motionPhase === "retreating") {
    return "repeat_poke_retreat";
  }
  if (input.motionPhase === "watching") {
    return "repeat_poke_watch";
  }
  if (
    input.motionPhase === "recovering" ||
    (input.state === "waiting" && (input.previousState === "retreating" || input.previousState === "watching"))
  ) {
    return "quiet_recovery";
  }
  if (input.state === "approaching") {
    return "look_toward_cursor";
  }
  if (input.state === "dodging") {
    return "cursor_dodge";
  }
  if (input.state === "poked") {
    return "poke_pop";
  }
  if (input.state === "retreating") {
    return "repeat_poke_retreat";
  }
  if (input.state === "watching") {
    return "repeat_poke_watch";
  }
  if (input.state === "stopped") {
    return "motion_stop_rebound";
  }
  if (input.state === "working") {
    return "work_hold";
  }
  return "none";
}

function scenarioForPresentation(
  state: RuntimePetState,
  previousState: RuntimePetState | undefined,
  reactionAct: PetReactionAct
): DefaultDoudouEmotionScenario {
  if (reactionAct === "quiet_recovery") {
    return "quiet_recovery";
  }
  return doudouEmotionScenarioForRuntimeState(state, previousState);
}

function petEmbodimentPolicyForPresentation(input: {
  event?: PetInteractionEvent;
  reactionAct: PetReactionAct;
  state: RuntimePetState;
  timing: RuntimePetStateTiming;
}): PetEmbodimentPolicy {
  const eventType = input.event?.type;
  const resizeFrameEvent = eventType === "scale_started" || eventType === "scale_changed" || eventType === "scale_ended";
  const dragEvent = eventType === "drag_started" || eventType === "drag_ended";
  return {
    canMoveWindow: dragEvent,
    canShowResizeFrame: resizeFrameEvent || dragEvent || input.state === "working",
    canUseTapReactFrames: input.reactionAct === "poke_pop",
    holdMs: holdMsForReaction(input.reactionAct, input.timing),
    motionBudget: motionBudgetForReaction(input.reactionAct),
    recoverySpeed: input.reactionAct === "quiet_recovery" ? "slow" : "normal"
  };
}

function stableStateForRuntime(input: {
  memory: RuntimeEmotionMemory;
  motionPhase: RuntimeEmotionMotionPhase;
  state: RuntimePetState;
}): PetAffectStableState {
  if (input.state === "working") {
    return "focused";
  }
  if (
    input.state === "retreating" ||
    input.state === "watching" ||
    input.motionPhase === "retreating" ||
    input.motionPhase === "watching" ||
    input.motionPhase === "recovering" ||
    clamp01(input.memory.wariness) >= RUNTIME_EMOTION_MEMORY_CONFIG.waryDodgeThreshold
  ) {
    return "wary";
  }
  if (input.state === "approaching" || input.state === "dodging" || input.state === "poked") {
    return "curious";
  }
  return "calm";
}

function motionBudgetForReaction(reactionAct: PetReactionAct): PetEmbodimentPolicy["motionBudget"] {
  if (reactionAct === "none") {
    return "none";
  }
  if (reactionAct === "work_hold" || reactionAct === "quiet_recovery") {
    return "low";
  }
  return "medium";
}

function holdMsForReaction(reactionAct: PetReactionAct, timing: RuntimePetStateTiming): number {
  switch (reactionAct) {
    case "cursor_dodge":
      return timing.dodgingToWaitingMs;
    case "look_toward_cursor":
      return timing.approachingToWaitingMs;
    case "motion_stop_rebound":
      return timing.stoppedToWaitingMs;
    case "poke_pop":
      return timing.pokedMs;
    case "repeat_poke_retreat":
      return timing.retreatingToWatchingMs;
    case "repeat_poke_watch":
      return timing.watchingToWaitingMs;
    case "work_hold":
      return timing.workingHoldMs;
    case "quiet_recovery":
      return Math.max(timing.approachingToWaitingMs, timing.watchingToWaitingMs);
    default:
      return timing.approachingToWaitingMs;
  }
}

function normalizePose(pose: RuntimePetVisualPose): RuntimePetVisualPose {
  return {
    clickExpression: pose.clickExpression,
    direction: pose.direction,
    motionIntensity: clamp01(pose.motionIntensity),
    stopRebound: clamp01(pose.stopRebound)
  };
}

function finiteOrNull(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}

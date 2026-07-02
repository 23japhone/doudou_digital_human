import type { RuntimeCursorHitTestResult } from "./runtime-types.js";

export type RuntimeAlphaReaction = "approach" | "dodge" | "none";
export type RuntimeEmotionMotionPhase = "recovering" | "retreating" | "settled" | "watching";

export interface RuntimeEmotionMemory {
  lastInteractionAtMs: number | null;
  updatedAtMs: number | null;
  wariness: number;
}

export interface RuntimeEmotionMemoryConfig {
  dodgeDistanceBonus: number;
  pokeWariness: number;
  recoveryDelayMs: number;
  recoveryHalfLifeMs: number;
  waryDodgeThreshold: number;
}

export interface RuntimeEmotionMotionPhaseConfig {
  recoveringMs: number;
  retreatingMs: number;
  watchingMs: number;
}

export interface RuntimeAlphaReactionInput {
  emotionMemory?: RuntimeEmotionMemory;
  hitTest: RuntimeCursorHitTestResult;
}

const RUNTIME_ALPHA_REACTION_DODGE_RADIUS_RATIO = 0.24;

export const RUNTIME_EMOTION_MEMORY_CONFIG: RuntimeEmotionMemoryConfig = {
  dodgeDistanceBonus: 96,
  pokeWariness: 0.34,
  recoveryDelayMs: 1200,
  recoveryHalfLifeMs: 1800,
  waryDodgeThreshold: 0.58
};

export const RUNTIME_EMOTION_MOTION_PHASE_CONFIG: RuntimeEmotionMotionPhaseConfig = {
  recoveringMs: 1400,
  retreatingMs: 360,
  watchingMs: 520
};

export function classifyRuntimeAlphaReaction(input: RuntimeAlphaReactionInput): RuntimeAlphaReaction {
  const hitTest = input.hitTest;
  if (!hitTest.visible) {
    return "none";
  }
  const wary = (input.emotionMemory?.wariness ?? 0) >= RUNTIME_EMOTION_MEMORY_CONFIG.waryDodgeThreshold;
  if (!hitTest.canvasPoint || !hitTest.canvasSize) {
    return wary ? "dodge" : "approach";
  }
  const center = {
    x: hitTest.canvasSize.width / 2,
    y: hitTest.canvasSize.height / 2
  };
  const radiusBasis = Math.max(1, Math.min(hitTest.canvasSize.width, hitTest.canvasSize.height) / 2);
  const distanceRatio = Math.hypot(hitTest.canvasPoint.x - center.x, hitTest.canvasPoint.y - center.y) / radiusBasis;
  return distanceRatio <= RUNTIME_ALPHA_REACTION_DODGE_RADIUS_RATIO || wary ? "dodge" : "approach";
}

export function classifyRuntimeEmotionMotionPhase(
  memory: RuntimeEmotionMemory,
  nowMs: number,
  config = RUNTIME_EMOTION_MOTION_PHASE_CONFIG
): RuntimeEmotionMotionPhase {
  if (
    memory.lastInteractionAtMs === null ||
    !Number.isFinite(nowMs) ||
    nowMs < memory.lastInteractionAtMs ||
    memory.wariness < RUNTIME_EMOTION_MEMORY_CONFIG.waryDodgeThreshold
  ) {
    return "settled";
  }

  const elapsedMs = nowMs - memory.lastInteractionAtMs;
  if (elapsedMs < config.retreatingMs) {
    return "retreating";
  }
  if (elapsedMs < config.retreatingMs + config.watchingMs) {
    return "watching";
  }
  if (elapsedMs < config.retreatingMs + config.watchingMs + config.recoveringMs) {
    return "recovering";
  }
  return "settled";
}

export function createRuntimeEmotionMemory(): RuntimeEmotionMemory {
  return {
    lastInteractionAtMs: null,
    updatedAtMs: null,
    wariness: 0
  };
}

export function recordRuntimePokeEmotion(
  memory: RuntimeEmotionMemory,
  nowMs: number,
  config = RUNTIME_EMOTION_MEMORY_CONFIG
): RuntimeEmotionMemory {
  const current = decayRuntimeEmotionMemory(memory, nowMs, config);
  const interactionAtMs = Number.isFinite(nowMs)
    ? Math.max(nowMs, current.lastInteractionAtMs ?? nowMs)
    : current.lastInteractionAtMs;
  return {
    lastInteractionAtMs: interactionAtMs,
    updatedAtMs: interactionAtMs ?? current.updatedAtMs,
    wariness: clamp01(current.wariness + config.pokeWariness)
  };
}

export function decayRuntimeEmotionMemory(
  memory: RuntimeEmotionMemory,
  nowMs: number,
  config = RUNTIME_EMOTION_MEMORY_CONFIG
): RuntimeEmotionMemory {
  const lastInteractionAtMs = memory.lastInteractionAtMs;
  const updatedAtMs = memory.updatedAtMs ?? lastInteractionAtMs;
  const wariness = clamp01(memory.wariness);
  if (lastInteractionAtMs === null || updatedAtMs === null || !Number.isFinite(nowMs)) {
    return {
      lastInteractionAtMs,
      updatedAtMs,
      wariness
    };
  }

  const recoveryStartMs = lastInteractionAtMs + config.recoveryDelayMs;
  const previousUpdatedAtMs = Math.max(updatedAtMs, recoveryStartMs);
  if (nowMs <= previousUpdatedAtMs) {
    return {
      lastInteractionAtMs,
      updatedAtMs,
      wariness
    };
  }

  const recoveryMs = nowMs - previousUpdatedAtMs;
  const halfLifeMs = Math.max(1, config.recoveryHalfLifeMs);
  return {
    lastInteractionAtMs,
    updatedAtMs: nowMs,
    wariness: clamp01(wariness * 0.5 ** (recoveryMs / halfLifeMs))
  };
}

export function runtimeDodgeDistanceForEmotion(memory: RuntimeEmotionMemory, baseDistance: number): number {
  const safeBaseDistance = Number.isFinite(baseDistance) ? Math.max(1, baseDistance) : 1;
  return safeBaseDistance + RUNTIME_EMOTION_MEMORY_CONFIG.dodgeDistanceBonus * clamp01(memory.wariness);
}

export function runtimeMotionIntensityForEmotion(baseIntensity: number, memory: RuntimeEmotionMemory): number {
  return clamp01(Math.max(baseIntensity, clamp01(memory.wariness) * 0.75));
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}

import {
  RUNTIME_CURSOR_FOLLOW_CONFIG,
  type RuntimeCursorFollowConfig
} from "./motion.js";
import {
  RUNTIME_EMOTION_MOTION_PHASE_CONFIG,
  type RuntimeEmotionMemory,
  type RuntimeEmotionMotionPhaseConfig
} from "./reaction.js";
import {
  RUNTIME_PET_STATE_TIMING,
  type RuntimePetStateTiming
} from "./state.js";

export interface RuntimeMotionTuning {
  recoverySpeedPixelsPerSecond: number;
  retreatDistancePixels: number;
  watchingPauseMs: number;
}

interface RuntimeMotionTuningLimits {
  recoverySpeedPixelsPerSecond: { max: number; min: number };
  retreatDistancePixels: { max: number; min: number };
  watchingPauseMs: { max: number; min: number };
}

export const RUNTIME_MOTION_TUNING_DEFAULTS: RuntimeMotionTuning = {
  recoverySpeedPixelsPerSecond: 280,
  retreatDistancePixels: 216,
  watchingPauseMs: 680
};

export const RUNTIME_MOTION_TUNING_LIMITS: RuntimeMotionTuningLimits = {
  recoverySpeedPixelsPerSecond: { min: 160, max: 760 },
  retreatDistancePixels: { min: 96, max: 360 },
  watchingPauseMs: { min: 260, max: 1600 }
};

export function resolveRuntimeMotionTuning(
  patch: Partial<RuntimeMotionTuning> = {},
  base: RuntimeMotionTuning = RUNTIME_MOTION_TUNING_DEFAULTS
): RuntimeMotionTuning {
  return {
    recoverySpeedPixelsPerSecond: clampNumber(
      patch.recoverySpeedPixelsPerSecond,
      base.recoverySpeedPixelsPerSecond,
      RUNTIME_MOTION_TUNING_LIMITS.recoverySpeedPixelsPerSecond
    ),
    retreatDistancePixels: clampNumber(
      patch.retreatDistancePixels,
      base.retreatDistancePixels,
      RUNTIME_MOTION_TUNING_LIMITS.retreatDistancePixels
    ),
    watchingPauseMs: clampNumber(
      patch.watchingPauseMs,
      base.watchingPauseMs,
      RUNTIME_MOTION_TUNING_LIMITS.watchingPauseMs
    )
  };
}

export function createRuntimeEmotionPhaseConfig(tuning: RuntimeMotionTuning): RuntimeEmotionMotionPhaseConfig {
  return {
    ...RUNTIME_EMOTION_MOTION_PHASE_CONFIG,
    watchingMs: tuning.watchingPauseMs
  };
}

export function createRuntimeStateTiming(tuning: RuntimeMotionTuning): RuntimePetStateTiming {
  return {
    ...RUNTIME_PET_STATE_TIMING,
    watchingToWaitingMs: tuning.watchingPauseMs
  };
}

export function createRuntimeRecoveryFollowConfig(tuning: RuntimeMotionTuning): RuntimeCursorFollowConfig {
  return {
    ...RUNTIME_CURSOR_FOLLOW_CONFIG,
    easingResponsiveness: 3.2,
    maxSpeedPixelsPerSecond: tuning.recoverySpeedPixelsPerSecond,
    settleDistance: 14
  };
}

export function formatRuntimeMotionTuningPreset(tuning: RuntimeMotionTuning): string {
  const resolved = resolveRuntimeMotionTuning(tuning);
  return [
    "DOUDOU_RUNTIME_TUNING=1",
    `DOUDOU_RUNTIME_RETREAT_DISTANCE=${resolved.retreatDistancePixels}`,
    `DOUDOU_RUNTIME_WATCH_MS=${resolved.watchingPauseMs}`,
    `DOUDOU_RUNTIME_RECOVERY_SPEED=${resolved.recoverySpeedPixelsPerSecond}`,
    "npm run dev"
  ].join(" ");
}

export function runtimeRetreatDistanceForTuning(
  memory: RuntimeEmotionMemory,
  baseDistance: number,
  tuning: RuntimeMotionTuning
): number {
  const safeBaseDistance = Number.isFinite(baseDistance) ? Math.max(1, baseDistance) : 1;
  const targetDistance = Math.max(safeBaseDistance, tuning.retreatDistancePixels);
  return safeBaseDistance + (targetDistance - safeBaseDistance) * clamp01(memory.wariness);
}

function clampNumber(value: number | undefined, fallback: number, range: { max: number; min: number }): number {
  const safeValue = Number.isFinite(value) ? Number(value) : fallback;
  return Math.min(range.max, Math.max(range.min, safeValue));
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}

import {
  DEFAULT_DOUDOU_EMOTION_IDS,
  type DefaultDoudouEmotionId
} from "./default-doudou-emotions.js";
import type { DoudouLive2DPreviewLibrary } from "./default-doudou-live2d-preview.js";
import {
  applyDoudouModelBehaviorCommandToRuntime,
  createDoudouLive2DBehaviorRuntimeTarget,
  queryDoudouEmotionModelBehavior,
  resolveDoudouEmotionModelBehaviorConfig,
  type DoudouEmotionModelBehaviorConfigPublicEvidence,
  type DoudouEmotionModelBehaviorFailureCode,
  type DoudouModelBehaviorCommand,
  type DoudouModelBehaviorRuntimeApplyResult,
  type DoudouModelBehaviorRuntimeTarget
} from "./default-doudou-model-behavior-api.js";
import type { DoudouModelArbitrationDecision } from "./default-doudou-live2d.js";

export type DoudouRuntimeEmotionBehaviorSkipReason = "empty_user_input" | "user_consent_required";

export interface DoudouRuntimeEmotionBehaviorTriggerInput {
  consent: boolean;
  currentEmotionId?: DefaultDoudouEmotionId;
  text: string;
}

export interface QueryDoudouEmotionBehaviorForExplicitRuntimeInputOptions {
  env?: Partial<Record<string, string | undefined>>;
  fetch?: (url: string, init?: RequestInit) => Promise<Response>;
  input: DoudouRuntimeEmotionBehaviorTriggerInput | unknown;
}

export type DoudouRuntimeEmotionBehaviorProviderEvidence =
  | {
    called: false;
  }
  | {
    called: true;
    model: string;
  };

export type DoudouRuntimeEmotionBehaviorTriggerResult =
  | {
    ok: true;
    provider: Extract<DoudouRuntimeEmotionBehaviorProviderEvidence, { called: false }>;
    providerConfig: DoudouEmotionModelBehaviorConfigPublicEvidence;
    reason: DoudouRuntimeEmotionBehaviorSkipReason;
    skipped: true;
  }
  | {
    command: DoudouModelBehaviorCommand;
    decision: DoudouModelArbitrationDecision;
    ok: true;
    provider: DoudouRuntimeEmotionBehaviorProviderEvidence;
    providerConfig: DoudouEmotionModelBehaviorConfigPublicEvidence;
    skipped: false;
  }
  | {
    code: DoudouEmotionModelBehaviorFailureCode;
    ok: false;
    provider: DoudouRuntimeEmotionBehaviorProviderEvidence;
    providerConfig: DoudouEmotionModelBehaviorConfigPublicEvidence;
    skipped: false;
  };

export type DoudouRuntimeEmotionBehaviorApplyResult =
  | DoudouModelBehaviorRuntimeApplyResult
  | {
    applied: false;
    expressionApplied: false;
    motionCueApplied: false;
    ok: true;
    reason: "provider_failed" | "trigger_skipped";
  };

export interface ApplyDoudouEmotionBehaviorTriggerResultToLive2DInput {
  applyMotionCue?: DoudouModelBehaviorRuntimeTarget["applyMotionCue"];
  library: DoudouLive2DPreviewLibrary;
  nowMs: number;
  result: DoudouRuntimeEmotionBehaviorTriggerResult;
  switchExpression: (
    library: DoudouLive2DPreviewLibrary,
    emotionId: DefaultDoudouEmotionId
  ) => Promise<boolean> | boolean;
}

const RUNTIME_EMOTION_INPUT_MAX_LENGTH = 240;

export async function queryDoudouEmotionBehaviorForExplicitRuntimeInput(
  options: QueryDoudouEmotionBehaviorForExplicitRuntimeInputOptions
): Promise<DoudouRuntimeEmotionBehaviorTriggerResult> {
  const config = resolveDoudouEmotionModelBehaviorConfig(options.env);
  const input = sanitizeDoudouEmotionBehaviorTriggerInput(options.input);

  if (!input.consent) {
    return skippedRuntimeEmotionBehaviorResult(config.publicEvidence, "user_consent_required");
  }
  if (input.text.length === 0) {
    return skippedRuntimeEmotionBehaviorResult(config.publicEvidence, "empty_user_input");
  }

  const result = await queryDoudouEmotionModelBehavior({
    apiKey: config.apiKey,
    endpoint: config.endpoint,
    fetch: options.fetch,
    input: {
      currentEmotionId: input.currentEmotionId ?? "calm_idle",
      runtimeStateLocked: false,
      safetyState: "clear",
      source: "llm",
      text: input.text,
      userVisionConsent: false
    },
    model: config.model
  });

  if (!result.ok) {
    return {
      code: result.code,
      ok: false,
      provider: providerEvidenceForFailure(result.code, config.model),
      providerConfig: config.publicEvidence,
      skipped: false
    };
  }

  return {
    command: result.command,
    decision: result.decision,
    ok: true,
    provider: result.provider,
    providerConfig: config.publicEvidence,
    skipped: false
  };
}

export async function applyDoudouEmotionBehaviorTriggerResultToLive2D(
  input: ApplyDoudouEmotionBehaviorTriggerResultToLive2DInput
): Promise<DoudouRuntimeEmotionBehaviorApplyResult> {
  if (!input.result.ok) {
    return {
      applied: false,
      expressionApplied: false,
      motionCueApplied: false,
      ok: true,
      reason: "provider_failed"
    };
  }
  if (input.result.skipped) {
    return {
      applied: false,
      expressionApplied: false,
      motionCueApplied: false,
      ok: true,
      reason: "trigger_skipped"
    };
  }

  return await applyDoudouModelBehaviorCommandToRuntime({
    command: input.result.command,
    nowMs: input.nowMs,
    target: createDoudouLive2DBehaviorRuntimeTarget({
      ...(input.applyMotionCue ? { applyMotionCue: input.applyMotionCue } : {}),
      library: input.library,
      switchExpression: input.switchExpression
    })
  });
}

export function sanitizeDoudouEmotionBehaviorTriggerInput(
  value: DoudouRuntimeEmotionBehaviorTriggerInput | unknown
): DoudouRuntimeEmotionBehaviorTriggerInput {
  const candidate = isRecord(value) ? value : {};
  return {
    consent: candidate.consent === true,
    currentEmotionId: isDefaultDoudouEmotionId(candidate.currentEmotionId)
      ? candidate.currentEmotionId
      : "calm_idle",
    text: sanitizeRuntimeEmotionInputText(candidate.text)
  };
}

function skippedRuntimeEmotionBehaviorResult(
  providerConfig: DoudouEmotionModelBehaviorConfigPublicEvidence,
  reason: DoudouRuntimeEmotionBehaviorSkipReason
): DoudouRuntimeEmotionBehaviorTriggerResult {
  return {
    ok: true,
    provider: {
      called: false
    },
    providerConfig,
    reason,
    skipped: true
  };
}

function providerEvidenceForFailure(
  code: DoudouEmotionModelBehaviorFailureCode,
  model: string | undefined
): DoudouRuntimeEmotionBehaviorProviderEvidence {
  if (code === "provider_not_configured" || !model) {
    return { called: false };
  }
  return {
    called: true,
    model
  };
}

function sanitizeRuntimeEmotionInputText(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim().replace(/\s+/g, " ").slice(0, RUNTIME_EMOTION_INPUT_MAX_LENGTH);
}

function isDefaultDoudouEmotionId(value: unknown): value is DefaultDoudouEmotionId {
  return typeof value === "string" && DEFAULT_DOUDOU_EMOTION_IDS.includes(value as DefaultDoudouEmotionId);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

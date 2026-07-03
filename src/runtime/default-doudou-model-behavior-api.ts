import {
  DEFAULT_DOUDOU_EMOTION_IDS,
  type DefaultDoudouEmotionId
} from "./default-doudou-emotions.js";
import {
  DEFAULT_DOUDOU_MODEL_ARBITRATION_RESPONSE_FORMAT,
  DEFAULT_DOUDOU_SAFE_MODEL_INTENTS,
  doudouArbitrateEmotionSuggestion,
  doudouLive2DExpressionForEmotion,
  type DoudouModelArbitrationContext,
  type DoudouModelArbitrationDecision,
  type DoudouModelArbitrationReason,
  type DoudouModelEmotionSuggestion,
  type DoudouModelSuggestionReasonCode,
  type DoudouModelSuggestionSource,
  type DoudouSafeModelIntent,
  type DoudouLive2DExpressionSpec
} from "./default-doudou-live2d.js";
import type { DoudouLive2DPreviewLibrary } from "./default-doudou-live2d-preview.js";

export type DoudouModelBehaviorCommand =
  | {
    emotionId: DefaultDoudouEmotionId;
    kind: "set_expression";
    motionCue: DoudouLive2DExpressionSpec["motionCue"];
    reason: "accepted";
    ttlMs: number;
  }
  | {
    emotionId: DefaultDoudouEmotionId;
    kind: "keep_current";
    reason: Exclude<DoudouModelArbitrationReason, "accepted">;
  };

export interface DoudouModelBehaviorCommandInput {
  context: DoudouModelArbitrationContext;
  suggestion: DoudouModelEmotionSuggestion;
}

export interface DoudouEmotionModelVisionInput {
  dataBase64: string;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  purpose: "qa_artifact" | "user_selected_asset";
}

export interface DoudouEmotionModelBehaviorInput extends DoudouModelArbitrationContext {
  source: DoudouModelSuggestionSource;
  text: string;
  visionInput?: DoudouEmotionModelVisionInput;
}

export interface QueryDoudouEmotionModelBehaviorInput {
  apiKey: string | undefined;
  endpoint: string | undefined;
  fetch?: (url: string, init?: RequestInit) => Promise<Response>;
  input: DoudouEmotionModelBehaviorInput;
  model: string | undefined;
  temperature?: number;
}

export interface DoudouEmotionModelBehaviorConfig {
  apiKey: string | undefined;
  endpoint: string | undefined;
  model: string | undefined;
  publicEvidence: DoudouEmotionModelBehaviorConfigPublicEvidence;
}

export interface DoudouEmotionModelBehaviorConfigPublicEvidence {
  apiKeyConfigured: boolean;
  configured: boolean;
  endpointConfigured: boolean;
  model?: string;
  modelConfigured: boolean;
}

export type DoudouEmotionModelBehaviorFailureCode =
  | "model_output_invalid"
  | "provider_error"
  | "provider_not_configured";

export type DoudouEmotionModelBehaviorResult =
  | {
    command: DoudouModelBehaviorCommand;
    decision: DoudouModelArbitrationDecision;
    ok: true;
    provider: {
      called: false;
    } | {
      called: true;
      model: string;
    };
    suggestion?: DoudouModelEmotionSuggestion;
  }
  | {
    code: DoudouEmotionModelBehaviorFailureCode;
    ok: false;
  };

type DoudouRejectedModelArbitrationDecision = DoudouModelArbitrationDecision & {
  accepted: false;
  reason: Exclude<DoudouModelArbitrationReason, "accepted">;
};

export interface DoudouModelBehaviorRuntimeExpressionInput {
  emotionId: DefaultDoudouEmotionId;
  motionCue: DoudouLive2DExpressionSpec["motionCue"];
  ttlMs: number;
}

export interface DoudouModelBehaviorRuntimeTarget {
  applyMotionCue?: (
    motionCue: DoudouLive2DExpressionSpec["motionCue"],
    emotionId: DefaultDoudouEmotionId,
    command: DoudouModelBehaviorCommand
  ) => Promise<boolean> | boolean;
  setExpression: (input: DoudouModelBehaviorRuntimeExpressionInput) => Promise<boolean> | boolean;
}

export interface DoudouLive2DBehaviorRuntimeTargetInput {
  applyMotionCue?: DoudouModelBehaviorRuntimeTarget["applyMotionCue"];
  library: DoudouLive2DPreviewLibrary;
  switchExpression: (
    library: DoudouLive2DPreviewLibrary,
    emotionId: DefaultDoudouEmotionId
  ) => Promise<boolean> | boolean;
}

export type DoudouModelBehaviorRuntimeApplyResult =
  | {
    applied: true;
    emotionId: DefaultDoudouEmotionId;
    expiresAtMs: number;
    expressionApplied: true;
    motionCueApplied: boolean;
    ok: true;
    reason: "accepted";
  }
  | {
    applied: false;
    emotionId: DefaultDoudouEmotionId;
    expressionApplied: false;
    motionCueApplied: false;
    ok: true;
    reason: Exclude<DoudouModelArbitrationReason, "accepted">;
  }
  | {
    applied: false;
    code: "runtime_expression_rejected";
    emotionId: DefaultDoudouEmotionId;
    expressionApplied: false;
    motionCueApplied: false;
    ok: false;
  };

const DOUDOU_MODEL_SUGGESTION_KEYS = [
  "confidence",
  "intent",
  "reasonCode",
  "source",
  "suggestedEmotionId",
  "ttlMs"
] as const;

const DOUDOU_MODEL_REASON_CODES: readonly DoudouModelSuggestionReasonCode[] = [
  "user_positive_text",
  "user_low_mood_text",
  "user_affection_text",
  "user_focus_context",
  "quiet_time",
  "explicit_user_prompt",
  "user_selected_asset_quality",
  "safety_refusal"
] as const;

export function resolveDoudouEmotionModelBehaviorConfig(
  env: Partial<Record<string, string | undefined>> = defaultDoudouEmotionModelEnv()
): DoudouEmotionModelBehaviorConfig {
  const apiKey = nonEmptyEnvValue(env.DOUDOU_EMOTION_MODEL_API_KEY);
  const endpoint = nonEmptyEnvValue(env.DOUDOU_EMOTION_MODEL_ENDPOINT);
  const model = nonEmptyEnvValue(env.DOUDOU_EMOTION_MODEL_ID);
  return {
    apiKey,
    endpoint,
    model,
    publicEvidence: {
      apiKeyConfigured: Boolean(apiKey),
      configured: Boolean(apiKey && endpoint && model),
      endpointConfigured: Boolean(endpoint),
      ...(model ? { model } : {}),
      modelConfigured: Boolean(model)
    }
  };
}

export function createDoudouModelBehaviorCommand(
  input: DoudouModelBehaviorCommandInput
): DoudouModelBehaviorCommand {
  const decision = doudouArbitrateEmotionSuggestion(input.suggestion, input.context);
  return modelBehaviorCommandFromDecision(decision, input.suggestion.ttlMs);
}

function modelBehaviorCommandFromDecision(
  decision: DoudouModelArbitrationDecision,
  ttlMs: number
): DoudouModelBehaviorCommand {
  if (decision.reason !== "accepted") {
    return keepCurrentCommand(decision.emotionId, decision.reason);
  }
  return {
    emotionId: decision.emotionId,
    kind: "set_expression",
    motionCue: doudouLive2DExpressionForEmotion(decision.emotionId).motionCue,
    reason: "accepted",
    ttlMs
  };
}

export async function queryDoudouEmotionModelBehavior(
  input: QueryDoudouEmotionModelBehaviorInput
): Promise<DoudouEmotionModelBehaviorResult> {
  const preflightDecision = preflightModelBehaviorDecision(input.input);
  if (preflightDecision) {
    return {
      command: keepCurrentCommand(preflightDecision.emotionId, preflightDecision.reason),
      decision: preflightDecision,
      ok: true,
      provider: {
        called: false
      }
    };
  }

  if (!input.endpoint || !input.apiKey || !input.model) {
    return { code: "provider_not_configured", ok: false };
  }
  const fetchImplementation = input.fetch ?? globalThis.fetch;
  if (!fetchImplementation) {
    return { code: "provider_not_configured", ok: false };
  }

  let response: Response;
  try {
    response = await fetchImplementation(input.endpoint, {
      body: JSON.stringify(createEmotionModelRequestBody(input)),
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        "Content-Type": "application/json"
      },
      method: "POST"
    });
  } catch {
    return { code: "provider_error", ok: false };
  }

  if (!response.ok) {
    return { code: "provider_error", ok: false };
  }

  const suggestion = await parseEmotionSuggestionFromChatCompletionResponse(response, input.input.source);
  if (!suggestion) {
    return { code: "model_output_invalid", ok: false };
  }
  const context = modelArbitrationContextFromInput(input.input);
  const decision = doudouArbitrateEmotionSuggestion(suggestion, context);
  return {
    command: modelBehaviorCommandFromDecision(decision, suggestion.ttlMs),
    decision,
    ok: true,
    provider: {
      called: true,
      model: input.model
    },
    suggestion
  };
}

export async function applyDoudouModelBehaviorCommandToRuntime(input: {
  command: DoudouModelBehaviorCommand;
  nowMs: number;
  target: DoudouModelBehaviorRuntimeTarget;
}): Promise<DoudouModelBehaviorRuntimeApplyResult> {
  if (input.command.kind === "keep_current") {
    return {
      applied: false,
      emotionId: input.command.emotionId,
      expressionApplied: false,
      motionCueApplied: false,
      ok: true,
      reason: input.command.reason
    };
  }

  let expressionAccepted = false;
  try {
    expressionAccepted = await input.target.setExpression({
      emotionId: input.command.emotionId,
      motionCue: input.command.motionCue,
      ttlMs: input.command.ttlMs
    });
  } catch {
    expressionAccepted = false;
  }

  if (!expressionAccepted) {
    return {
      applied: false,
      code: "runtime_expression_rejected",
      emotionId: input.command.emotionId,
      expressionApplied: false,
      motionCueApplied: false,
      ok: false
    };
  }

  let motionCueApplied = false;
  if (input.command.motionCue !== "none" && input.target.applyMotionCue) {
    try {
      motionCueApplied = await input.target.applyMotionCue(
        input.command.motionCue,
        input.command.emotionId,
        input.command
      );
    } catch {
      motionCueApplied = false;
    }
  }

  return {
    applied: true,
    emotionId: input.command.emotionId,
    expiresAtMs: input.nowMs + input.command.ttlMs,
    expressionApplied: true,
    motionCueApplied,
    ok: true,
    reason: "accepted"
  };
}

export function createDoudouLive2DBehaviorRuntimeTarget(
  input: DoudouLive2DBehaviorRuntimeTargetInput
): DoudouModelBehaviorRuntimeTarget {
  return {
    ...(input.applyMotionCue ? { applyMotionCue: input.applyMotionCue } : {}),
    setExpression: async ({ emotionId }) => await input.switchExpression(input.library, emotionId)
  };
}

function preflightModelBehaviorDecision(
  input: DoudouEmotionModelBehaviorInput
): DoudouRejectedModelArbitrationDecision | null {
  if (input.safetyState === "blocked") {
    return { accepted: false, emotionId: input.currentEmotionId, reason: "safety_blocked" };
  }
  if (input.runtimeStateLocked) {
    return { accepted: false, emotionId: input.currentEmotionId, reason: "runtime_state_locked" };
  }
  if (input.source === "vlm" && !input.userVisionConsent) {
    return { accepted: false, emotionId: input.currentEmotionId, reason: "vision_without_consent" };
  }
  return null;
}

function modelArbitrationContextFromInput(input: DoudouEmotionModelBehaviorInput): DoudouModelArbitrationContext {
  return {
    currentEmotionId: input.currentEmotionId,
    runtimeStateLocked: input.runtimeStateLocked,
    safetyState: input.safetyState,
    userVisionConsent: input.userVisionConsent
  };
}

function keepCurrentCommand(
  emotionId: DefaultDoudouEmotionId,
  reason: Exclude<DoudouModelArbitrationReason, "accepted">
): DoudouModelBehaviorCommand {
  return {
    emotionId,
    kind: "keep_current",
    reason
  };
}

function createEmotionModelRequestBody(input: QueryDoudouEmotionModelBehaviorInput): Record<string, unknown> {
  return {
    messages: [
      {
        content: [
          "你是兜兜桌宠的情绪仲裁器。",
          "只返回符合 response_format JSON schema 的对象。",
          "不要输出 Live2D 参数、表情文件名、动作名、自由文本、源图路径、屏幕内容或 provider payload。"
        ].join("\n"),
        role: "system"
      },
      {
        content: createEmotionModelUserMessageContent(input.input),
        role: "user"
      }
    ],
    model: input.model,
    response_format: DEFAULT_DOUDOU_MODEL_ARBITRATION_RESPONSE_FORMAT,
    temperature: input.temperature ?? 0.2
  };
}

function createEmotionModelUserMessageContent(input: DoudouEmotionModelBehaviorInput): unknown {
  const text = JSON.stringify({
    allowedEmotionIds: DEFAULT_DOUDOU_EMOTION_IDS,
    allowedIntents: DEFAULT_DOUDOU_SAFE_MODEL_INTENTS,
    currentEmotionId: input.currentEmotionId,
    source: input.source,
    text: input.text,
    ...(input.source === "vlm" && input.visionInput
      ? { visionPurpose: input.visionInput.purpose }
      : {})
  });

  if (input.source !== "vlm" || !input.userVisionConsent || !input.visionInput) {
    return text;
  }

  return [
    {
      text,
      type: "text"
    },
    {
      image_url: {
        detail: "low",
        url: `data:${input.visionInput.mimeType};base64,${input.visionInput.dataBase64}`
      },
      type: "image_url"
    }
  ];
}

async function parseEmotionSuggestionFromChatCompletionResponse(
  response: Response,
  expectedSource: DoudouModelSuggestionSource
): Promise<DoudouModelEmotionSuggestion | null> {
  try {
    const payload = await response.json() as unknown;
    const content = chatCompletionContent(payload);
    if (!content) {
      return null;
    }
    return sanitizeEmotionSuggestion(JSON.parse(stripJsonCodeFence(content)) as unknown, expectedSource);
  } catch {
    return null;
  }
}

function chatCompletionContent(payload: unknown): string | null {
  if (!isRecord(payload) || !Array.isArray(payload.choices)) {
    return null;
  }
  const firstChoice = payload.choices[0] as unknown;
  if (!isRecord(firstChoice) || !isRecord(firstChoice.message)) {
    return null;
  }
  const content = firstChoice.message.content;
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    for (const contentPart of content) {
      if (isRecord(contentPart) && typeof contentPart.text === "string") {
        return contentPart.text;
      }
    }
  }
  return null;
}

function sanitizeEmotionSuggestion(
  value: unknown,
  expectedSource: DoudouModelSuggestionSource
): DoudouModelEmotionSuggestion | null {
  if (!isRecord(value) || !hasExactSuggestionKeys(value)) {
    return null;
  }
  const suggestion = value as Record<typeof DOUDOU_MODEL_SUGGESTION_KEYS[number], unknown>;
  if (suggestion.source !== expectedSource || !isSuggestionSource(suggestion.source)) {
    return null;
  }
  if (!isSafeModelIntent(suggestion.intent)) {
    return null;
  }
  if (!isDefaultDoudouEmotionId(suggestion.suggestedEmotionId)) {
    return null;
  }
  if (!isFiniteRangeNumber(suggestion.confidence, 0, 1)) {
    return null;
  }
  if (!isReasonCode(suggestion.reasonCode)) {
    return null;
  }
  const ttlMs = suggestion.ttlMs;
  if (typeof ttlMs !== "number" || !Number.isInteger(ttlMs) || ttlMs < 1000 || ttlMs > 30000) {
    return null;
  }
  return {
    confidence: suggestion.confidence,
    intent: suggestion.intent,
    reasonCode: suggestion.reasonCode,
    source: suggestion.source,
    suggestedEmotionId: suggestion.suggestedEmotionId,
    ttlMs
  };
}

function hasExactSuggestionKeys(value: Record<string, unknown>): boolean {
  const keys = Object.keys(value).sort();
  return keys.length === DOUDOU_MODEL_SUGGESTION_KEYS.length &&
    DOUDOU_MODEL_SUGGESTION_KEYS.every((key, index) => keys[index] === key);
}

function isSuggestionSource(value: unknown): value is DoudouModelSuggestionSource {
  return value === "llm" || value === "vlm";
}

function isSafeModelIntent(value: unknown): value is DoudouSafeModelIntent {
  return typeof value === "string" && DEFAULT_DOUDOU_SAFE_MODEL_INTENTS.includes(value as DoudouSafeModelIntent);
}

function isDefaultDoudouEmotionId(value: unknown): value is DefaultDoudouEmotionId {
  return typeof value === "string" && DEFAULT_DOUDOU_EMOTION_IDS.includes(value as DefaultDoudouEmotionId);
}

function isReasonCode(value: unknown): value is DoudouModelSuggestionReasonCode {
  return typeof value === "string" && DOUDOU_MODEL_REASON_CODES.includes(value as DoudouModelSuggestionReasonCode);
}

function isFiniteRangeNumber(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

function stripJsonCodeFence(content: string): string {
  const trimmed = content.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return fenced?.[1] ?? trimmed;
}

function nonEmptyEnvValue(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function defaultDoudouEmotionModelEnv(): Partial<Record<string, string | undefined>> {
  return typeof process === "undefined" ? {} : process.env;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

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

export interface DoudouEmotionModelBehaviorInput extends DoudouModelArbitrationContext {
  source: DoudouModelSuggestionSource;
  text: string;
}

export interface QueryDoudouEmotionModelBehaviorInput {
  apiKey: string | undefined;
  endpoint: string | undefined;
  fetch?: (url: string, init?: RequestInit) => Promise<Response>;
  input: DoudouEmotionModelBehaviorInput;
  model: string | undefined;
  temperature?: number;
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
        content: JSON.stringify({
          allowedEmotionIds: DEFAULT_DOUDOU_EMOTION_IDS,
          allowedIntents: DEFAULT_DOUDOU_SAFE_MODEL_INTENTS,
          currentEmotionId: input.input.currentEmotionId,
          source: input.input.source,
          text: input.input.text
        }),
        role: "user"
      }
    ],
    model: input.model,
    response_format: DEFAULT_DOUDOU_MODEL_ARBITRATION_RESPONSE_FORMAT,
    temperature: input.temperature ?? 0.2
  };
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
    return sanitizeEmotionSuggestion(JSON.parse(content) as unknown, expectedSource);
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
  return typeof firstChoice.message.content === "string" ? firstChoice.message.content : null;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  DEFAULT_DOUDOU_EMOTION_IDS,
  type DefaultDoudouEmotionId
} from "./default-doudou-emotions.js";
import {
  doudouArbitrateEmotionSuggestion,
  doudouLive2DExpressionForEmotion,
  type DoudouLive2DExpressionSpec,
  type DoudouModelArbitrationContext,
  type DoudouModelArbitrationDecision,
  type DoudouModelEmotionSuggestion
} from "./default-doudou-live2d.js";
import {
  type DoudouLive2DExp3Json,
  validateDoudouLive2DExp3Directory
} from "./default-doudou-exp3.js";

export interface DoudouLive2DPreviewLoadRequest {
  emotionId: DefaultDoudouEmotionId;
  expressionName: string;
  expressionFile: DoudouLive2DExpressionSpec["expressionFile"];
  motionCue: DoudouLive2DExpressionSpec["motionCue"];
  fadeInTime: number;
  fadeOutTime: number;
  parameterCount: number;
  expressionJson: DoudouLive2DExp3Json;
}

export interface DoudouLive2DPreviewLibrary {
  expressionCount: number;
  loadRequests: readonly DoudouLive2DPreviewLoadRequest[];
  byEmotion: Record<DefaultDoudouEmotionId, DoudouLive2DPreviewLoadRequest>;
}

export interface DoudouLive2DPreviewState {
  currentEmotionId: DefaultDoudouEmotionId;
  activeExpressionFile: DoudouLive2DExpressionSpec["expressionFile"];
  activeExpressionName: string;
  lastSwitchAtMs: number | null;
}

export interface DoudouLive2DPreviewTransition {
  fromEmotionId: DefaultDoudouEmotionId;
  toEmotionId: DefaultDoudouEmotionId;
  expressionFile: DoudouLive2DExpressionSpec["expressionFile"];
  expressionName: string;
  motionCue: DoudouLive2DExpressionSpec["motionCue"];
  startedAtMs: number;
  fadeInTime: number;
  fadeOutTime: number;
  parameterCount: number;
  cubismExpression: DoudouLive2DExp3Json;
}

export interface DoudouLive2DPreviewSwitchResult {
  state: DoudouLive2DPreviewState;
  transition: DoudouLive2DPreviewTransition;
}

export interface DoudouLive2DArbitratedPreviewSwitchResult {
  decision: DoudouModelArbitrationDecision;
  state: DoudouLive2DPreviewState;
  transition: DoudouLive2DPreviewTransition | null;
}

export async function loadDefaultDoudouLive2DPreviewLibrary(
  expressionsDir: string
): Promise<DoudouLive2DPreviewLibrary> {
  const validation = await validateDoudouLive2DExp3Directory(expressionsDir);
  if (!validation.ok) {
    throw new Error(`Default Doudou Live2D preview expressions are invalid: ${validation.issues.join("; ")}`);
  }

  const byEmotion = {} as Record<DefaultDoudouEmotionId, DoudouLive2DPreviewLoadRequest>;
  const loadRequests: DoudouLive2DPreviewLoadRequest[] = [];
  for (const emotionId of DEFAULT_DOUDOU_EMOTION_IDS) {
    const spec = doudouLive2DExpressionForEmotion(emotionId);
    const expressionJson = JSON.parse(await readFile(path.join(expressionsDir, spec.expressionFile), "utf8")) as
      DoudouLive2DExp3Json;
    const request: DoudouLive2DPreviewLoadRequest = {
      emotionId,
      expressionName: spec.expressionName,
      expressionFile: spec.expressionFile,
      motionCue: spec.motionCue,
      fadeInTime: expressionJson.FadeInTime,
      fadeOutTime: expressionJson.FadeOutTime,
      parameterCount: expressionJson.Parameters.length,
      expressionJson
    };
    byEmotion[emotionId] = request;
    loadRequests.push(request);
  }

  return {
    expressionCount: loadRequests.length,
    loadRequests,
    byEmotion
  };
}

export function createDoudouLive2DPreviewState(
  library: DoudouLive2DPreviewLibrary,
  initialEmotionId: DefaultDoudouEmotionId
): DoudouLive2DPreviewState {
  const expression = expressionForEmotion(library, initialEmotionId);
  return {
    currentEmotionId: initialEmotionId,
    activeExpressionFile: expression.expressionFile,
    activeExpressionName: expression.expressionName,
    lastSwitchAtMs: null
  };
}

export function switchDoudouLive2DPreviewExpression(
  library: DoudouLive2DPreviewLibrary,
  state: DoudouLive2DPreviewState,
  targetEmotionId: DefaultDoudouEmotionId,
  nowMs: number
): DoudouLive2DPreviewSwitchResult {
  const expression = expressionForEmotion(library, targetEmotionId);
  const nextState: DoudouLive2DPreviewState = {
    currentEmotionId: targetEmotionId,
    activeExpressionFile: expression.expressionFile,
    activeExpressionName: expression.expressionName,
    lastSwitchAtMs: nowMs
  };
  return {
    state: nextState,
    transition: {
      fromEmotionId: state.currentEmotionId,
      toEmotionId: targetEmotionId,
      expressionFile: expression.expressionFile,
      expressionName: expression.expressionName,
      motionCue: expression.motionCue,
      startedAtMs: nowMs,
      fadeInTime: expression.fadeInTime,
      fadeOutTime: expression.fadeOutTime,
      parameterCount: expression.parameterCount,
      cubismExpression: expression.expressionJson
    }
  };
}

export function applyDoudouLive2DArbitratedPreviewSwitch(
  library: DoudouLive2DPreviewLibrary,
  state: DoudouLive2DPreviewState,
  suggestion: DoudouModelEmotionSuggestion,
  context: DoudouModelArbitrationContext,
  nowMs: number
): DoudouLive2DArbitratedPreviewSwitchResult {
  const decision = doudouArbitrateEmotionSuggestion(suggestion, context);
  if (!decision.accepted) {
    return {
      decision,
      state,
      transition: null
    };
  }

  const switchResult = switchDoudouLive2DPreviewExpression(library, state, decision.emotionId, nowMs);
  return {
    decision,
    state: switchResult.state,
    transition: switchResult.transition
  };
}

function expressionForEmotion(
  library: DoudouLive2DPreviewLibrary,
  emotionId: DefaultDoudouEmotionId
): DoudouLive2DPreviewLoadRequest {
  const expression = library.byEmotion[emotionId];
  if (!expression) {
    throw new Error(`Unknown default Doudou Live2D preview emotion: ${emotionId}`);
  }
  return expression;
}

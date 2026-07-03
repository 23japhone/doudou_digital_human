import { type DefaultDoudouEmotionId } from "./default-doudou-emotions.js";
import {
  createDoudouLive2DCubismAdapter,
  type DoudouCubismExpressionApplyResult,
  type DoudouCubismExpressionLoadResult,
  type DoudouCubismMotionPriority
} from "./default-doudou-live2d-cubism-adapter.js";
import {
  type DoudouLive2DPreviewLibrary,
  type DoudouLive2DPreviewTransition
} from "./default-doudou-live2d-preview.js";
import {
  createDoudouWebCubismExpressionBackend,
  type DoudouWebCubismExpressionMotion
} from "./default-doudou-live2d-web-cubism-backend.js";

export interface DoudouWebCubismRendererSpikeRuntime {
  CubismExpressionMotion: {
    create: (buffer: ArrayBuffer, size: number) => DoudouWebCubismExpressionMotion;
  };
  expressionManager: {
    startMotionPriority: (
      motion: DoudouWebCubismExpressionMotion,
      autoDelete: boolean,
      priority: number
    ) => unknown;
    updateMotion: (model: DoudouWebCubismModel, deltaTimeSeconds: number) => unknown;
  };
  model: DoudouWebCubismModel;
  renderer: {
    drawModel: (shaderPath?: string) => unknown;
  };
}

export type DoudouWebCubismModel = object & {
  update: () => unknown;
};

export interface DoudouWebCubismRendererSpikeOptions {
  modelId: "default-doudou";
  model3Json: "default-doudou.model3.json";
  runtime: DoudouWebCubismRendererSpikeRuntime;
  shaderPath?: string;
}

export interface DoudouWebCubismRendererModelLoadResult extends DoudouCubismExpressionLoadResult {
  model: {
    modelId: "default-doudou";
    model3Json: "default-doudou.model3.json";
  };
}

export interface DoudouWebCubismRendererSpikeEvidence {
  activeEmotionId: DefaultDoudouEmotionId;
  drawModelCalls: number;
  expressionCount: number;
  expressionOverlayApplied: boolean;
  expressionSwitches: number;
  frameLoopAdvanced: boolean;
  modelId: "default-doudou";
  model3Json: "default-doudou.model3.json";
  modelLoaded: boolean;
  modelUpdateCalls: number;
  updateMotionCalls: number;
}

export interface DoudouWebCubismRendererFrameResult {
  deltaTimeSeconds: number;
  evidence: DoudouWebCubismRendererSpikeEvidence;
}

export interface DoudouWebCubismRendererSpike {
  evidence: () => DoudouWebCubismRendererSpikeEvidence;
  loadDefaultModel: (library: DoudouLive2DPreviewLibrary) => DoudouWebCubismRendererModelLoadResult;
  renderFrame: (timestampMs: number) => DoudouWebCubismRendererFrameResult;
  switchExpression: (
    library: DoudouLive2DPreviewLibrary,
    fromEmotionId: DefaultDoudouEmotionId,
    toEmotionId: DefaultDoudouEmotionId,
    nowMs: number,
    priority: DoudouCubismMotionPriority
  ) => DoudouCubismExpressionApplyResult;
}

export function createDoudouWebCubismRendererSpike(
  options: DoudouWebCubismRendererSpikeOptions
): DoudouWebCubismRendererSpike {
  const adapter = createDoudouLive2DCubismAdapter(
    createDoudouWebCubismExpressionBackend({
      CubismExpressionMotion: options.runtime.CubismExpressionMotion,
      motionManager: options.runtime.expressionManager
    })
  );
  let activeEmotionId: DefaultDoudouEmotionId = "calm_idle";
  let drawModelCalls = 0;
  let expressionCount = 0;
  let expressionSwitches = 0;
  let lastFrameAtMs: number | null = null;
  let modelLoaded = false;
  let modelUpdateCalls = 0;
  let updateMotionCalls = 0;

  return {
    evidence,

    loadDefaultModel(library) {
      const loadResult = adapter.loadExpressions(library.loadRequests);
      expressionCount = loadResult.expressionCount;
      modelLoaded = true;
      return {
        ...loadResult,
        model: {
          modelId: options.modelId,
          model3Json: options.model3Json
        }
      };
    },

    renderFrame(timestampMs) {
      const deltaTimeSeconds = lastFrameAtMs === null ? 0 : Math.max(0, (timestampMs - lastFrameAtMs) / 1000);
      lastFrameAtMs = timestampMs;
      options.runtime.expressionManager.updateMotion(options.runtime.model, deltaTimeSeconds);
      updateMotionCalls += 1;
      options.runtime.model.update();
      modelUpdateCalls += 1;
      options.runtime.renderer.drawModel(options.shaderPath);
      drawModelCalls += 1;
      return {
        deltaTimeSeconds,
        evidence: evidence()
      };
    },

    switchExpression(library, fromEmotionId, toEmotionId, nowMs, priority) {
      const transition = createPreviewTransition(
        library,
        modelLoaded ? activeEmotionId : fromEmotionId,
        toEmotionId,
        nowMs
      );
      const playback = adapter.applyTransition(transition, { priority });
      if (playback.ok) {
        activeEmotionId = toEmotionId;
        expressionSwitches += 1;
      }
      return playback;
    }
  };

  function evidence(): DoudouWebCubismRendererSpikeEvidence {
    return {
      activeEmotionId,
      drawModelCalls,
      expressionCount,
      expressionOverlayApplied: expressionSwitches > 0 && updateMotionCalls > 0,
      expressionSwitches,
      frameLoopAdvanced: drawModelCalls >= 2 && updateMotionCalls >= 2 && modelUpdateCalls >= 2,
      modelId: options.modelId,
      model3Json: options.model3Json,
      modelLoaded,
      modelUpdateCalls,
      updateMotionCalls
    };
  }
}

function createPreviewTransition(
  library: DoudouLive2DPreviewLibrary,
  fromEmotionId: DefaultDoudouEmotionId,
  toEmotionId: DefaultDoudouEmotionId,
  nowMs: number
): DoudouLive2DPreviewTransition {
  const expression = library.byEmotion[toEmotionId];
  if (!expression) {
    throw new Error(`Unknown default Doudou Web Cubism renderer emotion: ${toEmotionId}`);
  }
  return {
    fromEmotionId,
    toEmotionId,
    expressionFile: expression.expressionFile,
    expressionName: expression.expressionName,
    motionCue: expression.motionCue,
    startedAtMs: nowMs,
    fadeInTime: expression.fadeInTime,
    fadeOutTime: expression.fadeOutTime,
    parameterCount: expression.parameterCount,
    cubismExpression: expression.expressionJson
  };
}

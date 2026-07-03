import type { DefaultDoudouEmotionId } from "./default-doudou-emotions.js";
import type {
  DoudouOfficialLive2DRendererRuntimeAssets,
  DoudouOfficialLive2DRendererRuntimeEvidence
} from "./default-doudou-live2d-official-sdk-resolver.js";
import type { DoudouLive2DPreviewLibrary, DoudouLive2DPreviewLoadRequest } from "./default-doudou-live2d-preview.js";

export type DoudouOfficialLive2DRendererRuntimeModuleProbe =
  | "not_configured"
  | "load_pending"
  | "loaded"
  | "load_failed"
  | "model_failed";

export interface DoudouOfficialLive2DRendererHostEvidence {
  activeEmotionId: DefaultDoudouEmotionId;
  drawCalls: number;
  expressionAppliedAfterFrame: boolean;
  expressionCount: number;
  expressionEmotionIdsObserved: DefaultDoudouEmotionId[];
  expressionSwitches: number;
  frameLoopAdvanced: boolean;
  modelLoaded: boolean;
  runtimeModuleProbe: DoudouOfficialLive2DRendererRuntimeModuleProbe;
  updateCalls: number;
}

export interface DoudouOfficialLive2DRendererRuntimeCreateOptions {
  assets: DoudouOfficialLive2DRendererRuntimeAssets;
  canvas: HTMLCanvasElement;
  library: DoudouLive2DPreviewLibrary;
  model3Json: "default-doudou.model3.json";
  modelId: "default-doudou";
}

export interface DoudouOfficialLive2DRendererRuntimeLoadModelInput {
  model3Json: "default-doudou.model3.json";
  model3JsonUrl: string;
  modelId: "default-doudou";
  modelRootUrl: string;
}

export interface DoudouOfficialLive2DRendererRuntimeExpressionInput extends DoudouLive2DPreviewLoadRequest {}

export interface DoudouOfficialLive2DRendererRuntime {
  draw: () => unknown;
  loadExpression?: (input: DoudouOfficialLive2DRendererRuntimeExpressionInput) => Promise<unknown> | unknown;
  loadModel: (input: DoudouOfficialLive2DRendererRuntimeLoadModelInput) => Promise<unknown> | unknown;
  setExpression: (input: DoudouOfficialLive2DRendererRuntimeExpressionInput) => Promise<unknown> | unknown;
  update: (deltaTimeSeconds: number) => unknown;
}

export interface DoudouOfficialLive2DRendererRuntimeModule {
  createDoudouOfficialLive2DRendererRuntime: (
    options: DoudouOfficialLive2DRendererRuntimeCreateOptions
  ) => Promise<DoudouOfficialLive2DRendererRuntime> | DoudouOfficialLive2DRendererRuntime;
}

export interface DoudouOfficialLive2DRendererHostOptions {
  canvas: HTMLCanvasElement;
  config: {
    publicEvidence: DoudouOfficialLive2DRendererRuntimeEvidence;
    rendererAssets?: DoudouOfficialLive2DRendererRuntimeAssets;
  };
  importRuntimeModule: (moduleUrl: string) => Promise<DoudouOfficialLive2DRendererRuntimeModule>;
  loadCoreScript: (coreScriptUrl: string) => Promise<void>;
}

export interface DoudouOfficialLive2DRendererHost {
  evidence: () => DoudouOfficialLive2DRendererHostEvidence;
  loadDefaultModel: (library: DoudouLive2DPreviewLibrary) => Promise<DoudouOfficialLive2DRendererHostEvidence>;
  renderFrame: (timestampMs: number) => DoudouOfficialLive2DRendererHostEvidence;
  switchExpression: (
    library: DoudouLive2DPreviewLibrary,
    emotionId: DefaultDoudouEmotionId
  ) => Promise<boolean>;
}

export function createDoudouOfficialLive2DRendererHost(
  options: DoudouOfficialLive2DRendererHostOptions
): DoudouOfficialLive2DRendererHost {
  let activeEmotionId: DefaultDoudouEmotionId = "calm_idle";
  let drawCalls = 0;
  let expressionNeedsFrame = false;
  let expressionCount = 0;
  const expressionEmotionIdsObserved: DefaultDoudouEmotionId[] = [];
  let expressionSwitches = 0;
  let lastFrameAtMs: number | null = null;
  let modelLoaded = false;
  let runtime: DoudouOfficialLive2DRendererRuntime | null = null;
  let runtimeModuleProbe: DoudouOfficialLive2DRendererRuntimeModuleProbe = initialRuntimeModuleProbe(options);
  let updateCalls = 0;

  return {
    evidence,

    async loadDefaultModel(library) {
      const assets = options.config.rendererAssets;
      if (!assets?.runtimeModuleUrl) {
        runtimeModuleProbe = "not_configured";
        return evidence();
      }

      runtimeModuleProbe = "load_pending";
      let module: DoudouOfficialLive2DRendererRuntimeModule;
      try {
        await options.loadCoreScript(assets.coreScriptUrl);
        module = await options.importRuntimeModule(assets.runtimeModuleUrl);
        if (typeof module.createDoudouOfficialLive2DRendererRuntime !== "function") {
          runtimeModuleProbe = "load_failed";
          return evidence();
        }
        runtime = await module.createDoudouOfficialLive2DRendererRuntime({
          assets,
          canvas: options.canvas,
          library,
          model3Json: "default-doudou.model3.json",
          modelId: "default-doudou"
        });
      } catch {
        runtimeModuleProbe = "load_failed";
        return evidence();
      }

      try {
        await runtime.loadModel({
          model3Json: "default-doudou.model3.json",
          model3JsonUrl: assets.model3JsonUrl,
          modelId: "default-doudou",
          modelRootUrl: assets.modelRootUrl
        });
        for (const request of library.loadRequests) {
          await runtime.loadExpression?.(request);
        }
      } catch {
        runtime = null;
        runtimeModuleProbe = "model_failed";
        return evidence();
      }

      expressionCount = library.expressionCount;
      modelLoaded = true;
      runtimeModuleProbe = "loaded";
      return evidence();
    },

    renderFrame(timestampMs) {
      if (!runtime || runtimeModuleProbe !== "loaded") {
        return evidence();
      }
      const deltaTimeSeconds = lastFrameAtMs === null ? 0 : Math.max(0, (timestampMs - lastFrameAtMs) / 1000);
      lastFrameAtMs = timestampMs;
      try {
        runtime.update(deltaTimeSeconds);
        updateCalls += 1;
        runtime.draw();
        drawCalls += 1;
        if (expressionNeedsFrame && activeEmotionId !== "calm_idle") {
          expressionNeedsFrame = false;
        }
      } catch {
        runtimeModuleProbe = "model_failed";
      }
      return evidence();
    },

    async switchExpression(library, emotionId) {
      if (!runtime || runtimeModuleProbe !== "loaded") {
        return false;
      }
      const expression = library.byEmotion[emotionId];
      if (!expression) {
        return false;
      }
      try {
        await runtime.setExpression(expression);
      } catch {
        runtimeModuleProbe = "model_failed";
        return false;
      }
      activeEmotionId = emotionId;
      expressionSwitches += 1;
      expressionNeedsFrame = true;
      recordObservedExpressionEmotion(emotionId);
      return true;
    }
  };

  function evidence(): DoudouOfficialLive2DRendererHostEvidence {
    return {
      activeEmotionId,
      drawCalls,
      expressionAppliedAfterFrame: expressionSwitches > 0 && activeEmotionId !== "calm_idle" && !expressionNeedsFrame,
      expressionCount,
      expressionEmotionIdsObserved: expressionEmotionIdsObserved.slice(),
      expressionSwitches,
      frameLoopAdvanced: updateCalls >= 2 && drawCalls >= 2,
      modelLoaded,
      runtimeModuleProbe,
      updateCalls
    };
  }

  function recordObservedExpressionEmotion(emotionId: DefaultDoudouEmotionId): void {
    if (emotionId === "calm_idle" || expressionEmotionIdsObserved.includes(emotionId)) {
      return;
    }
    expressionEmotionIdsObserved.push(emotionId);
  }
}

function initialRuntimeModuleProbe(
  options: DoudouOfficialLive2DRendererHostOptions
): DoudouOfficialLive2DRendererRuntimeModuleProbe {
  if (!options.config.publicEvidence.runtimeModule?.configured || !options.config.rendererAssets?.runtimeModuleUrl) {
    return "not_configured";
  }
  return "load_pending";
}

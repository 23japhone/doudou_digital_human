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

export type DoudouOfficialLive2DRendererRuntimeFailureReason =
  | "core_or_module_load_failed"
  | "model_or_expression_load_failed"
  | "expression_switch_rejected"
  | "frame_failed";

export interface DoudouOfficialLive2DRendererHostEvidence {
  activeEmotionId: DefaultDoudouEmotionId;
  drawCalls: number;
  expressionAppliedAfterFrame: boolean;
  expressionCanvasChangedAfterFrame: boolean;
  expressionCount: number;
  expressionEmotionIdsObserved: DefaultDoudouEmotionId[];
  expressionSwitches: number;
  frameLoopAdvanced: boolean;
  modelLoaded: boolean;
  pendingExpressionSwitches: number;
  runtimeFailureReason: DoudouOfficialLive2DRendererRuntimeFailureReason | null;
  runtimeLifecycle: DoudouOfficialLive2DRendererRuntimeLifecycleEvidence;
  runtimeModuleProbe: DoudouOfficialLive2DRendererRuntimeModuleProbe;
  updateCalls: number;
}

export interface DoudouOfficialLive2DRendererRuntimeLifecycleEvidence {
  drawCalls: number;
  expressionLoadCalls: number;
  expressionSetCalls: number;
  modelUpdateCalls: number;
  updateMotionCalls: number;
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
  evidence?: () => DoudouOfficialLive2DRendererRuntimeLifecycleEvidence;
  loadExpression?: (input: DoudouOfficialLive2DRendererRuntimeExpressionInput) => Promise<unknown> | unknown;
  loadModel: (input: DoudouOfficialLive2DRendererRuntimeLoadModelInput) => Promise<unknown> | unknown;
  setExpression: (input: DoudouOfficialLive2DRendererRuntimeExpressionInput) => Promise<boolean> | boolean;
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
  sampleCanvasSignature?: (canvas: HTMLCanvasElement) => string | null;
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
  let expressionCanvasChangedAfterFrame = false;
  let expressionCanvasComparisonFramesRemaining = 0;
  let expressionCanvasSignatureBeforeSwitch: string | null = null;
  let expressionNeedsFrame = false;
  let expressionCount = 0;
  const expressionEmotionIdsObserved: DefaultDoudouEmotionId[] = [];
  let expressionSwitches = 0;
  let lastFrameAtMs: number | null = null;
  let modelLoaded = false;
  let pendingExpressionSwitches = 0;
  let runtime: DoudouOfficialLive2DRendererRuntime | null = null;
  let runtimeFailureReason: DoudouOfficialLive2DRendererRuntimeFailureReason | null = null;
  let runtimeModuleProbe: DoudouOfficialLive2DRendererRuntimeModuleProbe = initialRuntimeModuleProbe(options);
  let updateCalls = 0;

  return {
    evidence,

    async loadDefaultModel(library) {
      const assets = options.config.rendererAssets;
      if (!assets?.runtimeModuleUrl) {
        runtimeFailureReason = null;
        runtimeModuleProbe = "not_configured";
        return evidence();
      }

      runtimeFailureReason = null;
      runtimeModuleProbe = "load_pending";
      let module: DoudouOfficialLive2DRendererRuntimeModule;
      try {
        await options.loadCoreScript(assets.coreScriptUrl);
        module = await options.importRuntimeModule(assets.runtimeModuleUrl);
        if (typeof module.createDoudouOfficialLive2DRendererRuntime !== "function") {
          runtimeFailureReason = "core_or_module_load_failed";
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
        runtimeFailureReason = "core_or_module_load_failed";
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
        await loadAllExpressions(runtime, library);
      } catch {
        runtime = null;
        runtimeFailureReason = "model_or_expression_load_failed";
        runtimeModuleProbe = "model_failed";
        return evidence();
      }

      expressionCount = library.expressionCount;
      modelLoaded = true;
      runtimeFailureReason = null;
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
        updateExpressionCanvasChangeEvidence();
        if (expressionNeedsFrame && activeEmotionId !== "calm_idle") {
          expressionNeedsFrame = false;
        }
      } catch {
        runtimeFailureReason = "frame_failed";
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
      pendingExpressionSwitches += 1;
      const canvasSignatureBeforeSwitch = sampleCanvasSignature();
      try {
        const switchAccepted = await runtime.setExpression(expression);
        if (!switchAccepted) {
          throw new Error("Official Live2D runtime rejected expression switch.");
        }
      } catch {
        runtimeFailureReason = "expression_switch_rejected";
        runtimeModuleProbe = "model_failed";
        return false;
      } finally {
        pendingExpressionSwitches = Math.max(0, pendingExpressionSwitches - 1);
      }
      activeEmotionId = emotionId;
      expressionSwitches += 1;
      expressionCanvasChangedAfterFrame = false;
      expressionCanvasSignatureBeforeSwitch = canvasSignatureBeforeSwitch;
      expressionCanvasComparisonFramesRemaining = canvasSignatureBeforeSwitch === null ? 0 : 12;
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
      expressionCanvasChangedAfterFrame,
      expressionCount,
      expressionEmotionIdsObserved: expressionEmotionIdsObserved.slice(),
      expressionSwitches,
      frameLoopAdvanced: updateCalls >= 2 && drawCalls >= 2,
      modelLoaded,
      pendingExpressionSwitches,
      runtimeFailureReason,
      runtimeLifecycle: runtimeLifecycleEvidence(),
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

  function sampleCanvasSignature(): string | null {
    try {
      return options.sampleCanvasSignature?.(options.canvas) ?? null;
    } catch {
      return null;
    }
  }

  function updateExpressionCanvasChangeEvidence(): void {
    if (
      expressionCanvasChangedAfterFrame ||
      expressionCanvasSignatureBeforeSwitch === null ||
      expressionCanvasComparisonFramesRemaining <= 0 ||
      activeEmotionId === "calm_idle"
    ) {
      return;
    }
    expressionCanvasComparisonFramesRemaining -= 1;
    const canvasSignatureAfterFrame = sampleCanvasSignature();
    if (canvasSignatureAfterFrame !== null && canvasSignatureAfterFrame !== expressionCanvasSignatureBeforeSwitch) {
      expressionCanvasChangedAfterFrame = true;
      expressionCanvasComparisonFramesRemaining = 0;
    }
  }

  function runtimeLifecycleEvidence(): DoudouOfficialLive2DRendererRuntimeLifecycleEvidence {
    if (!runtime?.evidence) {
      return emptyRuntimeLifecycleEvidence();
    }
    try {
      const lifecycle = runtime.evidence();
      if (
        typeof lifecycle.drawCalls === "number" &&
        typeof lifecycle.expressionLoadCalls === "number" &&
        typeof lifecycle.expressionSetCalls === "number" &&
        typeof lifecycle.modelUpdateCalls === "number" &&
        typeof lifecycle.updateMotionCalls === "number"
      ) {
        return {
          drawCalls: lifecycle.drawCalls,
          expressionLoadCalls: lifecycle.expressionLoadCalls,
          expressionSetCalls: lifecycle.expressionSetCalls,
          modelUpdateCalls: lifecycle.modelUpdateCalls,
          updateMotionCalls: lifecycle.updateMotionCalls
        };
      }
    } catch {
      return emptyRuntimeLifecycleEvidence();
    }
    return emptyRuntimeLifecycleEvidence();
  }
}

async function loadAllExpressions(
  runtime: DoudouOfficialLive2DRendererRuntime,
  library: DoudouLive2DPreviewLibrary
): Promise<void> {
  if (typeof runtime.loadExpression !== "function") {
    throw new Error("Official Live2D runtime does not expose expression loading.");
  }
  for (const request of library.loadRequests) {
    const loadedExpression = await runtime.loadExpression(request);
    if (!loadedExpression) {
      throw new Error("Official Live2D runtime failed to load an expression.");
    }
  }
}

function emptyRuntimeLifecycleEvidence(): DoudouOfficialLive2DRendererRuntimeLifecycleEvidence {
  return {
    drawCalls: 0,
    expressionLoadCalls: 0,
    expressionSetCalls: 0,
    modelUpdateCalls: 0,
    updateMotionCalls: 0
  };
}

function initialRuntimeModuleProbe(
  options: DoudouOfficialLive2DRendererHostOptions
): DoudouOfficialLive2DRendererRuntimeModuleProbe {
  if (!options.config.publicEvidence.runtimeModule?.configured || !options.config.rendererAssets?.runtimeModuleUrl) {
    return "not_configured";
  }
  return "load_pending";
}

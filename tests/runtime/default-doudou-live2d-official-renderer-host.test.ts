import { describe, expect, test } from "vitest";
import { DEFAULT_DOUDOU_EXP3_FIXTURE_DIR } from "../../src/runtime/default-doudou-exp3.js";
import {
  createDoudouOfficialLive2DRendererHost,
  type DoudouOfficialLive2DRendererRuntimeModule
} from "../../src/runtime/default-doudou-live2d-official-renderer-host.js";
import { loadDefaultDoudouLive2DPreviewLibrary } from "../../src/runtime/default-doudou-live2d-preview.js";

describe("default doudou official Live2D renderer host", () => {
  test("loads an external official sample runtime module and drives model, expression, update, and draw", async () => {
    const calls: string[] = [];
    const library = await loadDefaultDoudouLive2DPreviewLibrary(DEFAULT_DOUDOU_EXP3_FIXTURE_DIR);
    const host = createDoudouOfficialLive2DRendererHost({
      canvas: { id: "live2d-canvas" } as HTMLCanvasElement,
      config: {
        publicEvidence: {
          available: true,
          configured: true,
          runtimeModule: {
            configured: true,
            moduleFormat: "external_es_module"
          }
        },
        rendererAssets: {
          coreScriptUrl: "file:///sdk/Core/live2dcubismcore.js",
          model3JsonUrl: "file:///models/default-doudou.model3.json",
          modelRootUrl: "file:///models/",
          runtimeModuleUrl: "file:///runtime/default-doudou-official-runtime.mjs"
        }
      },
      importRuntimeModule: async (moduleUrl) => {
        calls.push(`import:${moduleUrl}`);
        return createFakeOfficialRuntimeModule(calls);
      },
      loadCoreScript: async (coreScriptUrl) => {
        calls.push(`loadCore:${coreScriptUrl}`);
      }
    });

    await host.loadDefaultModel(library);
    await host.switchExpression(library, "delighted");
    expect(host.evidence()).toMatchObject({
      activeEmotionId: "delighted",
      expressionAppliedAfterFrame: false,
      expressionSwitches: 1
    });
    host.renderFrame(1000);
    host.renderFrame(1033);

    expect(host.evidence()).toMatchObject({
      activeEmotionId: "delighted",
      drawCalls: 2,
      expressionAppliedAfterFrame: true,
      expressionCount: 12,
      expressionSwitches: 1,
      frameLoopAdvanced: true,
      modelLoaded: true,
      runtimeModuleProbe: "loaded",
      updateCalls: 2
    });
    expect(calls).toEqual([
      "loadCore:file:///sdk/Core/live2dcubismcore.js",
      "import:file:///runtime/default-doudou-official-runtime.mjs",
      "create:default-doudou:file:///models/",
      "loadModel:default-doudou.model3.json:file:///models/default-doudou.model3.json",
      "loadExpression:calm_idle:expressions/doudou_calm_idle.exp3.json",
      "loadExpression:happy_smile:expressions/doudou_happy_smile.exp3.json",
      "loadExpression:delighted:expressions/doudou_delighted.exp3.json",
      "loadExpression:shy_blush:expressions/doudou_shy_blush.exp3.json",
      "loadExpression:curious_tilt:expressions/doudou_curious_tilt.exp3.json",
      "loadExpression:comfort_soft:expressions/doudou_comfort_soft.exp3.json",
      "loadExpression:sad_soft:expressions/doudou_sad_soft.exp3.json",
      "loadExpression:teary:expressions/doudou_teary.exp3.json",
      "loadExpression:surprised:expressions/doudou_surprised.exp3.json",
      "loadExpression:annoyed_pout:expressions/doudou_annoyed_pout.exp3.json",
      "loadExpression:sleepy:expressions/doudou_sleepy.exp3.json",
      "loadExpression:focused_working:expressions/doudou_focused_working.exp3.json",
      "setExpression:delighted:expressions/doudou_delighted.exp3.json",
      "update:0.000",
      "draw",
      "update:0.033",
      "draw"
    ]);
    expect(JSON.stringify(host.evidence())).not.toContain("/models/");
    expect(JSON.stringify(host.evidence())).not.toContain("rawPrompt");
    expect(JSON.stringify(host.evidence())).not.toContain("sourceImagePath");
  });

  test("reports not_configured without importing when runtime module URL is absent", async () => {
    const library = await loadDefaultDoudouLive2DPreviewLibrary(DEFAULT_DOUDOU_EXP3_FIXTURE_DIR);
    const calls: string[] = [];
    const host = createDoudouOfficialLive2DRendererHost({
      canvas: { id: "live2d-canvas" } as HTMLCanvasElement,
      config: {
        publicEvidence: {
          available: true,
          configured: true,
          runtimeModule: {
            configured: false
          }
        },
        rendererAssets: {
          coreScriptUrl: "file:///sdk/Core/live2dcubismcore.js",
          model3JsonUrl: "file:///models/default-doudou.model3.json",
          modelRootUrl: "file:///models/"
        }
      },
      importRuntimeModule: async () => {
        calls.push("unexpected-import");
        return createFakeOfficialRuntimeModule(calls);
      },
      loadCoreScript: async () => {
        calls.push("unexpected-core-load");
      }
    });

    await host.loadDefaultModel(library);
    host.renderFrame(1000);

    expect(host.evidence()).toMatchObject({
      drawCalls: 0,
      expressionCount: 0,
      modelLoaded: false,
      runtimeModuleProbe: "not_configured",
      updateCalls: 0
    });
    expect(calls).toEqual([]);
  });

  test("reports model_failed when the official runtime does not load every expression", async () => {
    const calls: string[] = [];
    const library = await loadDefaultDoudouLive2DPreviewLibrary(DEFAULT_DOUDOU_EXP3_FIXTURE_DIR);
    const host = createDoudouOfficialLive2DRendererHost({
      canvas: { id: "live2d-canvas" } as HTMLCanvasElement,
      config: {
        publicEvidence: {
          available: true,
          configured: true,
          runtimeModule: {
            configured: true,
            moduleFormat: "external_es_module"
          }
        },
        rendererAssets: {
          coreScriptUrl: "file:///sdk/Core/live2dcubismcore.js",
          model3JsonUrl: "file:///models/default-doudou.model3.json",
          modelRootUrl: "file:///models/",
          runtimeModuleUrl: "file:///runtime/default-doudou-official-runtime.mjs"
        }
      },
      importRuntimeModule: async () => createFakeOfficialRuntimeModule(calls, { expressionLoadResult: null }),
      loadCoreScript: async () => undefined
    });

    await host.loadDefaultModel(library);

    expect(host.evidence()).toMatchObject({
      expressionCount: 0,
      modelLoaded: false,
      runtimeModuleProbe: "model_failed"
    });
    expect(calls).toEqual([
      "create:default-doudou:file:///models/",
      "loadModel:default-doudou.model3.json:file:///models/default-doudou.model3.json",
      "loadExpression:calm_idle:expressions/doudou_calm_idle.exp3.json"
    ]);
    expect(JSON.stringify(host.evidence())).not.toContain("/models/");
  });

  test("records distinct official runtime expression emotions observed through desktop switches", async () => {
    const calls: string[] = [];
    const library = await loadDefaultDoudouLive2DPreviewLibrary(DEFAULT_DOUDOU_EXP3_FIXTURE_DIR);
    const host = createDoudouOfficialLive2DRendererHost({
      canvas: { id: "live2d-canvas" } as HTMLCanvasElement,
      config: {
        publicEvidence: {
          available: true,
          configured: true,
          runtimeModule: {
            configured: true,
            moduleFormat: "external_es_module"
          }
        },
        rendererAssets: {
          coreScriptUrl: "file:///sdk/Core/live2dcubismcore.js",
          model3JsonUrl: "file:///models/default-doudou.model3.json",
          modelRootUrl: "file:///models/",
          runtimeModuleUrl: "file:///runtime/default-doudou-official-runtime.mjs"
        }
      },
      importRuntimeModule: async () => createFakeOfficialRuntimeModule(calls),
      loadCoreScript: async () => undefined
    });

    await host.loadDefaultModel(library);
    await host.switchExpression(library, "delighted");
    host.renderFrame(1000);
    await host.switchExpression(library, "delighted");
    await host.switchExpression(library, "curious_tilt");
    host.renderFrame(1033);

    expect(host.evidence()).toMatchObject({
      activeEmotionId: "curious_tilt",
      expressionAppliedAfterFrame: true,
      expressionEmotionIdsObserved: ["delighted", "curious_tilt"],
      expressionSwitches: 3
    });
    expect(JSON.stringify(host.evidence())).not.toContain("/models/");
  });

  test("reports pending official runtime expression switches until setExpression settles", async () => {
    const calls: string[] = [];
    let finishSetExpression: (() => void) | undefined;
    const setExpressionDelay = new Promise<void>((resolve) => {
      finishSetExpression = resolve;
    });
    const library = await loadDefaultDoudouLive2DPreviewLibrary(DEFAULT_DOUDOU_EXP3_FIXTURE_DIR);
    const host = createDoudouOfficialLive2DRendererHost({
      canvas: { id: "live2d-canvas" } as HTMLCanvasElement,
      config: {
        publicEvidence: {
          available: true,
          configured: true,
          runtimeModule: {
            configured: true,
            moduleFormat: "external_es_module"
          }
        },
        rendererAssets: {
          coreScriptUrl: "file:///sdk/Core/live2dcubismcore.js",
          model3JsonUrl: "file:///models/default-doudou.model3.json",
          modelRootUrl: "file:///models/",
          runtimeModuleUrl: "file:///runtime/default-doudou-official-runtime.mjs"
        }
      },
      importRuntimeModule: async () => createFakeOfficialRuntimeModule(calls, { setExpressionDelay }),
      loadCoreScript: async () => undefined
    });

    await host.loadDefaultModel(library);
    const switchPromise = host.switchExpression(library, "delighted");
    await Promise.resolve();

    expect(host.evidence()).toMatchObject({
      activeEmotionId: "calm_idle",
      expressionSwitches: 0,
      pendingExpressionSwitches: 1
    });

    finishSetExpression?.();
    await switchPromise;

    expect(host.evidence()).toMatchObject({
      activeEmotionId: "delighted",
      expressionSwitches: 1,
      pendingExpressionSwitches: 0
    });
  });

  test("rejects an official expression switch when runtime does not accept setExpression", async () => {
    const calls: string[] = [];
    const library = await loadDefaultDoudouLive2DPreviewLibrary(DEFAULT_DOUDOU_EXP3_FIXTURE_DIR);
    const host = createDoudouOfficialLive2DRendererHost({
      canvas: { id: "live2d-canvas" } as HTMLCanvasElement,
      config: {
        publicEvidence: {
          available: true,
          configured: true,
          runtimeModule: {
            configured: true,
            moduleFormat: "external_es_module"
          }
        },
        rendererAssets: {
          coreScriptUrl: "file:///sdk/Core/live2dcubismcore.js",
          model3JsonUrl: "file:///models/default-doudou.model3.json",
          modelRootUrl: "file:///models/",
          runtimeModuleUrl: "file:///runtime/default-doudou-official-runtime.mjs"
        }
      },
      importRuntimeModule: async () => createFakeOfficialRuntimeModule(calls, { setExpressionResult: false }),
      loadCoreScript: async () => undefined
    });

    await host.loadDefaultModel(library);
    const switched = await host.switchExpression(library, "delighted");

    expect(switched).toBe(false);
    expect(host.evidence()).toMatchObject({
      activeEmotionId: "calm_idle",
      expressionSwitches: 0,
      pendingExpressionSwitches: 0,
      runtimeModuleProbe: "model_failed"
    });
    expect(calls).toContain("setExpression:delighted:expressions/doudou_delighted.exp3.json");
    expect(JSON.stringify(host.evidence())).not.toContain("/models/");
  });

  test("detects official canvas signature changes after a switched expression draws a frame", async () => {
    const calls: string[] = [];
    let canvasSignature = "idle-frame";
    const library = await loadDefaultDoudouLive2DPreviewLibrary(DEFAULT_DOUDOU_EXP3_FIXTURE_DIR);
    const host = createDoudouOfficialLive2DRendererHost({
      canvas: { id: "live2d-canvas" } as HTMLCanvasElement,
      config: {
        publicEvidence: {
          available: true,
          configured: true,
          runtimeModule: {
            configured: true,
            moduleFormat: "external_es_module"
          }
        },
        rendererAssets: {
          coreScriptUrl: "file:///sdk/Core/live2dcubismcore.js",
          model3JsonUrl: "file:///models/default-doudou.model3.json",
          modelRootUrl: "file:///models/",
          runtimeModuleUrl: "file:///runtime/default-doudou-official-runtime.mjs"
        }
      },
      importRuntimeModule: async () => createFakeOfficialRuntimeModule(calls, {
        onDraw: () => {
          canvasSignature = "delighted-frame";
        }
      }),
      loadCoreScript: async () => undefined,
      sampleCanvasSignature: () => canvasSignature
    });

    await host.loadDefaultModel(library);
    await host.switchExpression(library, "delighted");
    expect(host.evidence()).toMatchObject({
      expressionAppliedAfterFrame: false,
      expressionCanvasChangedAfterFrame: false
    });

    host.renderFrame(1000);

    expect(host.evidence()).toMatchObject({
      expressionAppliedAfterFrame: true,
      expressionCanvasChangedAfterFrame: true
    });
  });
});

interface FakeOfficialRuntimeModuleOptions {
  expressionLoadResult?: unknown;
  onDraw?: () => void;
  setExpressionDelay?: Promise<unknown>;
  setExpressionResult?: boolean;
}

function createFakeOfficialRuntimeModule(
  calls: string[],
  fakeOptions: FakeOfficialRuntimeModuleOptions = {}
): DoudouOfficialLive2DRendererRuntimeModule {
  return {
    async createDoudouOfficialLive2DRendererRuntime(runtimeOptions) {
      calls.push(`create:${runtimeOptions.modelId}:${runtimeOptions.assets.modelRootUrl}`);
      return {
        async loadModel(input) {
          calls.push(`loadModel:${input.model3Json}:${input.model3JsonUrl}`);
        },
        async loadExpression(input) {
          calls.push(`loadExpression:${input.emotionId}:${input.expressionFile}`);
          if ("expressionLoadResult" in fakeOptions) {
            return fakeOptions.expressionLoadResult;
          }
          return { expressionName: input.expressionName };
        },
        async setExpression(input) {
          calls.push(`setExpression:${input.emotionId}:${input.expressionFile}`);
          await fakeOptions.setExpressionDelay;
          return fakeOptions.setExpressionResult ?? true;
        },
        update(deltaTimeSeconds) {
          calls.push(`update:${deltaTimeSeconds.toFixed(3)}`);
        },
        draw() {
          calls.push("draw");
          fakeOptions.onDraw?.();
        }
      };
    }
  };
}

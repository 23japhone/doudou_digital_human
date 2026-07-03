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
});

function createFakeOfficialRuntimeModule(calls: string[]): DoudouOfficialLive2DRendererRuntimeModule {
  return {
    async createDoudouOfficialLive2DRendererRuntime(options) {
      calls.push(`create:${options.modelId}:${options.assets.modelRootUrl}`);
      return {
        async loadModel(input) {
          calls.push(`loadModel:${input.model3Json}:${input.model3JsonUrl}`);
        },
        async loadExpression(input) {
          calls.push(`loadExpression:${input.emotionId}:${input.expressionFile}`);
        },
        async setExpression(input) {
          calls.push(`setExpression:${input.emotionId}:${input.expressionFile}`);
        },
        update(deltaTimeSeconds) {
          calls.push(`update:${deltaTimeSeconds.toFixed(3)}`);
        },
        draw() {
          calls.push("draw");
        }
      };
    }
  };
}

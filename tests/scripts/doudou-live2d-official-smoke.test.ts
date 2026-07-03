import { describe, expect, test } from "vitest";
import { runDoudouOfficialLive2DSmoke } from "../../src/scripts/doudou-live2d-official-smoke.js";

describe("runDoudouOfficialLive2DSmoke", () => {
  test("requires explicit local SDK and model paths before running the real official smoke", async () => {
    const result = await runDoudouOfficialLive2DSmoke({
      buildRuntimeModule: async () => {
        throw new Error("build should not run");
      },
      env: {},
      runRuntimeSmoke: async () => {
        throw new Error("runtime smoke should not run");
      }
    });

    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.output)).toEqual({
      ok: false,
      code: "OFFICIAL_LIVE2D_SMOKE_NOT_CONFIGURED",
      missing: [
        "DOUDOU_CUBISM_WEB_SDK_DIR",
        "DOUDOU_DEFAULT_DOUDOU_LIVE2D_MODEL_DIR"
      ]
    });
  });

  test("builds a sanitized runtime module and runs the renderer smoke with official SDK env", async () => {
    const calls: Array<Record<string, unknown>> = [];
    const sdkDir = "fixture-cubism-sdk";
    const modelDir = "fixture-default-doudou-model";
    const outputFile = "fixture-runtime/default-doudou-official-runtime.mjs";

    const result = await runDoudouOfficialLive2DSmoke({
      argv: [
        "node",
        "doudou-live2d-official-smoke",
        "--sdk-dir",
        sdkDir,
        "--model-dir",
        modelDir,
        "--out",
        outputFile,
        "--mode",
        "framework"
      ],
      buildRuntimeModule: async (input) => {
        calls.push({ build: input });
        return {
          ok: true,
          moduleFormat: "external_es_module",
          outputFileName: "default-doudou-official-runtime.mjs",
          sdk: {
            frameworkSource: "Framework/src"
          }
        };
      },
      cwd: "repo-root",
      env: {},
      resolveOfficialRuntime: async (input) => {
        calls.push({ preflight: input });
        return {
          available: true,
          configured: true,
          publicEvidence: {
            available: true,
            configured: true
          },
          rendererAssets: {
            coreScriptUrl: "file:///sdk/Core/live2dcubismcore.js",
            model3JsonUrl: "file:///models/default-doudou.model3.json",
            modelRootUrl: "file:///models/"
          }
        };
      },
      runRuntimeSmoke: async (input) => {
        calls.push({
          smokeEnv: {
            DOUDOU_CUBISM_WEB_RUNTIME_MODULE: input.env.DOUDOU_CUBISM_WEB_RUNTIME_MODULE,
            DOUDOU_CUBISM_WEB_SDK_DIR: input.env.DOUDOU_CUBISM_WEB_SDK_DIR,
            DOUDOU_DEFAULT_DOUDOU_LIVE2D_MODEL_DIR: input.env.DOUDOU_DEFAULT_DOUDOU_LIVE2D_MODEL_DIR,
            DOUDOU_LIVE2D_RENDERER_SPIKE: input.env.DOUDOU_LIVE2D_RENDERER_SPIKE,
            NODE_OPTIONS: input.env.NODE_OPTIONS
          }
        });
        return {
          exitCode: 0,
          output: [
            `runtime smoke fixture bundle: ${JSON.stringify(createRuntimeSmokeResult("delighted", 13, 21))}`,
            `runtime smoke generated bundle: ${JSON.stringify(createRuntimeSmokeResult("focused_working", 17, 29))}`
          ].join("\n")
        };
      }
    });

    expect(result.exitCode).toBe(0);
    expect(calls[0]).toEqual({
      preflight: {
        modelDir,
        sdkDir
      }
    });
    expect(calls[1]).toEqual({
      build: {
        mode: "framework",
        outputFile,
        sdkDir
      }
    });
    expect(calls[2]).toEqual({
      smokeEnv: {
        DOUDOU_CUBISM_WEB_RUNTIME_MODULE: outputFile,
        DOUDOU_CUBISM_WEB_SDK_DIR: sdkDir,
        DOUDOU_DEFAULT_DOUDOU_LIVE2D_MODEL_DIR: modelDir,
        DOUDOU_LIVE2D_RENDERER_SPIKE: "1",
        NODE_OPTIONS: ""
      }
    });
    expect(JSON.parse(result.output)).toEqual({
      ok: true,
      mode: "framework",
      runtimeModule: {
        moduleFormat: "external_es_module",
        outputFileName: "default-doudou-official-runtime.mjs",
        sdk: {
          frameworkSource: "Framework/src"
        }
      },
      runtimeSmoke: {
        exitCode: 0,
        officialRenderer: {
          fixtureBundle: {
            activeEmotionId: "delighted",
            canvasLayerVisible: true,
            canvasNonTransparentPixel: true,
            drawCalls: 21,
            expressionAppliedAfterFrame: true,
            expressionCanvasChangedAfterFrame: true,
            expressionCount: 12,
            expressionEmotionIdsObserved: ["delighted", "focused_working"],
            expressionSwitches: 13,
            frameLoopAdvanced: true,
            modelLoaded: true,
            pendingExpressionSwitches: 0,
            rendererAssetProbe: "model3_fetched",
            runtimeLifecycle: {
              drawCalls: 21,
              expressionLoadCalls: 12,
              expressionSetCalls: 13,
              modelUpdateCalls: 21,
              updateMotionCalls: 21
            },
            runtimeModuleProbe: "loaded",
            updateCalls: 21
          },
          generatedBundle: {
            activeEmotionId: "focused_working",
            canvasLayerVisible: true,
            canvasNonTransparentPixel: true,
            drawCalls: 29,
            expressionAppliedAfterFrame: true,
            expressionCanvasChangedAfterFrame: true,
            expressionCount: 12,
            expressionEmotionIdsObserved: ["focused_working", "delighted"],
            expressionSwitches: 17,
            frameLoopAdvanced: true,
            modelLoaded: true,
            pendingExpressionSwitches: 0,
            rendererAssetProbe: "model3_fetched",
            runtimeLifecycle: {
              drawCalls: 29,
              expressionLoadCalls: 12,
              expressionSetCalls: 17,
              modelUpdateCalls: 29,
              updateMotionCalls: 29
            },
            runtimeModuleProbe: "loaded",
            updateCalls: 29
          }
        }
      }
    });
    expect(result.output).not.toContain(sdkDir);
    expect(result.output).not.toContain(modelDir);
    expect(result.output).not.toContain(outputFile);
  });

  test("preflights the local SDK and model layout before building the runtime module", async () => {
    const sdkDir = "fixture-cubism-sdk";
    const modelDir = "fixture-default-doudou-model";

    const result = await runDoudouOfficialLive2DSmoke({
      argv: [
        "node",
        "doudou-live2d-official-smoke",
        "--sdk-dir",
        sdkDir,
        "--model-dir",
        modelDir
      ],
      buildRuntimeModule: async () => {
        throw new Error("build should not run when preflight fails");
      },
      env: {},
      resolveOfficialRuntime: async (input) => {
        expect(input).toEqual({
          modelDir,
          sdkDir
        });
        return {
          available: false,
          configured: true,
          publicEvidence: {
            available: false,
            configured: true,
            reason: "model_asset_missing"
          },
          reason: "model_asset_missing"
        };
      },
      runRuntimeSmoke: async () => {
        throw new Error("runtime smoke should not run when preflight fails");
      }
    });

    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.output)).toEqual({
      ok: false,
      code: "OFFICIAL_LIVE2D_PREFLIGHT_FAILED",
      reason: "model_asset_missing"
    });
    expect(result.output).not.toContain(sdkDir);
    expect(result.output).not.toContain(modelDir);
  });

  test("fails when runtime smoke exits zero without complete official renderer proof", async () => {
    const sdkDir = "fixture-cubism-sdk";
    const modelDir = "fixture-default-doudou-model";

    const result = await runDoudouOfficialLive2DSmoke({
      argv: [
        "node",
        "doudou-live2d-official-smoke",
        "--sdk-dir",
        sdkDir,
        "--model-dir",
        modelDir
      ],
      buildRuntimeModule: async () => ({
        ok: true,
        moduleFormat: "external_es_module",
        outputFileName: "default-doudou-official-runtime.mjs",
        sdk: {
          frameworkSource: "Framework/src",
          sampleLAppModel: "Samples/TypeScript/Demo/src/lappmodel.ts"
        }
      }),
      env: {},
      resolveOfficialRuntime: async () => ({
        available: true,
        configured: true,
        publicEvidence: {
          available: true,
          configured: true
        },
        rendererAssets: {
          coreScriptUrl: "file:///sdk/Core/live2dcubismcore.js",
          model3JsonUrl: "file:///models/default-doudou.model3.json",
          modelRootUrl: "file:///models/"
        }
      }),
      runRuntimeSmoke: async () => ({
        exitCode: 0,
        output: `runtime smoke fixture bundle: ${JSON.stringify(createRuntimeSmokeResult("calm_idle", 1, 1))}\n`
      })
    });

    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.output)).toEqual({
      ok: false,
      code: "OFFICIAL_LIVE2D_EVIDENCE_INCOMPLETE",
      mode: "sample",
      runtimeModule: {
        moduleFormat: "external_es_module",
        outputFileName: "default-doudou-official-runtime.mjs",
        sdk: {
          frameworkSource: "Framework/src",
          sampleLAppModel: "Samples/TypeScript/Demo/src/lappmodel.ts"
        }
      },
      runtimeSmoke: {
        exitCode: 0,
        failedChecks: [
          "fixtureBundle.expressionAppliedAfterFrame",
          "fixtureBundle.expressionCanvasChangedAfterFrame",
          "fixtureBundle.expressionEmotionIdsObserved",
          "fixtureBundle.runtimeLifecycle.expressionSetCalls",
          "fixtureBundle.runtimeLifecycle.updateMotionCalls",
          "fixtureBundle.runtimeLifecycle.modelUpdateCalls",
          "fixtureBundle.runtimeLifecycle.drawCalls",
          "fixtureBundle.drawCalls",
          "fixtureBundle.updateCalls",
          "fixtureBundle.activeEmotionId",
          "generatedBundle.missing"
        ],
        officialRenderer: {
          fixtureBundle: {
            activeEmotionId: "calm_idle",
            canvasLayerVisible: true,
            canvasNonTransparentPixel: true,
            drawCalls: 1,
            expressionAppliedAfterFrame: false,
            expressionCanvasChangedAfterFrame: false,
            expressionCount: 12,
            expressionEmotionIdsObserved: ["delighted"],
            expressionSwitches: 1,
            frameLoopAdvanced: true,
            modelLoaded: true,
            pendingExpressionSwitches: 0,
            rendererAssetProbe: "model3_fetched",
            runtimeLifecycle: {
              drawCalls: 1,
              expressionLoadCalls: 12,
              expressionSetCalls: 1,
              modelUpdateCalls: 1,
              updateMotionCalls: 1
            },
            runtimeModuleProbe: "loaded",
            updateCalls: 1
          }
        }
      }
    });
    expect(result.output).not.toContain(sdkDir);
    expect(result.output).not.toContain(modelDir);
  });

  test("returns sanitized JSON when the runtime smoke process errors", async () => {
    const sdkDir = "fixture-cubism-sdk";
    const modelDir = "fixture-default-doudou-model";
    const outputFile = "fixture-runtime/default-doudou-official-runtime.mjs";

    const result = await runDoudouOfficialLive2DSmoke({
      argv: [
        "node",
        "doudou-live2d-official-smoke",
        "--sdk-dir",
        sdkDir,
        "--model-dir",
        modelDir,
        "--out",
        outputFile
      ],
      buildRuntimeModule: async () => ({
        ok: true,
        moduleFormat: "external_es_module",
        outputFileName: "default-doudou-official-runtime.mjs",
        sdk: {
          frameworkSource: "Framework/src",
          sampleLAppModel: "Samples/TypeScript/Demo/src/lappmodel.ts"
        }
      }),
      env: {},
      resolveOfficialRuntime: async () => ({
        available: true,
        configured: true,
        publicEvidence: {
          available: true,
          configured: true
        },
        rendererAssets: {
          coreScriptUrl: "file:///sdk/Core/live2dcubismcore.js",
          model3JsonUrl: "file:///models/default-doudou.model3.json",
          modelRootUrl: "file:///models/"
        }
      }),
      runRuntimeSmoke: async () => {
        throw new Error(`timed out while reading ${modelDir} and ${outputFile}`);
      }
    });

    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.output)).toEqual({
      ok: false,
      code: "OFFICIAL_LIVE2D_RUNTIME_SMOKE_FAILED",
      mode: "sample",
      runtimeModule: {
        moduleFormat: "external_es_module",
        outputFileName: "default-doudou-official-runtime.mjs",
        sdk: {
          frameworkSource: "Framework/src",
          sampleLAppModel: "Samples/TypeScript/Demo/src/lappmodel.ts"
        }
      },
      runtimeSmoke: {
        exitCode: null,
        reason: "runtime_smoke_error"
      }
    });
    expect(result.output).not.toContain(sdkDir);
    expect(result.output).not.toContain(modelDir);
    expect(result.output).not.toContain(outputFile);
  });

  test("keeps sanitized official renderer evidence when runtime smoke exits nonzero", async () => {
    const sdkDir = "fixture-cubism-sdk";
    const modelDir = "fixture-default-doudou-model";

    const result = await runDoudouOfficialLive2DSmoke({
      argv: [
        "node",
        "doudou-live2d-official-smoke",
        "--sdk-dir",
        sdkDir,
        "--model-dir",
        modelDir
      ],
      buildRuntimeModule: async () => ({
        ok: true,
        moduleFormat: "external_es_module",
        outputFileName: "default-doudou-official-runtime.mjs",
        sdk: {
          frameworkSource: "Framework/src",
          sampleLAppModel: "Samples/TypeScript/Demo/src/lappmodel.ts"
        }
      }),
      env: {},
      resolveOfficialRuntime: async () => ({
        available: true,
        configured: true,
        publicEvidence: {
          available: true,
          configured: true
        },
        rendererAssets: {
          coreScriptUrl: "file:///sdk/Core/live2dcubismcore.js",
          model3JsonUrl: "file:///models/default-doudou.model3.json",
          modelRootUrl: "file:///models/"
        }
      }),
      runRuntimeSmoke: async () => ({
        exitCode: 1,
        output: [
          "runtime smoke negative: missing manifest failed with MISSING_MANIFEST",
          `runtime smoke fixture bundle: ${JSON.stringify(createRuntimeSmokeResult("delighted", 13, 21))}`
        ].join("\n")
      })
    });

    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.output)).toEqual({
      ok: false,
      code: "OFFICIAL_LIVE2D_RUNTIME_SMOKE_FAILED",
      mode: "sample",
      runtimeModule: {
        moduleFormat: "external_es_module",
        outputFileName: "default-doudou-official-runtime.mjs",
        sdk: {
          frameworkSource: "Framework/src",
          sampleLAppModel: "Samples/TypeScript/Demo/src/lappmodel.ts"
        }
      },
      runtimeSmoke: {
        exitCode: 1,
        officialRenderer: {
          fixtureBundle: {
            activeEmotionId: "delighted",
            canvasLayerVisible: true,
            canvasNonTransparentPixel: true,
            drawCalls: 21,
            expressionAppliedAfterFrame: true,
            expressionCanvasChangedAfterFrame: true,
            expressionCount: 12,
            expressionEmotionIdsObserved: ["delighted", "focused_working"],
            expressionSwitches: 13,
            frameLoopAdvanced: true,
            modelLoaded: true,
            pendingExpressionSwitches: 0,
            rendererAssetProbe: "model3_fetched",
            runtimeLifecycle: {
              drawCalls: 21,
              expressionLoadCalls: 12,
              expressionSetCalls: 13,
              modelUpdateCalls: 21,
              updateMotionCalls: 21
            },
            runtimeModuleProbe: "loaded",
            updateCalls: 21
          }
        }
      }
    });
    expect(result.output).not.toContain(sdkDir);
    expect(result.output).not.toContain(modelDir);
  });
});

function createRuntimeSmokeResult(activeEmotionId: string, expressionSwitches: number, frameCalls: number) {
  return {
    live2DRendererSpike: {
      officialRuntime: {
        canvasLayerVisible: true,
        canvasNonTransparentPixel: true,
        rendererAssetProbe: "model3_fetched",
        runtimeModule: {
          activeEmotionId,
          drawCalls: frameCalls,
          expressionAppliedAfterFrame: activeEmotionId !== "calm_idle" && expressionSwitches > 0 && frameCalls >= 2,
          expressionCanvasChangedAfterFrame: activeEmotionId !== "calm_idle" && expressionSwitches > 0 && frameCalls >= 2,
          expressionCount: 12,
          expressionEmotionIdsObserved: activeEmotionId === "calm_idle"
            ? ["delighted"]
            : [activeEmotionId, activeEmotionId === "delighted" ? "focused_working" : "delighted"],
          expressionSwitches,
          frameLoopAdvanced: true,
          modelLoaded: true,
          pendingExpressionSwitches: 0,
          runtimeLifecycle: {
            drawCalls: frameCalls,
            expressionLoadCalls: 12,
            expressionSetCalls: expressionSwitches,
            modelUpdateCalls: frameCalls,
            updateMotionCalls: frameCalls
          },
          runtimeModuleProbe: "loaded",
          updateCalls: frameCalls
        }
      }
    }
  };
}

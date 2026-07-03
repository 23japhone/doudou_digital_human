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
          output: "runtime smoke fixture bundle: {\"live2DRendererSpike\":{\"officialRuntime\":{\"runtimeModule\":{\"runtimeModuleProbe\":\"loaded\"}}}}\n"
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
        exitCode: 0
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
});

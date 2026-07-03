import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, test, vi } from "vitest";
import {
  buildDoudouOfficialLive2DRendererRuntimeModule,
  runBuildDoudouOfficialLive2DRendererRuntimeModuleCli
} from "../../src/scripts/build-doudou-live2d-official-runtime-module.js";
import { DEFAULT_DOUDOU_EXP3_FIXTURE_DIR } from "../../src/runtime/default-doudou-exp3.js";
import { createDoudouOfficialLive2DRendererHost } from "../../src/runtime/default-doudou-live2d-official-renderer-host.js";
import { loadDefaultDoudouLive2DPreviewLibrary } from "../../src/runtime/default-doudou-live2d-preview.js";

describe("default doudou official Live2D runtime module builder", () => {
  test("bundles the official sample LAppModel runtime mode that the renderer host can drive", async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "doudou-official-sample-runtime-builder-"));
    try {
      const sdkDir = path.join(tempRoot, "CubismSdkForWeb");
      const outputFile = path.join(tempRoot, "local_live2d_runtime", "default-doudou-sample-runtime.mjs");
      await writeSyntheticCubismSampleSdk(sdkDir);

      const buildResult = await buildDoudouOfficialLive2DRendererRuntimeModule({
        mode: "sample",
        outputFile,
        sdkDir
      });

      expect(buildResult).toEqual({
        ok: true,
        moduleFormat: "external_es_module",
        outputFileName: "default-doudou-sample-runtime.mjs",
        sdk: {
          frameworkSource: "Framework/src",
          sampleLAppModel: "Samples/TypeScript/Demo/src/lappmodel.ts"
        }
      });
      const outputSource = await readFile(outputFile, "utf8");
      expect(outputSource).not.toContain(tempRoot);
      expect(outputSource).toContain("preserveDrawingBuffer: true");

      const calls: string[] = [];
      (globalThis as { __doudouOfficialRuntimeFixtureCalls?: string[] }).__doudouOfficialRuntimeFixtureCalls = calls;
      const library = await loadDefaultDoudouLive2DPreviewLibrary(DEFAULT_DOUDOU_EXP3_FIXTURE_DIR);
      const runtimeModuleUrl = `${pathToFileURL(outputFile).href}?case=sample-${Date.now()}`;
      const host = createDoudouOfficialLive2DRendererHost({
        canvas: createFakeCanvas(),
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
            runtimeModuleUrl
          }
        },
        importRuntimeModule: async (moduleUrl) => await import(moduleUrl),
        loadCoreScript: async (coreScriptUrl) => {
          calls.push(`loadCore:${coreScriptUrl}`);
        }
      });

      await host.loadDefaultModel(library);
      await host.switchExpression(library, "delighted");
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
        runtimeLifecycle: {
          drawCalls: 2,
          expressionLoadCalls: 12,
          expressionSetCalls: 1,
          modelUpdateCalls: 2,
          updateMotionCalls: 2
        },
        runtimeModuleProbe: "loaded",
        updateCalls: 2
      });
      expect(calls).toContain("LAppModel.setSubdelegate:true");
      expect(calls.filter((call) => call === "LAppPal.updateTime").length).toBeGreaterThanOrEqual(3);
      expect(calls).toContain("LAppModel.loadAssets:file:///models/:default-doudou.model3.json");
      expect(calls.filter((call) => call.startsWith("LAppModel.loadExpression:")).length).toBe(12);
      expect(calls.filter((call) => call.startsWith("LAppModel.expressionMap.setValue:")).length).toBe(12);
      expect(calls).toContain("LAppModel.expressionMap.setValue:兜兜开心发光:兜兜开心发光");
      expect(calls).toContain("LAppModel.setExpression:兜兜开心发光");
      expect(calls).toContain("LAppModel.expressionUpdateMotion:0.000");
      expect(calls).toContain("LAppModel.expressionUpdateMotion:0.033");
      expect(calls.filter((call) => call === "LAppModel.update").length).toBe(2);
      expect(calls.filter((call) => call === "LAppModel.draw:true").length).toBe(2);
      const firstFrameTimeIndex = calls.indexOf("LAppPal.updateTime", calls.indexOf("LAppModel.setExpression:兜兜开心发光"));
      const firstFrameUpdateIndex = calls.indexOf("LAppModel.update");
      expect(firstFrameTimeIndex).toBeGreaterThanOrEqual(0);
      expect(firstFrameTimeIndex).toBeLessThan(firstFrameUpdateIndex);
      expect(JSON.stringify(host.evidence())).not.toContain(tempRoot);
    } finally {
      delete (globalThis as { __doudouOfficialRuntimeFixtureCalls?: string[] }).__doudouOfficialRuntimeFixtureCalls;
      await rm(tempRoot, { force: true, recursive: true });
    }
  });

  test("rejects sample mode expression switches when LAppModel refuses setExpression", async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "doudou-official-sample-expression-rejected-"));
    try {
      const sdkDir = path.join(tempRoot, "CubismSdkForWeb");
      const outputFile = path.join(tempRoot, "local_live2d_runtime", "default-doudou-sample-runtime.mjs");
      await writeSyntheticCubismSampleSdk(sdkDir, { setExpressionResult: "rejected" });

      const buildResult = await buildDoudouOfficialLive2DRendererRuntimeModule({
        mode: "sample",
        outputFile,
        sdkDir
      });

      expect(buildResult).toMatchObject({ ok: true });
      const calls: string[] = [];
      (globalThis as { __doudouOfficialRuntimeFixtureCalls?: string[] }).__doudouOfficialRuntimeFixtureCalls = calls;

      const library = await loadDefaultDoudouLive2DPreviewLibrary(DEFAULT_DOUDOU_EXP3_FIXTURE_DIR);
      const runtimeModuleUrl = `${pathToFileURL(outputFile).href}?case=sample-expression-rejected-${Date.now()}`;
      const host = createDoudouOfficialLive2DRendererHost({
        canvas: createFakeCanvas(),
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
            runtimeModuleUrl
          }
        },
        importRuntimeModule: async (moduleUrl) => await import(moduleUrl),
        loadCoreScript: async (coreScriptUrl) => {
          calls.push(`loadCore:${coreScriptUrl}`);
        }
      });

      await host.loadDefaultModel(library);
      const switched = await host.switchExpression(library, "delighted");

      expect(switched).toBe(false);
      expect(host.evidence()).toMatchObject({
        activeEmotionId: "calm_idle",
        expressionSwitches: 0,
        pendingExpressionSwitches: 0,
        runtimeFailureReason: "expression_switch_rejected",
        runtimeLifecycle: {
          expressionLoadCalls: 12,
          expressionSetCalls: 0
        },
        runtimeModuleProbe: "model_failed"
      });
      expect(calls).toContain("LAppModel.setExpression:兜兜开心发光");
      expect(calls).toContain("LAppModel.setExpressionResult:false");
    } finally {
      delete (globalThis as { __doudouOfficialRuntimeFixtureCalls?: string[] }).__doudouOfficialRuntimeFixtureCalls;
      await rm(tempRoot, { force: true, recursive: true });
    }
  });

  test("bundles a local Cubism Framework wrapper that the renderer host can drive", async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "doudou-official-runtime-builder-"));
    const originalFetch = globalThis.fetch;
    try {
      const sdkDir = path.join(tempRoot, "CubismSdkForWeb");
      const outputFile = path.join(tempRoot, "local_live2d_runtime", "default-doudou-official-runtime.mjs");
      await writeSyntheticCubismFrameworkSdk(sdkDir);

      const buildResult = await buildDoudouOfficialLive2DRendererRuntimeModule({
        mode: "framework",
        outputFile,
        sdkDir
      });

      expect(buildResult).toEqual({
        ok: true,
        moduleFormat: "external_es_module",
        outputFileName: "default-doudou-official-runtime.mjs",
        sdk: {
          frameworkSource: "Framework/src"
        }
      });
      const outputSource = await readFile(outputFile, "utf8");
      expect(outputSource).not.toContain(tempRoot);
      expect(outputSource).toContain("preserveDrawingBuffer: true");

      const calls: string[] = [];
      globalThis.fetch = vi.fn(async (url: string | URL | Request) => {
        calls.push(`fetch:${String(url).replace(tempRoot, "<temp>")}`);
        return new Response(new TextEncoder().encode("fixture").buffer);
      }) as typeof fetch;
      (globalThis as { __doudouOfficialRuntimeFixtureCalls?: string[] }).__doudouOfficialRuntimeFixtureCalls = calls;

      const library = await loadDefaultDoudouLive2DPreviewLibrary(DEFAULT_DOUDOU_EXP3_FIXTURE_DIR);
      const runtimeModuleUrl = `${pathToFileURL(outputFile).href}?case=${Date.now()}`;
      const host = createDoudouOfficialLive2DRendererHost({
        canvas: createFakeCanvas(),
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
            runtimeModuleUrl
          }
        },
        importRuntimeModule: async (moduleUrl) => await import(moduleUrl),
        loadCoreScript: async (coreScriptUrl) => {
          calls.push(`loadCore:${coreScriptUrl}`);
        }
      });

      await host.loadDefaultModel(library);
      await host.switchExpression(library, "delighted");
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
        runtimeLifecycle: {
          drawCalls: 2,
          expressionLoadCalls: 12,
          expressionSetCalls: 1,
          modelUpdateCalls: 2,
          updateMotionCalls: 2
        },
        runtimeModuleProbe: "loaded",
        updateCalls: 2
      });
      expect(calls).toContain("CubismFramework.startUp");
      expect(calls).toContain("CubismFramework.initialize");
      expect(calls).toContain("CubismMoc.create:true");
      expect(calls).toContain("CubismRenderer_WebGL.initialize");
      expect(calls).toContain("CubismRenderer_WebGL.startUp:true");
      expect(calls).toContain("CubismRenderer_WebGL.loadShaders");
      expect(calls.filter((call) => call === "CubismExpressionMotion.create").length).toBe(12);
      expect(calls).toContain("CubismMotionManager.startMotionPriority:false:3");
      expect(calls).toContain("CubismMotionManager.updateMotion:0.000");
      expect(calls).toContain("CubismMotionManager.updateMotion:0.033");
      expect(calls.filter((call) => call === "CubismModel.update").length).toBe(2);
      expect(calls.filter((call) => call === "CubismRenderer_WebGL.doDrawModel").length).toBe(2);
      expect(JSON.stringify(host.evidence())).not.toContain(tempRoot);
    } finally {
      globalThis.fetch = originalFetch;
      delete (globalThis as { __doudouOfficialRuntimeFixtureCalls?: string[] }).__doudouOfficialRuntimeFixtureCalls;
      await rm(tempRoot, { force: true, recursive: true });
    }
  });

  test("rejects framework mode when a model asset fetch returns a non-ok response", async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "doudou-official-runtime-fetch-failure-"));
    const originalFetch = globalThis.fetch;
    try {
      const sdkDir = path.join(tempRoot, "CubismSdkForWeb");
      const outputFile = path.join(tempRoot, "local_live2d_runtime", "default-doudou-official-runtime.mjs");
      await writeSyntheticCubismFrameworkSdk(sdkDir);

      const buildResult = await buildDoudouOfficialLive2DRendererRuntimeModule({
        mode: "framework",
        outputFile,
        sdkDir
      });

      expect(buildResult).toMatchObject({ ok: true });
      const calls: string[] = [];
      globalThis.fetch = vi.fn(async (url: string | URL | Request) => {
        calls.push(`fetch:${String(url)}`);
        return {
          ok: false,
          status: 0,
          arrayBuffer: async () => new TextEncoder().encode("fixture").buffer
        } as Response;
      }) as typeof fetch;
      (globalThis as { __doudouOfficialRuntimeFixtureCalls?: string[] }).__doudouOfficialRuntimeFixtureCalls = calls;

      const library = await loadDefaultDoudouLive2DPreviewLibrary(DEFAULT_DOUDOU_EXP3_FIXTURE_DIR);
      const runtimeModuleUrl = `${pathToFileURL(outputFile).href}?case=framework-fetch-failure-${Date.now()}`;
      const host = createDoudouOfficialLive2DRendererHost({
        canvas: createFakeCanvas(),
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
            runtimeModuleUrl
          }
        },
        importRuntimeModule: async (moduleUrl) => await import(moduleUrl),
        loadCoreScript: async (coreScriptUrl) => {
          calls.push(`loadCore:${coreScriptUrl}`);
        }
      });

      await host.loadDefaultModel(library);

      expect(host.evidence()).toMatchObject({
        expressionCount: 0,
        modelLoaded: false,
        runtimeFailureReason: "model_or_expression_load_failed",
        runtimeLifecycle: {
          expressionLoadCalls: 0,
          expressionSetCalls: 0
        },
        runtimeModuleProbe: "model_failed"
      });
      expect(calls).toContain("fetch:file:///models/default-doudou.model3.json");
      expect(calls.some((call) => call.startsWith("CubismModelSettingJson:"))).toBe(false);
      expect(calls.some((call) => call.startsWith("CubismMoc.create:"))).toBe(false);
    } finally {
      globalThis.fetch = originalFetch;
      delete (globalThis as { __doudouOfficialRuntimeFixtureCalls?: string[] }).__doudouOfficialRuntimeFixtureCalls;
      await rm(tempRoot, { force: true, recursive: true });
    }
  });

  test("rejects framework mode when WebGL renderer startup is refused", async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "doudou-official-runtime-renderer-startup-"));
    const originalFetch = globalThis.fetch;
    try {
      const sdkDir = path.join(tempRoot, "CubismSdkForWeb");
      const outputFile = path.join(tempRoot, "local_live2d_runtime", "default-doudou-official-runtime.mjs");
      await writeSyntheticCubismFrameworkSdk(sdkDir, { rendererStartupResult: "rejected" });

      const buildResult = await buildDoudouOfficialLive2DRendererRuntimeModule({
        mode: "framework",
        outputFile,
        sdkDir
      });

      expect(buildResult).toMatchObject({ ok: true });
      const calls: string[] = [];
      globalThis.fetch = vi.fn(async (url: string | URL | Request) => {
        calls.push(`fetch:${String(url).replace(tempRoot, "<temp>")}`);
        return new Response(new TextEncoder().encode("fixture").buffer);
      }) as typeof fetch;
      (globalThis as { __doudouOfficialRuntimeFixtureCalls?: string[] }).__doudouOfficialRuntimeFixtureCalls = calls;

      const library = await loadDefaultDoudouLive2DPreviewLibrary(DEFAULT_DOUDOU_EXP3_FIXTURE_DIR);
      const runtimeModuleUrl = `${pathToFileURL(outputFile).href}?case=framework-renderer-startup-${Date.now()}`;
      const host = createDoudouOfficialLive2DRendererHost({
        canvas: createFakeCanvas(),
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
            runtimeModuleUrl
          }
        },
        importRuntimeModule: async (moduleUrl) => await import(moduleUrl),
        loadCoreScript: async (coreScriptUrl) => {
          calls.push(`loadCore:${coreScriptUrl}`);
        }
      });

      await host.loadDefaultModel(library);

      expect(host.evidence()).toMatchObject({
        expressionCount: 0,
        modelLoaded: false,
        runtimeFailureReason: "model_or_expression_load_failed",
        runtimeLifecycle: {
          expressionLoadCalls: 0,
          expressionSetCalls: 0
        },
        runtimeModuleProbe: "model_failed"
      });
      expect(calls).toContain("CubismRenderer_WebGL.startUp:true");
      expect(calls).toContain("CubismRenderer_WebGL.startUpResult:false");
      expect(calls).not.toContain("CubismRenderer_WebGL.loadShaders");
      expect(calls.some((call) => call === "CubismExpressionMotion.create")).toBe(false);
    } finally {
      globalThis.fetch = originalFetch;
      delete (globalThis as { __doudouOfficialRuntimeFixtureCalls?: string[] }).__doudouOfficialRuntimeFixtureCalls;
      await rm(tempRoot, { force: true, recursive: true });
    }
  });

  test("waits for the official sample CompleteSetup state before loading expressions", async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "doudou-official-sample-ready-"));
    try {
      const sdkDir = path.join(tempRoot, "CubismSdkForWeb");
      const outputFile = path.join(tempRoot, "local_live2d_runtime", "default-doudou-sample-runtime.mjs");
      await writeSyntheticCubismSampleSdk(sdkDir, { readiness: "delayedCompleteSetup" });

      const buildResult = await buildDoudouOfficialLive2DRendererRuntimeModule({
        mode: "sample",
        outputFile,
        sdkDir
      });

      expect(buildResult).toMatchObject({ ok: true });
      const calls: string[] = [];
      (globalThis as { __doudouOfficialRuntimeFixtureCalls?: string[] }).__doudouOfficialRuntimeFixtureCalls = calls;

      const library = await loadDefaultDoudouLive2DPreviewLibrary(DEFAULT_DOUDOU_EXP3_FIXTURE_DIR);
      const runtimeModuleUrl = `${pathToFileURL(outputFile).href}?case=sample-ready-${Date.now()}`;
      const host = createDoudouOfficialLive2DRendererHost({
        canvas: createFakeCanvas(),
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
            runtimeModuleUrl
          }
        },
        importRuntimeModule: async (moduleUrl) => await import(moduleUrl),
        loadCoreScript: async (coreScriptUrl) => {
          calls.push(`loadCore:${coreScriptUrl}`);
        }
      });

      await host.loadDefaultModel(library);

      const completeSetupIndex = calls.indexOf("LAppModel.completeSetup");
      const firstExpressionLoadIndex = calls.findIndex((call) => call.startsWith("LAppModel.loadExpression:"));
      expect(completeSetupIndex).toBeGreaterThanOrEqual(0);
      expect(firstExpressionLoadIndex).toBeGreaterThan(completeSetupIndex);
      expect(host.evidence()).toMatchObject({
        expressionCount: 12,
        modelLoaded: true,
        runtimeModuleProbe: "loaded"
      });
    } finally {
      delete (globalThis as { __doudouOfficialRuntimeFixtureCalls?: string[] }).__doudouOfficialRuntimeFixtureCalls;
      await rm(tempRoot, { force: true, recursive: true });
    }
  });

  test("drives the official sample texture manager callback before loading expressions", async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "doudou-official-sample-texture-ready-"));
    const restoreImage = installFakeImage();
    try {
      const sdkDir = path.join(tempRoot, "CubismSdkForWeb");
      const outputFile = path.join(tempRoot, "local_live2d_runtime", "default-doudou-sample-runtime.mjs");
      await writeSyntheticCubismSampleSdk(sdkDir, { readiness: "textureCallbackCompleteSetup" });

      const buildResult = await buildDoudouOfficialLive2DRendererRuntimeModule({
        mode: "sample",
        outputFile,
        sdkDir
      });

      expect(buildResult).toMatchObject({ ok: true });
      const calls: string[] = [];
      (globalThis as { __doudouOfficialRuntimeFixtureCalls?: string[] }).__doudouOfficialRuntimeFixtureCalls = calls;

      const library = await loadDefaultDoudouLive2DPreviewLibrary(DEFAULT_DOUDOU_EXP3_FIXTURE_DIR);
      const runtimeModuleUrl = `${pathToFileURL(outputFile).href}?case=sample-texture-ready-${Date.now()}`;
      const host = createDoudouOfficialLive2DRendererHost({
        canvas: createFakeCanvas(),
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
            runtimeModuleUrl
          }
        },
        importRuntimeModule: async (moduleUrl) => await import(moduleUrl),
        loadCoreScript: async (coreScriptUrl) => {
          calls.push(`loadCore:${coreScriptUrl}`);
        }
      });

      await host.loadDefaultModel(library);

      const textureLoadedIndex = calls.indexOf("LAppModel.textureLoaded:file:///models/textures/default-doudou.png:64x32:true");
      const firstExpressionLoadIndex = calls.findIndex((call) => call.startsWith("LAppModel.loadExpression:"));
      expect(calls).toContain("Image.src:file:///models/textures/default-doudou.png");
      expect(calls).toContain("WebGL.createTexture");
      expect(calls).toContain("WebGL.pixelStorei:1");
      expect(calls).toContain("WebGL.texImage2D:64x32");
      expect(textureLoadedIndex).toBeGreaterThanOrEqual(0);
      expect(firstExpressionLoadIndex).toBeGreaterThan(textureLoadedIndex);
      expect(host.evidence()).toMatchObject({
        expressionCount: 12,
        modelLoaded: true,
        runtimeLifecycle: {
          expressionLoadCalls: 12
        },
        runtimeModuleProbe: "loaded"
      });
    } finally {
      restoreImage();
      delete (globalThis as { __doudouOfficialRuntimeFixtureCalls?: string[] }).__doudouOfficialRuntimeFixtureCalls;
      await rm(tempRoot, { force: true, recursive: true });
    }
  });

  test("reports sample model failure promptly when official texture loading fails", async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "doudou-official-sample-texture-error-"));
    const restoreImage = installFakeImage({ result: "error" });
    try {
      const sdkDir = path.join(tempRoot, "CubismSdkForWeb");
      const outputFile = path.join(tempRoot, "local_live2d_runtime", "default-doudou-sample-runtime.mjs");
      await writeSyntheticCubismSampleSdk(sdkDir, { readiness: "textureCallbackCompleteSetup" });

      const buildResult = await buildDoudouOfficialLive2DRendererRuntimeModule({
        mode: "sample",
        outputFile,
        sdkDir
      });

      expect(buildResult).toMatchObject({ ok: true });
      const calls: string[] = [];
      (globalThis as { __doudouOfficialRuntimeFixtureCalls?: string[] }).__doudouOfficialRuntimeFixtureCalls = calls;

      const library = await loadDefaultDoudouLive2DPreviewLibrary(DEFAULT_DOUDOU_EXP3_FIXTURE_DIR);
      const runtimeModuleUrl = `${pathToFileURL(outputFile).href}?case=sample-texture-error-${Date.now()}`;
      const host = createDoudouOfficialLive2DRendererHost({
        canvas: createFakeCanvas(),
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
            runtimeModuleUrl
          }
        },
        importRuntimeModule: async (moduleUrl) => await import(moduleUrl),
        loadCoreScript: async () => undefined
      });

      const settled = await Promise.race([
        host.loadDefaultModel(library).then(() => "settled" as const),
        new Promise<"timeout">((resolve) => {
          setTimeout(() => resolve("timeout"), 100);
        })
      ]);

      expect(settled).toBe("settled");
      expect(host.evidence()).toMatchObject({
        expressionCount: 0,
        modelLoaded: false,
        runtimeFailureReason: "model_or_expression_load_failed",
        runtimeLifecycle: {
          expressionLoadCalls: 0
        },
        runtimeModuleProbe: "model_failed"
      });
      expect(calls).toContain("Image.error:file:///models/textures/default-doudou.png");
      expect(calls.some((call) => call.startsWith("LAppModel.loadExpression:"))).toBe(false);
    } finally {
      restoreImage();
      delete (globalThis as { __doudouOfficialRuntimeFixtureCalls?: string[] }).__doudouOfficialRuntimeFixtureCalls;
      await rm(tempRoot, { force: true, recursive: true });
    }
  });

  test("rejects sample mode evidence when loaded expressions cannot be registered", async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "doudou-official-sample-expression-map-missing-"));
    try {
      const sdkDir = path.join(tempRoot, "CubismSdkForWeb");
      const outputFile = path.join(tempRoot, "local_live2d_runtime", "default-doudou-sample-runtime.mjs");
      await writeSyntheticCubismSampleSdk(sdkDir, { expressionMap: "missing" });

      const buildResult = await buildDoudouOfficialLive2DRendererRuntimeModule({
        mode: "sample",
        outputFile,
        sdkDir
      });

      expect(buildResult).toMatchObject({ ok: true });
      const calls: string[] = [];
      (globalThis as { __doudouOfficialRuntimeFixtureCalls?: string[] }).__doudouOfficialRuntimeFixtureCalls = calls;

      const library = await loadDefaultDoudouLive2DPreviewLibrary(DEFAULT_DOUDOU_EXP3_FIXTURE_DIR);
      const runtimeModuleUrl = `${pathToFileURL(outputFile).href}?case=sample-expression-map-missing-${Date.now()}`;
      const host = createDoudouOfficialLive2DRendererHost({
        canvas: createFakeCanvas(),
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
            runtimeModuleUrl
          }
        },
        importRuntimeModule: async (moduleUrl) => await import(moduleUrl),
        loadCoreScript: async (coreScriptUrl) => {
          calls.push(`loadCore:${coreScriptUrl}`);
        }
      });

      await host.loadDefaultModel(library);

      expect(host.evidence()).toMatchObject({
        expressionCount: 0,
        modelLoaded: false,
        runtimeLifecycle: {
          expressionLoadCalls: 0,
          expressionSetCalls: 0
        },
        runtimeModuleProbe: "model_failed"
      });
      expect(calls.some((call) => call.startsWith("LAppModel.loadExpression:"))).toBe(true);
      expect(calls.some((call) => call.startsWith("LAppModel.expressionMap.setValue:"))).toBe(false);
    } finally {
      delete (globalThis as { __doudouOfficialRuntimeFixtureCalls?: string[] }).__doudouOfficialRuntimeFixtureCalls;
      await rm(tempRoot, { force: true, recursive: true });
    }
  });

  test("rejects sample mode when Map-style expression registration cannot be read back", async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "doudou-official-sample-expression-map-broken-"));
    try {
      const sdkDir = path.join(tempRoot, "CubismSdkForWeb");
      const outputFile = path.join(tempRoot, "local_live2d_runtime", "default-doudou-sample-runtime.mjs");
      await writeSyntheticCubismSampleSdk(sdkDir, { expressionMap: "brokenNativeMap" });

      const buildResult = await buildDoudouOfficialLive2DRendererRuntimeModule({
        mode: "sample",
        outputFile,
        sdkDir
      });

      expect(buildResult).toMatchObject({ ok: true });
      const calls: string[] = [];
      (globalThis as { __doudouOfficialRuntimeFixtureCalls?: string[] }).__doudouOfficialRuntimeFixtureCalls = calls;

      const library = await loadDefaultDoudouLive2DPreviewLibrary(DEFAULT_DOUDOU_EXP3_FIXTURE_DIR);
      const runtimeModuleUrl = `${pathToFileURL(outputFile).href}?case=sample-expression-map-broken-${Date.now()}`;
      const host = createDoudouOfficialLive2DRendererHost({
        canvas: createFakeCanvas(),
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
            runtimeModuleUrl
          }
        },
        importRuntimeModule: async (moduleUrl) => await import(moduleUrl),
        loadCoreScript: async (coreScriptUrl) => {
          calls.push(`loadCore:${coreScriptUrl}`);
        }
      });

      await host.loadDefaultModel(library);

      expect(host.evidence()).toMatchObject({
        expressionCount: 0,
        modelLoaded: false,
        runtimeFailureReason: "model_or_expression_load_failed",
        runtimeLifecycle: {
          expressionLoadCalls: 0,
          expressionSetCalls: 0
        },
        runtimeModuleProbe: "model_failed"
      });
      expect(calls).toContain("LAppModel.expressionMap.set:兜兜安静陪伴:兜兜安静陪伴");
      expect(calls).toContain("LAppModel.expressionMap.get:兜兜安静陪伴:null");
    } finally {
      delete (globalThis as { __doudouOfficialRuntimeFixtureCalls?: string[] }).__doudouOfficialRuntimeFixtureCalls;
      await rm(tempRoot, { force: true, recursive: true });
    }
  });

  test("rejects sample mode when csmMap-style expression registration cannot be read back", async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "doudou-official-sample-expression-csmmap-broken-"));
    try {
      const sdkDir = path.join(tempRoot, "CubismSdkForWeb");
      const outputFile = path.join(tempRoot, "local_live2d_runtime", "default-doudou-sample-runtime.mjs");
      await writeSyntheticCubismSampleSdk(sdkDir, { expressionMap: "brokenCsmMap" });

      const buildResult = await buildDoudouOfficialLive2DRendererRuntimeModule({
        mode: "sample",
        outputFile,
        sdkDir
      });

      expect(buildResult).toMatchObject({ ok: true });
      const calls: string[] = [];
      (globalThis as { __doudouOfficialRuntimeFixtureCalls?: string[] }).__doudouOfficialRuntimeFixtureCalls = calls;

      const library = await loadDefaultDoudouLive2DPreviewLibrary(DEFAULT_DOUDOU_EXP3_FIXTURE_DIR);
      const runtimeModuleUrl = `${pathToFileURL(outputFile).href}?case=sample-expression-csmmap-broken-${Date.now()}`;
      const host = createDoudouOfficialLive2DRendererHost({
        canvas: createFakeCanvas(),
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
            runtimeModuleUrl
          }
        },
        importRuntimeModule: async (moduleUrl) => await import(moduleUrl),
        loadCoreScript: async () => undefined
      });

      await host.loadDefaultModel(library);

      expect(host.evidence()).toMatchObject({
        expressionCount: 0,
        modelLoaded: false,
        runtimeFailureReason: "model_or_expression_load_failed",
        runtimeLifecycle: {
          expressionLoadCalls: 0,
          expressionSetCalls: 0
        },
        runtimeModuleProbe: "model_failed"
      });
      expect(calls).toContain("LAppModel.expressionMap.setValue:兜兜安静陪伴:兜兜安静陪伴");
      expect(calls).toContain("LAppModel.expressionMap.getValue:兜兜安静陪伴:null");
    } finally {
      delete (globalThis as { __doudouOfficialRuntimeFixtureCalls?: string[] }).__doudouOfficialRuntimeFixtureCalls;
      await rm(tempRoot, { force: true, recursive: true });
    }
  });

  test("passes framework mode through the CLI instead of falling back to sample mode", async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "doudou-official-runtime-cli-mode-"));
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const sdkDir = path.join(tempRoot, "CubismSdkForWeb");
      const outputFile = path.join(tempRoot, "local_live2d_runtime", "default-doudou-framework-runtime.mjs");
      await writeSyntheticCubismFrameworkSdk(sdkDir);

      const exitCode = await runBuildDoudouOfficialLive2DRendererRuntimeModuleCli([
        "node",
        "build-doudou-live2d-official-runtime-module",
        "--sdk-dir",
        sdkDir,
        "--out",
        outputFile,
        "--mode",
        "framework"
      ]);

      expect(exitCode).toBe(0);
      expect(errorSpy).not.toHaveBeenCalled();
      expect(JSON.parse(String(logSpy.mock.calls[0]?.[0]))).toEqual({
        ok: true,
        moduleFormat: "external_es_module",
        outputFileName: "default-doudou-framework-runtime.mjs",
        sdk: {
          frameworkSource: "Framework/src"
        }
      });
      expect(await readFile(outputFile, "utf8")).not.toContain(tempRoot);
    } finally {
      logSpy.mockRestore();
      errorSpy.mockRestore();
      await rm(tempRoot, { force: true, recursive: true });
    }
  });

  test("rejects an SDK directory without the required Framework runtime files", async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "doudou-official-runtime-builder-missing-"));
    try {
      const sdkDir = path.join(tempRoot, "CubismSdkForWeb");
      await mkdir(path.join(sdkDir, "Framework/src"), { recursive: true });

      const result = await buildDoudouOfficialLive2DRendererRuntimeModule({
        mode: "framework",
        outputFile: path.join(tempRoot, "runtime.mjs"),
        sdkDir
      });

      expect(result).toEqual({
        ok: false,
        reason: "sdk_framework_runtime_missing"
      });
      expect(JSON.stringify(result)).not.toContain(tempRoot);
    } finally {
      await rm(tempRoot, { force: true, recursive: true });
    }
  });

  test("rejects sample mode when official sample support files are missing", async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "doudou-official-sample-runtime-missing-"));
    try {
      const sdkDir = path.join(tempRoot, "CubismSdkForWeb");
      await writeSyntheticCubismSampleSdk(sdkDir, { sampleSupportFiles: false });

      const result = await buildDoudouOfficialLive2DRendererRuntimeModule({
        mode: "sample",
        outputFile: path.join(tempRoot, "runtime.mjs"),
        sdkDir
      });

      expect(result).toEqual({
        ok: false,
        reason: "sdk_sample_runtime_missing"
      });
      expect(JSON.stringify(result)).not.toContain(tempRoot);
    } finally {
      await rm(tempRoot, { force: true, recursive: true });
    }
  });

  test("rejects sample mode when an official sample support file path resolves to a directory", async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "doudou-official-sample-runtime-directory-"));
    try {
      const sdkDir = path.join(tempRoot, "CubismSdkForWeb");
      const sampleSourceFile = path.join(sdkDir, "Samples/TypeScript/Demo/src/lappview.ts");
      await writeSyntheticCubismSampleSdk(sdkDir);
      await rm(sampleSourceFile, { force: true, recursive: true });
      await mkdir(sampleSourceFile, { recursive: true });

      const result = await buildDoudouOfficialLive2DRendererRuntimeModule({
        mode: "sample",
        outputFile: path.join(tempRoot, "runtime.mjs"),
        sdkDir
      });

      expect(result).toEqual({
        ok: false,
        reason: "sdk_sample_runtime_missing"
      });
      expect(JSON.stringify(result)).not.toContain(tempRoot);
    } finally {
      await rm(tempRoot, { force: true, recursive: true });
    }
  });

  test("rejects sample mode when official sample Framework dependencies are missing", async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "doudou-official-sample-framework-missing-"));
    try {
      const sdkDir = path.join(tempRoot, "CubismSdkForWeb");
      await writeSyntheticCubismSampleSdk(sdkDir, { sampleFrameworkFiles: false });

      const result = await buildDoudouOfficialLive2DRendererRuntimeModule({
        mode: "sample",
        outputFile: path.join(tempRoot, "runtime.mjs"),
        sdkDir
      });

      expect(result).toEqual({
        ok: false,
        reason: "sdk_framework_runtime_missing"
      });
      expect(JSON.stringify(result)).not.toContain(tempRoot);
    } finally {
      await rm(tempRoot, { force: true, recursive: true });
    }
  });

  test("rejects framework mode when a Framework runtime file path resolves to a directory", async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "doudou-official-framework-runtime-directory-"));
    try {
      const sdkDir = path.join(tempRoot, "CubismSdkForWeb");
      const frameworkSourceFile = path.join(sdkDir, "Framework/src/motion/cubismexpressionmotion.ts");
      await writeSyntheticCubismFrameworkSdk(sdkDir);
      await rm(frameworkSourceFile, { force: true, recursive: true });
      await mkdir(frameworkSourceFile, { recursive: true });

      const result = await buildDoudouOfficialLive2DRendererRuntimeModule({
        mode: "framework",
        outputFile: path.join(tempRoot, "runtime.mjs"),
        sdkDir
      });

      expect(result).toEqual({
        ok: false,
        reason: "sdk_framework_runtime_missing"
      });
      expect(JSON.stringify(result)).not.toContain(tempRoot);
    } finally {
      await rm(tempRoot, { force: true, recursive: true });
    }
  });
});

async function writeSyntheticCubismSampleSdk(
  sdkDir: string,
  options: {
    expressionMap?: "brokenCsmMap" | "brokenNativeMap" | "csmMap" | "missing";
    readiness?: "loadedFlag" | "delayedCompleteSetup" | "textureCallbackCompleteSetup";
    sampleFrameworkFiles?: boolean;
    sampleSupportFiles?: boolean;
    setExpressionResult?: "accepted" | "rejected";
  } = {}
): Promise<void> {
  const expressionMap = options.expressionMap ?? "csmMap";
  const readiness = options.readiness ?? "loadedFlag";
  const sampleFrameworkFiles = options.sampleFrameworkFiles ?? true;
  const sampleSupportFiles = options.sampleSupportFiles ?? true;
  const setExpressionResult = options.setExpressionResult ?? "accepted";
  await mkdir(path.join(sdkDir, "Framework/src/live2dcubismframework.ts", ".."), { recursive: true });
  await mkdir(path.join(sdkDir, "Framework/src/math"), { recursive: true });
  await mkdir(path.join(sdkDir, "Framework/src/motion"), { recursive: true });
  await mkdir(path.join(sdkDir, "Samples/TypeScript/Demo/src"), { recursive: true });
  await writeFile(
    path.join(sdkDir, "Framework/src/live2dcubismframework.ts"),
    `
export class Option {
  logFunction = () => {};
  loggingLevel = LogLevel.LogLevel_Off;
}
export enum LogLevel {
  LogLevel_Off = 5
}
export class CubismFramework {
  static startUp() {
    return true;
  }
  static initialize() {}
  static isStarted() {
    return false;
  }
  static isInitialized() {
    return false;
  }
}
`,
    "utf8"
  );
  await writeFile(
    path.join(sdkDir, "Framework/src/math/cubismmatrix44.ts"),
    `
export class CubismMatrix44 {
  multiplyByMatrix() {}
  scale() {}
}
`,
    "utf8"
  );
  await writeFile(
    path.join(sdkDir, "Framework/src/motion/cubismexpressionupdater.ts"),
    `
export class CubismExpressionUpdater {
  constructor(expressionManager) {
    this.expressionManager = expressionManager;
  }
}
`,
    "utf8"
  );
  if (sampleFrameworkFiles) {
    await writeSyntheticCubismSampleFrameworkFiles(sdkDir);
  }
  await writeFile(
    path.join(sdkDir, "Samples/TypeScript/Demo/src/lapppal.ts"),
    `
const calls = () => globalThis.__doudouOfficialRuntimeFixtureCalls ?? [];
export class LAppPal {
  static updateTime() {
    calls().push("LAppPal.updateTime");
  }
}
`,
    "utf8"
  );
  if (sampleSupportFiles) {
    await writeSyntheticCubismSampleSupportFiles(sdkDir);
  }
  await writeFile(
    path.join(sdkDir, "Samples/TypeScript/Demo/src/lappmodel.ts"),
    `
import { CubismMatrix44 } from "@framework/math/cubismmatrix44";
const calls = () => globalThis.__doudouOfficialRuntimeFixtureCalls ?? [];
const expressionMap = ${JSON.stringify(expressionMap)};
const readiness = ${JSON.stringify(readiness)};
const setExpressionResult = ${JSON.stringify(setExpressionResult)};
export class LAppModel {
  constructor() {
    this._model = {};
    if (expressionMap === "csmMap") {
      const values = new Map();
      this._expressions = {
        setValue(name, expression) {
          calls().push("LAppModel.expressionMap.setValue:" + name + ":" + expression.name);
          values.set(name, expression);
        },
        getValue(name) {
          const expression = values.get(name);
          calls().push("LAppModel.expressionMap.getValue:" + name + ":" + (expression?.name ?? "null"));
          return expression;
        }
      };
    } else if (expressionMap === "brokenCsmMap") {
      this._expressions = {
        setValue(name, expression) {
          calls().push("LAppModel.expressionMap.setValue:" + name + ":" + expression.name);
        },
        getValue(name) {
          calls().push("LAppModel.expressionMap.getValue:" + name + ":null");
          return null;
        }
      };
    } else if (expressionMap === "brokenNativeMap") {
      this._expressions = {
        set(name, expression) {
          calls().push("LAppModel.expressionMap.set:" + name + ":" + expression.name);
        },
        get(name) {
          calls().push("LAppModel.expressionMap.get:" + name + ":null");
          return null;
        }
      };
    }
    this._expressionManager = {
      updateMotion(_model, deltaTimeSeconds) {
        calls().push("LAppModel.expressionUpdateMotion:" + deltaTimeSeconds.toFixed(3));
      }
    };
  }
  setSubdelegate(subdelegate) {
    this.subdelegate = subdelegate;
    calls().push("LAppModel.setSubdelegate:" + Boolean(subdelegate.getCanvas()));
  }
  loadAssets(dir, fileName) {
    calls().push("LAppModel.loadAssets:" + dir + ":" + fileName);
    if (readiness === "delayedCompleteSetup") {
      this._updating = false;
      this._initialized = true;
      this._state = 22;
      calls().push("LAppModel.waitLoadTexture");
      setTimeout(() => {
        this._state = 23;
        calls().push("LAppModel.completeSetup");
      }, 40);
    } else if (readiness === "textureCallbackCompleteSetup") {
      this._updating = false;
      this._initialized = true;
      this._state = 22;
      this._textureCount = 0;
      this._modelSetting = {
        getTextureCount() {
          return 1;
        }
      };
      calls().push("LAppModel.waitLoadTexture");
      this.subdelegate.getTextureManager().createTextureFromPngFile(
        dir + "textures/default-doudou.png",
        true,
        (textureInfo) => {
          calls().push(
            "LAppModel.textureLoaded:" +
              textureInfo.fileName +
              ":" +
              textureInfo.width +
              "x" +
              textureInfo.height +
              ":" +
              textureInfo.usePremultply
          );
          this._textureCount += 1;
          this._state = 23;
          calls().push("LAppModel.completeSetup");
        }
      );
    } else {
      this.loaded = true;
    }
  }
  loadExpression(_buffer, size, name) {
    calls().push("LAppModel.loadExpression:" + name + ":" + size);
    return { name };
  }
  setExpression(name) {
    calls().push("LAppModel.setExpression:" + name);
    if (setExpressionResult === "rejected") {
      calls().push("LAppModel.setExpressionResult:false");
      return false;
    }
  }
  update() {
    calls().push("LAppModel.update");
  }
  draw(matrix) {
    calls().push("LAppModel.draw:" + (matrix instanceof CubismMatrix44));
  }
}
`,
    "utf8"
  );
}

async function writeSyntheticCubismSampleFrameworkFiles(sdkDir: string): Promise<void> {
  const sampleFrameworkFiles = [
    "cubismdefaultparameterid.ts",
    "cubismmodelsettingjson.ts",
    "effect/cubismbreath.ts",
    "effect/cubismeyeblink.ts",
    "effect/cubismlook.ts",
    "icubismmodelsetting.ts",
    "id/cubismid.ts",
    "math/cubismviewmatrix.ts",
    "model/cubismmoc.ts",
    "model/cubismusermodel.ts",
    "motion/acubismmotion.ts",
    "motion/cubismbreathupdater.ts",
    "motion/cubismeyeblinkupdater.ts",
    "motion/cubismlipsyncupdater.ts",
    "motion/cubismlookupdater.ts",
    "motion/cubismmotion.ts",
    "motion/cubismmotionqueuemanager.ts",
    "motion/cubismphysicsupdater.ts",
    "motion/cubismposeupdater.ts",
    "motion/cubismupdatescheduler.ts",
    "rendering/cubismoffscreenmanager.ts",
    "type/csmrectf.ts",
    "utils/cubismdebug.ts"
  ];
  for (const sampleFrameworkFile of sampleFrameworkFiles) {
    const filePath = path.join(sdkDir, "Framework/src", sampleFrameworkFile);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, "export {};\n", "utf8");
  }
}

async function writeSyntheticCubismSampleSupportFiles(sdkDir: string): Promise<void> {
  const sampleSupportFiles = [
    "lappdefine.ts",
    "lappdelegate.ts",
    "lappglmanager.ts",
    "lapplive2dmanager.ts",
    "lappsprite.ts",
    "lappsubdelegate.ts",
    "lapptexturemanager.ts",
    "lappview.ts",
    "lappwavfilehandler.ts",
    "touchmanager.ts"
  ];
  for (const sampleSupportFile of sampleSupportFiles) {
    await writeFile(path.join(sdkDir, "Samples/TypeScript/Demo/src", sampleSupportFile), "export {};\n", "utf8");
  }
}

function createFakeCanvas(): HTMLCanvasElement {
  const calls = (): string[] => (globalThis as { __doudouOfficialRuntimeFixtureCalls?: string[] })
    .__doudouOfficialRuntimeFixtureCalls ?? [];
  const gl = {
    BLEND: 1,
    COLOR_BUFFER_BIT: 2,
    DEPTH_BUFFER_BIT: 4,
    FRAMEBUFFER_BINDING: 7,
    LINEAR: 8,
    ONE_MINUS_SRC_ALPHA: 5,
    RGBA: 9,
    SRC_ALPHA: 6,
    TEXTURE_2D: 10,
    TEXTURE_MAG_FILTER: 11,
    TEXTURE_MIN_FILTER: 12,
    UNPACK_PREMULTIPLY_ALPHA_WEBGL: 13,
    UNSIGNED_BYTE: 14,
    blendFunc() {},
    bindTexture(_target: number, texture: unknown) {
      calls().push(`WebGL.bindTexture:${Boolean(texture)}`);
    },
    clear() {},
    clearColor() {},
    createTexture() {
      calls().push("WebGL.createTexture");
      return { id: "fixture-texture" };
    },
    enable() {},
    getParameter() {
      return null;
    },
    pixelStorei(_parameterName: number, parameterValue: number) {
      calls().push(`WebGL.pixelStorei:${parameterValue}`);
    },
    texImage2D(
      _target: number,
      _level: number,
      _internalFormat: number,
      _format: number,
      _type: number,
      image: { height: number; width: number }
    ) {
      calls().push(`WebGL.texImage2D:${image.width}x${image.height}`);
    },
    texParameteri() {},
    viewport() {}
  };
  return {
    height: 256,
    width: 256,
    getContext(type: string) {
      return type === "webgl" || type === "experimental-webgl" ? gl : null;
    }
  } as unknown as HTMLCanvasElement;
}

function installFakeImage(options: { result?: "error" | "load" } = {}): () => void {
  const originalImage = globalThis.Image;
  const result = options.result ?? "load";
  class FixtureImage {
    height = 32;
    width = 64;
    private listeners = new Map<string, Array<() => void>>();

    addEventListener(eventName: string, listener: () => void): void {
      const listeners = this.listeners.get(eventName) ?? [];
      listeners.push(listener);
      this.listeners.set(eventName, listeners);
    }

    set src(value: string) {
      (globalThis as { __doudouOfficialRuntimeFixtureCalls?: string[] }).__doudouOfficialRuntimeFixtureCalls?.push(
        `Image.src:${value}`
      );
      setTimeout(() => {
        const eventName = result === "error" ? "error" : "load";
        if (eventName === "error") {
          (globalThis as { __doudouOfficialRuntimeFixtureCalls?: string[] }).__doudouOfficialRuntimeFixtureCalls?.push(
            `Image.error:${value}`
          );
        }
        for (const listener of this.listeners.get(eventName) ?? []) {
          listener();
        }
      }, 0);
    }
  }
  globalThis.Image = FixtureImage as unknown as typeof Image;
  return () => {
    globalThis.Image = originalImage;
  };
}

async function writeSyntheticCubismFrameworkSdk(
  sdkDir: string,
  options: { rendererStartupResult?: "accepted" | "rejected" } = {}
): Promise<void> {
  const rendererStartupResult = options.rendererStartupResult ?? "accepted";
  await mkdir(path.join(sdkDir, "Framework/src/math"), { recursive: true });
  await mkdir(path.join(sdkDir, "Framework/src/model"), { recursive: true });
  await mkdir(path.join(sdkDir, "Framework/src/motion"), { recursive: true });
  await mkdir(path.join(sdkDir, "Framework/src/rendering"), { recursive: true });
  await writeFile(
    path.join(sdkDir, "Framework/src/live2dcubismframework.ts"),
    `
const calls = () => globalThis.__doudouOfficialRuntimeFixtureCalls ?? [];
export class Option {
  logFunction = () => {};
  loggingLevel = LogLevel.LogLevel_Off;
}
export enum LogLevel {
  LogLevel_Off = 5
}
export class CubismFramework {
  static startUp() {
    calls().push("CubismFramework.startUp");
    return true;
  }
  static initialize() {
    calls().push("CubismFramework.initialize");
  }
  static isStarted() {
    return false;
  }
  static isInitialized() {
    return false;
  }
}
`,
    "utf8"
  );
  await writeFile(
    path.join(sdkDir, "Framework/src/cubismmodelsettingjson.ts"),
    `
const calls = () => globalThis.__doudouOfficialRuntimeFixtureCalls ?? [];
export class CubismModelSettingJson {
  constructor(_buffer, size) {
    calls().push("CubismModelSettingJson:" + size);
  }
  getModelFileName() {
    return "default-doudou.moc3";
  }
  getTextureCount() {
    return 0;
  }
  getTextureFileName() {
    return "";
  }
  getLayoutMap(layout) {
    calls().push("CubismModelSettingJson.getLayoutMap");
    layout.set("width", 2);
    layout.set("height", 2);
  }
}
`,
    "utf8"
  );
  await writeFile(
    path.join(sdkDir, "Framework/src/model/cubismmoc.ts"),
    `
const calls = () => globalThis.__doudouOfficialRuntimeFixtureCalls ?? [];
export class CubismMoc {
  static create(_buffer, shouldCheckMocConsistency) {
    calls().push("CubismMoc.create:" + shouldCheckMocConsistency);
    return {
      createModel() {
        calls().push("CubismMoc.createModel");
        return {
          getCanvasHeight() {
            return 2;
          },
          getCanvasWidth() {
            return 2;
          },
          loadParameters() {
            calls().push("CubismModel.loadParameters");
          },
          saveParameters() {
            calls().push("CubismModel.saveParameters");
          },
          update() {
            calls().push("CubismModel.update");
          }
        };
      }
    };
  }
}
`,
    "utf8"
  );
  await writeFile(
    path.join(sdkDir, "Framework/src/math/cubismmatrix44.ts"),
    `
const calls = () => globalThis.__doudouOfficialRuntimeFixtureCalls ?? [];
export class CubismMatrix44 {
  multiplyByMatrix() {
    calls().push("CubismMatrix44.multiplyByMatrix");
  }
  scale(x, y) {
    calls().push("CubismMatrix44.scale:" + x.toFixed(3) + ":" + y.toFixed(3));
  }
}
`,
    "utf8"
  );
  await writeFile(
    path.join(sdkDir, "Framework/src/math/cubismmodelmatrix.ts"),
    `
const calls = () => globalThis.__doudouOfficialRuntimeFixtureCalls ?? [];
export class CubismModelMatrix {
  constructor(width, height) {
    calls().push("CubismModelMatrix:" + width + ":" + height);
  }
  setupFromLayout() {
    calls().push("CubismModelMatrix.setupFromLayout");
  }
}
`,
    "utf8"
  );
  await writeFile(
    path.join(sdkDir, "Framework/src/motion/cubismexpressionmotion.ts"),
    `
const calls = () => globalThis.__doudouOfficialRuntimeFixtureCalls ?? [];
export class CubismExpressionMotion {
  static create() {
    calls().push("CubismExpressionMotion.create");
    return {};
  }
}
`,
    "utf8"
  );
  await writeFile(
    path.join(sdkDir, "Framework/src/motion/cubismmotionmanager.ts"),
    `
const calls = () => globalThis.__doudouOfficialRuntimeFixtureCalls ?? [];
export class CubismMotionManager {
  startMotionPriority(_motion, autoDelete, priority) {
    calls().push("CubismMotionManager.startMotionPriority:" + autoDelete + ":" + priority);
    return 1;
  }
  updateMotion(_model, deltaTimeSeconds) {
    calls().push("CubismMotionManager.updateMotion:" + deltaTimeSeconds.toFixed(3));
    return true;
  }
}
`,
    "utf8"
  );
  await writeFile(
    path.join(sdkDir, "Framework/src/rendering/cubismrenderer_webgl.ts"),
    `
const calls = () => globalThis.__doudouOfficialRuntimeFixtureCalls ?? [];
const rendererStartupResult = ${JSON.stringify(rendererStartupResult)};
export class CubismRenderer_WebGL {
  constructor(width, height) {
    calls().push("CubismRenderer_WebGL:" + width + ":" + height);
  }
  bindTexture(index) {
    calls().push("CubismRenderer_WebGL.bindTexture:" + index);
  }
  doDrawModel() {
    calls().push("CubismRenderer_WebGL.doDrawModel");
  }
  initialize() {
    calls().push("CubismRenderer_WebGL.initialize");
  }
  loadShaders() {
    calls().push("CubismRenderer_WebGL.loadShaders");
  }
  setIsPremultipliedAlpha(value) {
    calls().push("CubismRenderer_WebGL.setIsPremultipliedAlpha:" + value);
  }
  setMvpMatrix() {
    calls().push("CubismRenderer_WebGL.setMvpMatrix");
  }
  setRenderState(_frameBuffer, viewport) {
    calls().push("CubismRenderer_WebGL.setRenderState:" + viewport.join(","));
  }
  startUp(gl) {
    calls().push("CubismRenderer_WebGL.startUp:" + Boolean(gl));
    if (rendererStartupResult === "rejected") {
      calls().push("CubismRenderer_WebGL.startUpResult:false");
      return false;
    }
    return true;
  }
}
`,
    "utf8"
  );
}

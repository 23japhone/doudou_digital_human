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
        expressionCount: 12,
        expressionSwitches: 1,
        frameLoopAdvanced: true,
        modelLoaded: true,
        runtimeModuleProbe: "loaded",
        updateCalls: 2
      });
      expect(calls).toContain("LAppModel.setSubdelegate:true");
      expect(calls).toContain("LAppModel.loadAssets:file:///models/:default-doudou.model3.json");
      expect(calls.filter((call) => call.startsWith("LAppModel.loadExpression:")).length).toBe(12);
      expect(calls).toContain("LAppModel.setExpression:兜兜开心发光");
      expect(calls).toContain("LAppModel.expressionUpdateMotion:0.000");
      expect(calls).toContain("LAppModel.expressionUpdateMotion:0.033");
      expect(calls.filter((call) => call === "LAppModel.update").length).toBe(2);
      expect(calls.filter((call) => call === "LAppModel.draw:true").length).toBe(2);
      expect(JSON.stringify(host.evidence())).not.toContain(tempRoot);
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
        expressionCount: 12,
        expressionSwitches: 1,
        frameLoopAdvanced: true,
        modelLoaded: true,
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
});

async function writeSyntheticCubismSampleSdk(sdkDir: string): Promise<void> {
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
  await writeFile(
    path.join(sdkDir, "Samples/TypeScript/Demo/src/lappmodel.ts"),
    `
import { CubismMatrix44 } from "@framework/math/cubismmatrix44";
const calls = () => globalThis.__doudouOfficialRuntimeFixtureCalls ?? [];
export class LAppModel {
  constructor() {
    this._model = {};
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
    this.loaded = true;
    calls().push("LAppModel.loadAssets:" + dir + ":" + fileName);
  }
  loadExpression(_buffer, size, name) {
    calls().push("LAppModel.loadExpression:" + name + ":" + size);
    return { name };
  }
  setExpression(name) {
    calls().push("LAppModel.setExpression:" + name);
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

function createFakeCanvas(): HTMLCanvasElement {
  const gl = {
    BLEND: 1,
    COLOR_BUFFER_BIT: 2,
    DEPTH_BUFFER_BIT: 4,
    ONE_MINUS_SRC_ALPHA: 5,
    SRC_ALPHA: 6,
    blendFunc() {},
    clear() {},
    clearColor() {},
    enable() {},
    getParameter() {
      return null;
    },
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

async function writeSyntheticCubismFrameworkSdk(sdkDir: string): Promise<void> {
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
  }
}
`,
    "utf8"
  );
}

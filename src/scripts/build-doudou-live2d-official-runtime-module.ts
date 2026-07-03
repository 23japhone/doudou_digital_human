import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build, type InlineConfig } from "vite";

export type DoudouOfficialLive2DRuntimeModuleBuildFailureReason =
  | "build_failed"
  | "sdk_framework_runtime_missing";

export type DoudouOfficialLive2DRuntimeModuleBuildResult =
  | {
    ok: true;
    moduleFormat: "external_es_module";
    outputFileName: string;
    sdk: {
      frameworkSource: "Framework/src";
    };
  }
  | {
    ok: false;
    reason: DoudouOfficialLive2DRuntimeModuleBuildFailureReason;
  };

export interface BuildDoudouOfficialLive2DRendererRuntimeModuleInput {
  outputFile: string;
  sdkDir: string;
}

const FRAMEWORK_SOURCE = "Framework/src";
const REQUIRED_FRAMEWORK_RUNTIME_FILES = [
  "live2dcubismframework.ts",
  "cubismmodelsettingjson.ts",
  "math/cubismmatrix44.ts",
  "math/cubismmodelmatrix.ts",
  "model/cubismmoc.ts",
  "motion/cubismexpressionmotion.ts",
  "motion/cubismmotionmanager.ts",
  "rendering/cubismrenderer_webgl.ts"
] as const;

export async function buildDoudouOfficialLive2DRendererRuntimeModule(
  input: BuildDoudouOfficialLive2DRendererRuntimeModuleInput
): Promise<DoudouOfficialLive2DRuntimeModuleBuildResult> {
  const sdkDir = path.resolve(input.sdkDir);
  const outputFile = path.resolve(input.outputFile);
  const frameworkSourceDir = path.join(sdkDir, FRAMEWORK_SOURCE);
  if (!await hasRequiredFrameworkRuntimeFiles(frameworkSourceDir)) {
    return {
      ok: false,
      reason: "sdk_framework_runtime_missing"
    };
  }

  try {
    await mkdir(path.dirname(outputFile), { recursive: true });
    await build(createRuntimeModuleBuildConfig({
      frameworkSourceDir,
      outputDir: path.dirname(outputFile),
      outputFileName: path.basename(outputFile)
    }));
    await stripBundlerPathComments(outputFile);
  } catch {
    return {
      ok: false,
      reason: "build_failed"
    };
  }

  return {
    ok: true,
    moduleFormat: "external_es_module",
    outputFileName: path.basename(outputFile),
    sdk: {
      frameworkSource: FRAMEWORK_SOURCE
    }
  };
}

export async function runBuildDoudouOfficialLive2DRendererRuntimeModuleCli(
  argv: string[]
): Promise<number> {
  const options = parseArgs(argv.slice(2));
  if (!options.sdkDir || !options.outputFile) {
    console.error("Usage: build-doudou-live2d-official-runtime-module --sdk-dir <sdk-dir> --out <module-file>");
    return 2;
  }

  const result = await buildDoudouOfficialLive2DRendererRuntimeModule({
    outputFile: options.outputFile,
    sdkDir: options.sdkDir
  });
  const output = JSON.stringify(result, null, 2);
  if (result.ok) {
    console.log(output);
    return 0;
  }
  console.error(output);
  return 1;
}

function createRuntimeModuleBuildConfig(options: {
  frameworkSourceDir: string;
  outputDir: string;
  outputFileName: string;
}): InlineConfig {
  return {
    build: {
      emptyOutDir: false,
      lib: {
        entry: pathToFileURL("doudou-official-runtime-entry.ts").href,
        fileName: () => options.outputFileName,
        formats: ["es"]
      },
      minify: false,
      outDir: options.outputDir,
      rollupOptions: {
        input: {
          [path.parse(options.outputFileName).name]: "\0doudou-official-runtime-entry"
        },
        output: {
          entryFileNames: options.outputFileName
        },
        plugins: [
          {
            name: "doudou-official-runtime-entry",
            resolveId(source) {
              return source === "\0doudou-official-runtime-entry" ? source : null;
            },
            load(id) {
              return id === "\0doudou-official-runtime-entry" ? DOUDOU_OFFICIAL_RUNTIME_MODULE_SOURCE : null;
            }
          }
        ]
      },
      sourcemap: false
    },
    configFile: false,
    logLevel: "silent",
    publicDir: false,
    resolve: {
      alias: [
        {
          find: "@framework",
          replacement: options.frameworkSourceDir
        }
      ]
    }
  };
}

async function hasRequiredFrameworkRuntimeFiles(frameworkSourceDir: string): Promise<boolean> {
  for (const relativeFile of REQUIRED_FRAMEWORK_RUNTIME_FILES) {
    if (!await exists(path.join(frameworkSourceDir, relativeFile))) {
      return false;
    }
  }
  return true;
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function stripBundlerPathComments(outputFile: string): Promise<void> {
  const generated = await readFile(outputFile, "utf8");
  const sanitized = generated.replace(/^\/\/#(?:end)?region.*(?:\r?\n)?/gm, "");
  await writeFile(outputFile, sanitized, "utf8");
}

function parseArgs(args: string[]): Partial<BuildDoudouOfficialLive2DRendererRuntimeModuleInput> {
  const options: Partial<BuildDoudouOfficialLive2DRendererRuntimeModuleInput> = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--sdk-dir") {
      options.sdkDir = args[index + 1];
      index += 1;
    } else if (arg === "--out") {
      options.outputFile = args[index + 1];
      index += 1;
    }
  }
  return options;
}

const DOUDOU_OFFICIAL_RUNTIME_MODULE_SOURCE = `
import { CubismModelSettingJson } from "@framework/cubismmodelsettingjson";
import { CubismFramework, LogLevel, Option } from "@framework/live2dcubismframework";
import { CubismMatrix44 } from "@framework/math/cubismmatrix44";
import { CubismModelMatrix } from "@framework/math/cubismmodelmatrix";
import { CubismMoc } from "@framework/model/cubismmoc";
import { CubismExpressionMotion } from "@framework/motion/cubismexpressionmotion";
import { CubismMotionManager } from "@framework/motion/cubismmotionmanager";
import { CubismRenderer_WebGL } from "@framework/rendering/cubismrenderer_webgl";

const DOUDOU_EXPRESSION_PRIORITY_FORCE = 3;

export function createDoudouOfficialLive2DRendererRuntime(options) {
  return new DefaultDoudouOfficialLive2DRendererRuntime(options);
}

class DefaultDoudouOfficialLive2DRendererRuntime {
  constructor(options) {
    this.canvas = options.canvas;
    this.expressionManager = new CubismMotionManager();
    this.expressions = new Map();
    this.gl = requireWebGlContext(options.canvas);
    this.model = null;
    this.modelMatrix = null;
    this.modelRootUrl = "";
    this.renderer = null;
    this.setting = null;
    ensureCubismFrameworkStarted();
  }

  async loadModel(input) {
    this.modelRootUrl = ensureTrailingSlash(input.modelRootUrl);
    const settingBuffer = await fetchArrayBuffer(input.model3JsonUrl);
    this.setting = new CubismModelSettingJson(settingBuffer, settingBuffer.byteLength);
    const modelFileName = this.setting.getModelFileName();
    if (!modelFileName) {
      throw new Error("Live2D model3.json does not reference a moc3 file.");
    }
    const mocBuffer = await fetchArrayBuffer(new URL(modelFileName, this.modelRootUrl).href);
    this.moc = CubismMoc.create(mocBuffer, true);
    if (!this.moc) {
      throw new Error("Live2D CubismMoc.create failed.");
    }
    this.model = this.moc.createModel();
    if (!this.model) {
      throw new Error("Live2D CubismMoc.createModel failed.");
    }
    this.model.saveParameters?.();
    this.modelMatrix = new CubismModelMatrix(this.model.getCanvasWidth(), this.model.getCanvasHeight());
    const layout = new Map();
    this.setting.getLayoutMap(layout);
    this.modelMatrix.setupFromLayout(layout);
    this.renderer = new CubismRenderer_WebGL(this.canvas.width, this.canvas.height);
    this.renderer.initialize(this.model);
    this.renderer.startUp(this.gl);
    await this.loadTextures();
    this.renderer.loadShaders();
  }

  async loadExpression(input) {
    const expressionJson = JSON.stringify(input.expressionJson);
    const encoded = new TextEncoder().encode(expressionJson);
    const buffer = encoded.buffer.slice(encoded.byteOffset, encoded.byteOffset + encoded.byteLength);
    const expression = CubismExpressionMotion.create(buffer, encoded.byteLength);
    if (!expression) {
      throw new Error("Live2D CubismExpressionMotion.create failed.");
    }
    this.expressions.set(input.emotionId, expression);
    this.expressions.set(input.expressionName, expression);
    return expression;
  }

  async setExpression(input) {
    let expression = this.expressions.get(input.emotionId) ?? this.expressions.get(input.expressionName);
    if (!expression) {
      expression = await this.loadExpression(input);
    }
    this.expressionManager.startMotionPriority(expression, false, DOUDOU_EXPRESSION_PRIORITY_FORCE);
  }

  update(deltaTimeSeconds) {
    if (!this.model) {
      return;
    }
    this.model.loadParameters?.();
    this.expressionManager.updateMotion(this.model, deltaTimeSeconds);
    this.model.saveParameters?.();
    this.model.update();
  }

  draw() {
    if (!this.model || !this.modelMatrix || !this.renderer) {
      return;
    }
    this.gl.viewport?.(0, 0, this.canvas.width, this.canvas.height);
    this.gl.clearColor?.(0, 0, 0, 0);
    this.gl.clear?.(this.gl.COLOR_BUFFER_BIT);
    const projection = new CubismMatrix44();
    if (this.canvas.width > this.canvas.height) {
      projection.scale(this.canvas.height / this.canvas.width, 1);
    } else {
      projection.scale(1, this.canvas.width / this.canvas.height);
    }
    projection.multiplyByMatrix(this.modelMatrix);
    this.renderer.setMvpMatrix(projection);
    this.renderer.setRenderState(null, [0, 0, this.canvas.width, this.canvas.height]);
    this.renderer.doDrawModel();
  }

  async loadTextures() {
    if (!this.setting || !this.renderer) {
      return;
    }
    const textureCount = this.setting.getTextureCount();
    for (let textureIndex = 0; textureIndex < textureCount; textureIndex += 1) {
      const textureFile = this.setting.getTextureFileName(textureIndex);
      if (!textureFile) {
        continue;
      }
      const image = await loadImage(new URL(textureFile, this.modelRootUrl).href);
      const texture = this.gl.createTexture();
      this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
      this.gl.pixelStorei(this.gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 1);
      this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, image);
      this.gl.bindTexture(this.gl.TEXTURE_2D, null);
      this.renderer.bindTexture(textureIndex, texture);
      this.renderer.setIsPremultipliedAlpha(true);
    }
  }
}

function ensureCubismFrameworkStarted() {
  if (!CubismFramework.isStarted?.()) {
    const option = new Option();
    option.logFunction = console.debug.bind(console);
    option.loggingLevel = LogLevel.LogLevel_Off;
    CubismFramework.startUp(option);
  }
  if (!CubismFramework.isInitialized?.()) {
    CubismFramework.initialize();
  }
}

function ensureTrailingSlash(value) {
  return value.endsWith("/") ? value : value + "/";
}

async function fetchArrayBuffer(url) {
  const response = await fetch(url);
  if (!response.ok && response.status >= 400) {
    throw new Error("Live2D runtime failed to fetch an asset.");
  }
  return await response.arrayBuffer();
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image), { once: true });
    image.addEventListener("error", () => reject(new Error("Live2D runtime failed to load a texture.")), { once: true });
    image.src = src;
  });
}

function requireWebGlContext(canvas) {
  const gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: true })
    ?? canvas.getContext("experimental-webgl", { alpha: true, premultipliedAlpha: true });
  if (!gl) {
    throw new Error("Live2D runtime requires a WebGL context.");
  }
  gl.enable?.(gl.BLEND);
  gl.blendFunc?.(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  return gl;
}
`;

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  void runBuildDoudouOfficialLive2DRendererRuntimeModuleCli(process.argv)
    .then((exitCode) => {
      process.exitCode = exitCode;
    })
    .catch(() => {
      console.error(JSON.stringify({ ok: false, reason: "build_failed" }, null, 2));
      process.exitCode = 1;
    });
}

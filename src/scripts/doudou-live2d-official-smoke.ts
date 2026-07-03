import { spawn } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  resolveDoudouOfficialLive2DRendererRuntime,
  type DoudouOfficialLive2DRendererRuntimeResolution
} from "../runtime/default-doudou-live2d-official-sdk-resolver.js";
import {
  doudouOfficialLive2DRendererSmokeEvidenceFailures,
  doudouOfficialLive2DRendererSmokeFailureSummary,
  parseDoudouOfficialLive2DRendererSmokeEvidence
} from "../runtime/default-doudou-live2d-official-smoke-evidence.js";
import {
  buildDoudouOfficialLive2DRendererRuntimeModule,
  type BuildDoudouOfficialLive2DRendererRuntimeModuleInput,
  type DoudouOfficialLive2DRuntimeModuleBuildMode,
  type DoudouOfficialLive2DRuntimeModuleBuildResult
} from "./build-doudou-live2d-official-runtime-module.js";
import {
  prepareDoudouLive2DSampleModel,
  type PrepareDoudouLive2DSampleModelInput,
  type PrepareDoudouLive2DSampleModelResult
} from "./prepare-doudou-live2d-sample-model.js";

export interface DoudouOfficialLive2DSmokeOptions {
  argv?: string[];
  buildRuntimeModule?: BuildRuntimeModule;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  prepareSampleModel?: PrepareSampleModel;
  resolveOfficialRuntime?: ResolveOfficialRuntime;
  runRuntimeSmoke?: RunRuntimeSmoke;
}

export interface DoudouOfficialLive2DSmokeResult {
  exitCode: number;
  output: string;
}

export interface RuntimeSmokeRunInput {
  cwd: string;
  env: NodeJS.ProcessEnv;
}

export interface RuntimeSmokeRunResult {
  exitCode: number | null;
  output: string;
}

type BuildRuntimeModule = (
  input: BuildDoudouOfficialLive2DRendererRuntimeModuleInput
) => Promise<DoudouOfficialLive2DRuntimeModuleBuildResult>;

type RunRuntimeSmoke = (input: RuntimeSmokeRunInput) => Promise<RuntimeSmokeRunResult>;

type PrepareSampleModel = (
  input: PrepareDoudouLive2DSampleModelInput
) => Promise<PrepareDoudouLive2DSampleModelResult>;

type ResolveOfficialRuntime = (input: {
  modelDir: string;
  sdkDir: string;
}) => Promise<DoudouOfficialLive2DRendererRuntimeResolution>;

interface ParsedOfficialSmokeArgs {
  mode: DoudouOfficialLive2DRuntimeModuleBuildMode;
  modelDir?: string;
  outputFile?: string;
  sampleModelName?: string;
  sampleOutputDir?: string;
  sdkDir?: string;
}

export async function runDoudouOfficialLive2DSmoke(
  options: DoudouOfficialLive2DSmokeOptions = {}
): Promise<DoudouOfficialLive2DSmokeResult> {
  const argv = options.argv ?? process.argv;
  const cwd = options.cwd ?? process.cwd();
  const env = options.env ?? process.env;
  const args = parseArgs(argv.slice(2));
  const sdkDir = args.sdkDir ?? env.DOUDOU_CUBISM_WEB_SDK_DIR;
  let modelDir = args.modelDir ?? (args.sampleModelName ? undefined : env.DOUDOU_DEFAULT_DOUDOU_LIVE2D_MODEL_DIR);
  const outputFile = args.outputFile
    ?? env.DOUDOU_CUBISM_WEB_RUNTIME_MODULE
    ?? path.join(cwd, "local_live2d_runtime", "default-doudou-official-runtime.mjs");

  if (!modelDir && args.sampleModelName) {
    if (!sdkDir) {
      return jsonResult(1, {
        ok: false,
        code: "OFFICIAL_LIVE2D_SMOKE_NOT_CONFIGURED",
        missing: requiredMissingEnv({
          modelDir: "prepared_from_official_sample",
          sdkDir
        })
      });
    }
    const sampleOutputDir = args.sampleOutputDir
      ?? path.join(cwd, "local_live2d_models", "default-doudou-sample");
    const prepareSampleModel = options.prepareSampleModel ?? prepareDoudouLive2DSampleModel;
    const sampleModel = await prepareSampleModel({
      outputDir: sampleOutputDir,
      sampleName: args.sampleModelName,
      sdkDir
    });
    if (!sampleModel.ok) {
      return jsonResult(1, {
        ok: false,
        code: "OFFICIAL_LIVE2D_SAMPLE_MODEL_PREP_FAILED",
        reason: sampleModel.reason
      });
    }
    modelDir = sampleOutputDir;
  }

  const missing = requiredMissingEnv({ modelDir, sdkDir });
  if (!sdkDir || !modelDir) {
    return jsonResult(1, {
      ok: false,
      code: "OFFICIAL_LIVE2D_SMOKE_NOT_CONFIGURED",
      missing
    });
  }
  const configuredModelDir = modelDir;
  const configuredSdkDir = sdkDir;

  const resolveOfficialRuntime = options.resolveOfficialRuntime ?? resolveDoudouOfficialLive2DRendererRuntime;
  const preflight = await resolveOfficialRuntime({
    modelDir: configuredModelDir,
    sdkDir: configuredSdkDir
  });
  if (!preflight.available) {
    return jsonResult(1, {
      ok: false,
      code: "OFFICIAL_LIVE2D_PREFLIGHT_FAILED",
      reason: preflight.reason
    });
  }

  const buildRuntimeModule = options.buildRuntimeModule ?? buildDoudouOfficialLive2DRendererRuntimeModule;
  const buildResult = await buildRuntimeModule({
    mode: args.mode,
    outputFile,
    sdkDir: configuredSdkDir
  });
  if (!buildResult.ok) {
    return jsonResult(1, {
      ok: false,
      code: "OFFICIAL_LIVE2D_RUNTIME_MODULE_BUILD_FAILED",
      mode: args.mode,
      reason: buildResult.reason
    });
  }

  const runRuntimeSmoke = options.runRuntimeSmoke ?? runRuntimeSmokeProcess;
  let runtimeSmoke: RuntimeSmokeRunResult;
  try {
    runtimeSmoke = await runRuntimeSmoke({
      cwd,
      env: {
        ...env,
        DOUDOU_CUBISM_WEB_RUNTIME_MODULE: outputFile,
        DOUDOU_CUBISM_WEB_SDK_DIR: configuredSdkDir,
        DOUDOU_DEFAULT_DOUDOU_LIVE2D_MODEL_DIR: configuredModelDir,
        DOUDOU_LIVE2D_RENDERER_SPIKE: "1",
        NODE_OPTIONS: ""
      }
    });
  } catch {
    return jsonResult(1, {
      ok: false,
      code: "OFFICIAL_LIVE2D_RUNTIME_SMOKE_FAILED",
      mode: args.mode,
      runtimeModule: sanitizeBuildResult(buildResult),
      runtimeSmoke: {
        exitCode: null,
        reason: "runtime_smoke_error"
      }
    });
  }
  const officialRenderer = parseDoudouOfficialLive2DRendererSmokeEvidence(runtimeSmoke.output);
  if (runtimeSmoke.exitCode !== 0) {
    return jsonResult(1, {
      ok: false,
      code: "OFFICIAL_LIVE2D_RUNTIME_SMOKE_FAILED",
      mode: args.mode,
      runtimeModule: sanitizeBuildResult(buildResult),
      runtimeSmoke: {
        exitCode: runtimeSmoke.exitCode,
        ...officialRendererOutput(officialRenderer)
      }
    });
  }

  const failedChecks = doudouOfficialLive2DRendererSmokeEvidenceFailures(officialRenderer);
  if (failedChecks.length > 0) {
    return jsonResult(1, {
      ok: false,
      code: "OFFICIAL_LIVE2D_EVIDENCE_INCOMPLETE",
      mode: args.mode,
      runtimeModule: sanitizeBuildResult(buildResult),
      runtimeSmoke: {
        exitCode: 0,
        failedChecks,
        failedCheckSummary: doudouOfficialLive2DRendererSmokeFailureSummary(failedChecks),
        officialRenderer
      }
    });
  }

  return jsonResult(0, {
    ok: true,
    mode: args.mode,
    runtimeModule: sanitizeBuildResult(buildResult),
    runtimeSmoke: {
      exitCode: 0,
      officialRenderer
    }
  });
}

function requiredMissingEnv(options: {
  modelDir?: string;
  sdkDir?: string;
}): string[] {
  const missing: string[] = [];
  if (!options.sdkDir) {
    missing.push("DOUDOU_CUBISM_WEB_SDK_DIR");
  }
  if (!options.modelDir) {
    missing.push("DOUDOU_DEFAULT_DOUDOU_LIVE2D_MODEL_DIR");
  }
  return missing;
}

function sanitizeBuildResult(result: Extract<DoudouOfficialLive2DRuntimeModuleBuildResult, { ok: true }>) {
  return {
    moduleFormat: result.moduleFormat,
    outputFileName: result.outputFileName,
    sdk: result.sdk
  };
}

function officialRendererOutput(
  officialRenderer: ReturnType<typeof parseDoudouOfficialLive2DRendererSmokeEvidence>
): Record<string, unknown> {
  return officialRenderer.fixtureBundle || officialRenderer.generatedBundle
    ? { officialRenderer }
    : {};
}

function parseArgs(args: string[]): ParsedOfficialSmokeArgs {
  const parsed: ParsedOfficialSmokeArgs = {
    mode: "sample"
  };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--sdk-dir") {
      parsed.sdkDir = args[index + 1];
      index += 1;
    } else if (arg === "--model-dir") {
      parsed.modelDir = args[index + 1];
      index += 1;
    } else if (arg === "--out") {
      parsed.outputFile = args[index + 1];
      index += 1;
    } else if (arg === "--sample-model") {
      parsed.sampleModelName = args[index + 1];
      index += 1;
    } else if (arg === "--sample-out" || arg === "--sample-output-dir") {
      parsed.sampleOutputDir = args[index + 1];
      index += 1;
    } else if (arg === "--mode") {
      parsed.mode = args[index + 1] === "framework" ? "framework" : "sample";
      index += 1;
    }
  }
  return parsed;
}

function runRuntimeSmokeProcess(input: RuntimeSmokeRunInput): Promise<RuntimeSmokeRunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(input.cwd, "dist/src/scripts/runtime-smoke.js")], {
      cwd: input.cwd,
      env: input.env,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let output = "";
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error("official Live2D runtime smoke timed out"));
    }, 60000);

    child.stdout.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (exitCode) => {
      clearTimeout(timeout);
      resolve({ exitCode, output });
    });
  });
}

function jsonResult(exitCode: number, payload: Record<string, unknown>): DoudouOfficialLive2DSmokeResult {
  return {
    exitCode,
    output: `${JSON.stringify(payload, null, 2)}\n`
  };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  runDoudouOfficialLive2DSmoke()
    .then((result) => {
      process.stdout.write(result.output);
      process.exitCode = result.exitCode;
    })
    .catch((error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    });
}

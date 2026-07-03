import { spawn } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  resolveDoudouOfficialLive2DRendererRuntime,
  type DoudouOfficialLive2DRendererRuntimeResolution
} from "../runtime/default-doudou-live2d-official-sdk-resolver.js";
import {
  buildDoudouOfficialLive2DRendererRuntimeModule,
  type BuildDoudouOfficialLive2DRendererRuntimeModuleInput,
  type DoudouOfficialLive2DRuntimeModuleBuildMode,
  type DoudouOfficialLive2DRuntimeModuleBuildResult
} from "./build-doudou-live2d-official-runtime-module.js";

export interface DoudouOfficialLive2DSmokeOptions {
  argv?: string[];
  buildRuntimeModule?: BuildRuntimeModule;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
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

type ResolveOfficialRuntime = (input: {
  modelDir: string;
  sdkDir: string;
}) => Promise<DoudouOfficialLive2DRendererRuntimeResolution>;

interface ParsedOfficialSmokeArgs {
  mode: DoudouOfficialLive2DRuntimeModuleBuildMode;
  modelDir?: string;
  outputFile?: string;
  sdkDir?: string;
}

interface SanitizedOfficialRuntimeSmokeEvidence {
  activeEmotionId: string;
  drawCalls: number;
  expressionCount: number;
  expressionSwitches: number;
  frameLoopAdvanced: boolean;
  modelLoaded: boolean;
  rendererAssetProbe: string;
  runtimeModuleProbe: string;
  updateCalls: number;
}

export async function runDoudouOfficialLive2DSmoke(
  options: DoudouOfficialLive2DSmokeOptions = {}
): Promise<DoudouOfficialLive2DSmokeResult> {
  const argv = options.argv ?? process.argv;
  const cwd = options.cwd ?? process.cwd();
  const env = options.env ?? process.env;
  const args = parseArgs(argv.slice(2));
  const sdkDir = args.sdkDir ?? env.DOUDOU_CUBISM_WEB_SDK_DIR;
  const modelDir = args.modelDir ?? env.DOUDOU_DEFAULT_DOUDOU_LIVE2D_MODEL_DIR;
  const outputFile = args.outputFile
    ?? env.DOUDOU_CUBISM_WEB_RUNTIME_MODULE
    ?? path.join(cwd, "local_live2d_runtime", "default-doudou-official-runtime.mjs");

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
  const runtimeSmoke = await runRuntimeSmoke({
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
  if (runtimeSmoke.exitCode !== 0) {
    return jsonResult(1, {
      ok: false,
      code: "OFFICIAL_LIVE2D_RUNTIME_SMOKE_FAILED",
      mode: args.mode,
      runtimeModule: sanitizeBuildResult(buildResult),
      runtimeSmoke: {
        exitCode: runtimeSmoke.exitCode
      }
    });
  }

  const officialRenderer = parseOfficialRendererSmokeEvidence(runtimeSmoke.output);
  const failedChecks = officialRendererEvidenceFailures(officialRenderer);
  if (failedChecks.length > 0) {
    return jsonResult(1, {
      ok: false,
      code: "OFFICIAL_LIVE2D_EVIDENCE_INCOMPLETE",
      mode: args.mode,
      runtimeModule: sanitizeBuildResult(buildResult),
      runtimeSmoke: {
        exitCode: 0,
        failedChecks
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

function parseOfficialRendererSmokeEvidence(output: string): {
  fixtureBundle?: SanitizedOfficialRuntimeSmokeEvidence;
  generatedBundle?: SanitizedOfficialRuntimeSmokeEvidence;
} {
  return {
    fixtureBundle: parseOfficialRendererSmokeLine(output, "runtime smoke fixture bundle: "),
    generatedBundle: parseOfficialRendererSmokeLine(output, "runtime smoke generated bundle: ")
  };
}

function officialRendererEvidenceFailures(evidence: {
  fixtureBundle?: SanitizedOfficialRuntimeSmokeEvidence;
  generatedBundle?: SanitizedOfficialRuntimeSmokeEvidence;
}): string[] {
  return [
    ...officialRendererBundleEvidenceFailures("fixtureBundle", evidence.fixtureBundle),
    ...officialRendererBundleEvidenceFailures("generatedBundle", evidence.generatedBundle)
  ];
}

function officialRendererBundleEvidenceFailures(
  label: "fixtureBundle" | "generatedBundle",
  evidence: SanitizedOfficialRuntimeSmokeEvidence | undefined
): string[] {
  if (!evidence) {
    return [`${label}.missing`];
  }
  const failures: string[] = [];
  if (evidence.rendererAssetProbe !== "model3_fetched") {
    failures.push(`${label}.rendererAssetProbe`);
  }
  if (evidence.runtimeModuleProbe !== "loaded") {
    failures.push(`${label}.runtimeModuleProbe`);
  }
  if (!evidence.modelLoaded) {
    failures.push(`${label}.modelLoaded`);
  }
  if (evidence.expressionCount !== 12) {
    failures.push(`${label}.expressionCount`);
  }
  if (evidence.expressionSwitches <= 0) {
    failures.push(`${label}.expressionSwitches`);
  }
  if (!evidence.frameLoopAdvanced) {
    failures.push(`${label}.frameLoopAdvanced`);
  }
  if (evidence.drawCalls < 2) {
    failures.push(`${label}.drawCalls`);
  }
  if (evidence.updateCalls < 2) {
    failures.push(`${label}.updateCalls`);
  }
  if (evidence.activeEmotionId.length === 0 || evidence.activeEmotionId === "calm_idle") {
    failures.push(`${label}.activeEmotionId`);
  }
  return failures;
}

function parseOfficialRendererSmokeLine(
  output: string,
  prefix: string
): SanitizedOfficialRuntimeSmokeEvidence | undefined {
  const line = output.split(/\r?\n/).find((candidate) => candidate.startsWith(prefix));
  if (!line) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(line.slice(prefix.length)) as unknown;
    return sanitizeOfficialRuntimeSmokeEvidence(parsed);
  } catch {
    return undefined;
  }
}

function sanitizeOfficialRuntimeSmokeEvidence(value: unknown): SanitizedOfficialRuntimeSmokeEvidence | undefined {
  if (!isRecord(value) || !isRecord(value.live2DRendererSpike)) {
    return undefined;
  }
  const officialRuntime = value.live2DRendererSpike.officialRuntime;
  if (!isRecord(officialRuntime) || !isRecord(officialRuntime.runtimeModule)) {
    return undefined;
  }
  const runtimeModule = officialRuntime.runtimeModule;
  if (
    typeof officialRuntime.rendererAssetProbe !== "string" ||
    typeof runtimeModule.activeEmotionId !== "string" ||
    typeof runtimeModule.drawCalls !== "number" ||
    typeof runtimeModule.expressionCount !== "number" ||
    typeof runtimeModule.expressionSwitches !== "number" ||
    typeof runtimeModule.frameLoopAdvanced !== "boolean" ||
    typeof runtimeModule.modelLoaded !== "boolean" ||
    typeof runtimeModule.runtimeModuleProbe !== "string" ||
    typeof runtimeModule.updateCalls !== "number"
  ) {
    return undefined;
  }
  return {
    activeEmotionId: runtimeModule.activeEmotionId,
    drawCalls: runtimeModule.drawCalls,
    expressionCount: runtimeModule.expressionCount,
    expressionSwitches: runtimeModule.expressionSwitches,
    frameLoopAdvanced: runtimeModule.frameLoopAdvanced,
    modelLoaded: runtimeModule.modelLoaded,
    rendererAssetProbe: officialRuntime.rendererAssetProbe,
    runtimeModuleProbe: runtimeModule.runtimeModuleProbe,
    updateCalls: runtimeModule.updateCalls
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
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

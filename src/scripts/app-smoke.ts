import { spawn } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { PNG } from "pngjs";
import type { GuidedAppSmokeResult } from "../app/app-types.js";
import type { GuidedGenerationMode } from "../app/guided-flow.js";

const repoRoot = process.cwd();
const electronBin = path.join(repoRoot, "node_modules/.bin/electron");
const appMain = path.join(repoRoot, "dist/src/app/main.js");

interface SpawnResult {
  code: number | null;
  output: string;
}

export interface GuidedAppSmokeRunOptions {
  generationMode?: GuidedGenerationMode;
  sourceImagePath?: string;
}

async function main(): Promise<void> {
  const smokeResult = await runGuidedAppSmoke({ generationMode: "mock_cloud" });
  console.log(`guided app smoke: ${JSON.stringify(smokeResult)}`);
}

export async function runGuidedAppSmoke(options: GuidedAppSmokeRunOptions = {}): Promise<GuidedAppSmokeResult> {
  const generationMode = options.generationMode ?? "mock_cloud";
  const tempRoot = await mkdtemp(path.join(tmpdir(), "guided-app-smoke-"));
  try {
    const sourceImagePath = await prepareGuidedAppSmokeSource(options, tempRoot);
    const workspaceDir = path.join(tempRoot, "workspace");

    const result = await runAppSmoke(sourceImagePath, workspaceDir, generationMode);
    if (result.code !== 0) {
      throw new Error(`guided app smoke exited ${result.code}\n${result.output}`);
    }
    if (leaksPrivateData(result.output, sourceImagePath, tempRoot)) {
      throw new Error(`guided app smoke leaked local paths\n${result.output}`);
    }
    const smokeResult = parseSmokeResult(result.output);
    if (
      !smokeResult.sourceSelected ||
      !smokeResult.generated ||
      !smokeResult.reviewed ||
      !smokeResult.previewLoaded ||
      !smokeResult.contactSheetLoaded ||
      !smokeResult.developerPreviewed ||
      !smokeResult.developerPreviewContactSheetLoaded ||
      !smokeResult.developerPreviewPreviewsLoaded ||
      smokeResult.generationMode !== generationMode ||
      smokeResult.petId !== "generated_cloud_pet" ||
      !smokeResult.cloudGenerated ||
      !smokeResult.accepted ||
      !smokeResult.launched ||
      !smokeResult.runtimeSmoke?.bundleLoaded ||
      !smokeResult.runtimeSmoke.atlasLoaded ||
      !smokeResult.runtimeSmoke.scaleChanged ||
      !smokeResult.runtimeSmoke.pointerScaleChanged ||
      !smokeResult.runtimeSmoke.wheelScaleChanged ||
      !smokeResult.runtimeSmoke.mouseFollowMoved ||
      !smokeResult.runtimeSmoke.cursorFollowAlphaHitTested ||
      !smokeResult.runtimeSmoke.visualStateApplied ||
      !hasAllRuntimeStates(smokeResult.runtimeSmoke.runtimeStatesObserved) ||
      !hasTapExpressionFrames(smokeResult.runtimeSmoke.tapExpressionFramesObserved) ||
      !hasMotionDirection(smokeResult.runtimeSmoke.motionDirectionsObserved) ||
      smokeResult.runtimeSmoke.maxStopRebound <= 0 ||
      !smokeResult.runtimeSmoke.nonTransparentPixel ||
      !smokeResult.runtimeSmoke.frameHiddenByDefault ||
      !smokeResult.runtimeSmoke.frameVisibleOnResizeEdge ||
      !smokeResult.runtimeSmoke.idleAdvanced ||
      !smokeResult.deletedDraft ||
      !smokeResult.deletedAccepted ||
      smokeResult.finalStatus !== "idle"
    ) {
      throw new Error(`guided app smoke returned incomplete result\n${result.output}`);
    }
    return smokeResult;
  } finally {
    await rm(tempRoot, { force: true, recursive: true });
  }
}

function hasAllRuntimeStates(states: string[]): boolean {
  return ["approaching", "dodging", "poked", "stopped", "waiting", "working"].every((state) => states.includes(state));
}

function hasMotionDirection(directions: string[]): boolean {
  return directions.some((direction) => direction !== "none");
}

function hasTapExpressionFrames(frames: number[]): boolean {
  return [4, 5, 6].every((frame) => frames.includes(frame));
}

export async function prepareGuidedAppSmokeSource(
  options: Pick<GuidedAppSmokeRunOptions, "sourceImagePath">,
  tempRoot: string
): Promise<string> {
  if (options.sourceImagePath) {
    return options.sourceImagePath;
  }
  const sourceImagePath = path.join(tempRoot, "source.png");
  await mkdir(tempRoot, { recursive: true });
  await writeFile(sourceImagePath, createSmokeSourcePng());
  return sourceImagePath;
}

function runAppSmoke(
  sourceImagePath: string,
  workspaceDir: string,
  generationMode: GuidedGenerationMode
): Promise<SpawnResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(electronBin, [
      appMain,
      "--smoke",
      "--generation-mode",
      generationMode,
      "--source",
      sourceImagePath,
      "--workspace",
      workspaceDir
    ], {
      cwd: repoRoot,
      env: createSmokeEnv(generationMode),
      stdio: ["ignore", "pipe", "pipe"]
    });
    let output = "";
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`guided app smoke timed out\n${output}`));
    }, 45000);

    child.stdout.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      clearTimeout(timeout);
      resolve({ code, output });
    });
  });
}

function createSmokeEnv(generationMode: GuidedGenerationMode): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, NODE_OPTIONS: "" };
  if (generationMode === "mock_cloud") {
    env.DOUDOU_MOCK_CLOUD_API_KEY = "secret-test-key";
  }
  return env;
}

function leaksPrivateData(output: string, sourceImagePath: string, tempRoot: string): boolean {
  const sensitiveValues = [sourceImagePath, tempRoot, "secret-test-key", process.env.OPENAI_API_KEY].filter(
    (value): value is string => Boolean(value)
  );
  return sensitiveValues.some((value) => output.includes(value));
}

function parseSmokeResult(output: string): GuidedAppSmokeResult {
  const prefix = "app smoke: ";
  const line = output.split(/\r?\n/).find((candidate) => candidate.startsWith(prefix));
  if (!line) {
    throw new Error(`guided app smoke output did not include a structured result\n${output}`);
  }
  return JSON.parse(line.slice(prefix.length)) as GuidedAppSmokeResult;
}

function createSmokeSourcePng(): Buffer {
  const png = new PNG({ width: 32, height: 32 });
  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      const index = (png.width * y + x) << 2;
      png.data[index] = 72 + (x % 60);
      png.data[index + 1] = 168;
      png.data[index + 2] = 226 - (y % 40);
      png.data[index + 3] = 255;
    }
  }
  return PNG.sync.write(png);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  void main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}

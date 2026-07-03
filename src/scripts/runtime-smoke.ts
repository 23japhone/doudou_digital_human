import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { spawn } from "node:child_process";
import { PNG } from "pngjs";
import { generatePetBundleFromSource } from "../generation/generate-pet.js";
import {
  hasCompleteDoudouOfficialLive2DRendererRuntimeEvidence,
  sanitizeDoudouOfficialLive2DRendererRuntimeSmokeEvidence
} from "../runtime/default-doudou-live2d-official-smoke-evidence.js";

const repoRoot = process.cwd();
const electronBin = path.join(repoRoot, "node_modules/.bin/electron");
const runtimeMain = path.join(repoRoot, "dist/src/runtime/main.js");
const validBundle = path.join(repoRoot, "fixtures/pet_bundles/valid_minimal_atlas_pet");

interface SpawnResult {
  code: number | null;
  output: string;
}

async function main(): Promise<void> {
  const tempRoot = await mkdtemp(path.join(tmpdir(), "runtime-smoke-"));
  try {
    await assertInvalidBundleFails("missing manifest", tempRoot, async (bundleDir) => {
      await mkdir(bundleDir, { recursive: true });
    }, "MISSING_MANIFEST");

    await assertInvalidBundleFails("missing asset", tempRoot, async (bundleDir) => {
      await copyValidBundle(bundleDir);
      await rm(path.join(bundleDir, "atlases/main.png"));
    }, "MISSING_ASSET");

    await assertInvalidBundleFails("unsupported schema", tempRoot, async (bundleDir) => {
      await copyValidBundle(bundleDir);
      const manifestPath = path.join(bundleDir, "pet.json");
      const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Record<string, unknown>;
      manifest.schemaVersion = "1.0.0";
      await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    }, "UNSUPPORTED_SCHEMA_VERSION");

    await assertValidRuntimeLoads("fixture bundle", validBundle);

    const generatedSource = path.join(tempRoot, "source.png");
    const generatedBundle = path.join(tempRoot, "generated-bundle");
    await writeFile(generatedSource, createSmokeSourcePng());
    await generatePetBundleFromSource({
      sourceImagePath: generatedSource,
      outputBundleDir: generatedBundle,
      now: new Date("2026-06-30T12:00:00.000Z")
    });
    await assertValidRuntimeLoads("generated bundle", generatedBundle);
  } finally {
    await rm(tempRoot, { force: true, recursive: true });
  }
}

async function assertValidRuntimeLoads(label: string, bundleDir: string): Promise<void> {
  const validResult = await runRuntime(bundleDir);
  if (validResult.code !== 0) {
    throw new Error(`${label} runtime smoke exited ${validResult.code}\n${validResult.output}`);
  }
  const smokeResult = parseSmokeResult(validResult.output);
  if (
    !smokeResult.bundleLoaded ||
    !smokeResult.atlasLoaded ||
    !smokeResult.dragMoved ||
    !smokeResult.scaleChanged ||
    !smokeResult.pointerScaleChanged ||
    !smokeResult.wheelScaleChanged ||
    smokeResult.passiveCursorMovedWindow ||
    !smokeResult.cursorFollowAlphaHitTested ||
    !hasAllEmotionMotionPhases(smokeResult.emotionMotionPhasesObserved) ||
    !hasAllDefaultDoudouEmotionScenarios(smokeResult.defaultDoudouEmotionScenariosObserved) ||
    !hasAllDefaultDoudouEmotionIds(smokeResult.defaultDoudouEmotionIdsObserved) ||
    !smokeResult.motionTuningApplied ||
    !smokeResult.motionTuningPanelVisible ||
    !smokeResult.motionTuningPresetButtonVisible ||
    !smokeResult.motionTuningPresetSaved ||
    !smokeResult.motionTuningPresetApplied ||
    !smokeResult.motionTuningPresetNames.includes("烟测节奏") ||
    !smokeResult.motionTuningPresetCopied ||
    !hasSmokeMotionTuningPreset(smokeResult.motionTuningPresetText) ||
    !hasSmokeMotionTuning(smokeResult.motionTuningSnapshot) ||
    smokeResult.maxEmotionWariness <= 0.5 ||
    !smokeResult.visualStateApplied ||
    !hasAllRuntimeStates(smokeResult.runtimeStatesObserved) ||
    !hasTapExpressionFrames(smokeResult.tapExpressionFramesObserved) ||
    !hasMotionDirection(smokeResult.motionDirectionsObserved) ||
    smokeResult.maxStopRebound <= 0 ||
    !smokeResult.nonTransparentPixel ||
    !smokeResult.idleAdvanced ||
    !smokeResult.frameHiddenByDefault ||
    !smokeResult.frameVisibleOnResizeEdge ||
    !hasLive2DRendererSpike(smokeResult.live2DRendererSpike) ||
    !smokeResult.renderLoopAdvanced ||
    smokeResult.scale <= 1 ||
    smokeResult.drawCount < 2
  ) {
    throw new Error(`${label} runtime smoke returned incomplete result\n${validResult.output}`);
  }
  console.log(`runtime smoke ${label}: ${JSON.stringify(smokeResult)}`);
}

function hasAllRuntimeStates(states: string[]): boolean {
  return ["approaching", "dodging", "poked", "retreating", "stopped", "waiting", "watching", "working"].every((state) =>
    states.includes(state)
  );
}

function hasAllEmotionMotionPhases(phases: string[]): boolean {
  return ["retreating", "watching", "recovering"].every((phase) => phases.includes(phase));
}

function hasAllDefaultDoudouEmotionScenarios(scenarios: string[]): boolean {
  if (!Array.isArray(scenarios)) {
    return false;
  }
  return ["idle", "tap", "repeat_poke_retreat", "repeat_poke_watch", "quiet_recovery", "working"].every((scenario) =>
    scenarios.includes(scenario)
  );
}

function hasAllDefaultDoudouEmotionIds(emotions: string[]): boolean {
  if (!Array.isArray(emotions)) {
    return false;
  }
  return ["calm_idle", "surprised", "annoyed_pout", "teary", "comfort_soft", "focused_working"].every((emotion) =>
    emotions.includes(emotion)
  );
}

function hasSmokeMotionTuning(tuning: { recoverySpeedPixelsPerSecond: number; retreatDistancePixels: number; watchingPauseMs: number }): boolean {
  return (
    tuning.recoverySpeedPixelsPerSecond === 240 &&
    tuning.retreatDistancePixels === 260 &&
    tuning.watchingPauseMs === 560
  );
}

function hasSmokeMotionTuningPreset(text: string): boolean {
  return text === "DOUDOU_RUNTIME_TUNING=1 DOUDOU_RUNTIME_RETREAT_DISTANCE=260 DOUDOU_RUNTIME_WATCH_MS=560 DOUDOU_RUNTIME_RECOVERY_SPEED=240 npm run dev";
}

function hasMotionDirection(directions: string[]): boolean {
  return directions.some((direction) => direction !== "none");
}

function hasTapExpressionFrames(frames: number[]): boolean {
  return [4, 5, 6].every((frame) => frames.includes(frame));
}

function hasLive2DRendererSpike(spike: {
  activeEmotionId: string;
  drawModelCalls: number;
  enabled: boolean;
  expressionCount: number;
  expressionOverlayApplied: boolean;
  expressionSwitches: number;
  frameLoopAdvanced: boolean;
  modelId: string;
  modelLoaded: boolean;
  modelUpdateCalls: number;
  officialRuntime: {
    available: boolean;
    canvasLayerVisible: boolean;
    canvasNonTransparentPixel: boolean;
    configured: boolean;
    reason?: string;
    rendererAssetProbe: string;
    runtimeModule: {
      activeEmotionId: string;
      drawCalls: number;
      expressionAppliedAfterFrame: boolean;
      expressionCount: number;
      expressionEmotionIdsObserved: string[];
      expressionSwitches: number;
      frameLoopAdvanced: boolean;
      modelLoaded: boolean;
      pendingExpressionSwitches: number;
      runtimeLifecycle: {
        drawCalls: number;
        modelUpdateCalls: number;
        updateMotionCalls: number;
      };
      runtimeModuleProbe: string;
      updateCalls: number;
    };
  };
  sdkCallsObserved: string[];
  updateMotionCalls: number;
} | null): boolean {
  if (!spike) {
    return false;
  }
  return (
    spike.enabled &&
    spike.modelId === "default-doudou" &&
    spike.modelLoaded &&
    spike.expressionCount === 12 &&
    spike.expressionSwitches > 0 &&
    spike.expressionOverlayApplied &&
    spike.frameLoopAdvanced &&
    spike.updateMotionCalls >= 2 &&
    spike.modelUpdateCalls >= 2 &&
    spike.drawModelCalls >= 2 &&
    spike.activeEmotionId !== "calm_idle" &&
    hasOfficialLive2DRendererRuntimeEvidence(spike.officialRuntime) &&
    spike.sdkCallsObserved.some((call) => call.startsWith("CubismExpressionMotion.create")) &&
    spike.sdkCallsObserved.some((call) => call.startsWith("CubismMotionManager.startMotionPriority")) &&
    spike.sdkCallsObserved.some((call) => call.startsWith("CubismMotionManager.updateMotion")) &&
    spike.sdkCallsObserved.includes("CubismModel.update") &&
    spike.sdkCallsObserved.includes("CubismRenderer.drawModel")
  );
}

function hasOfficialLive2DRendererRuntimeEvidence(officialRuntime: {
  available: boolean;
  configured: boolean;
  reason?: string;
  rendererAssetProbe: string;
  runtimeModule: {
    drawCalls: number;
    expressionAppliedAfterFrame: boolean;
    frameLoopAdvanced: boolean;
    modelLoaded: boolean;
    expressionEmotionIdsObserved: string[];
    pendingExpressionSwitches: number;
    runtimeLifecycle: {
      drawCalls: number;
      modelUpdateCalls: number;
      updateMotionCalls: number;
    };
    runtimeModuleProbe: string;
    updateCalls: number;
  };
}): boolean {
  if (!officialRuntime.configured) {
    return (
      officialRuntime.reason === "not_configured" &&
      officialRuntime.rendererAssetProbe === "not_configured" &&
      officialRuntime.runtimeModule.runtimeModuleProbe === "not_configured"
    );
  }
  if (officialRuntime.runtimeModule.runtimeModuleProbe === "not_configured") {
    return officialRuntime.available && officialRuntime.rendererAssetProbe === "model3_fetched";
  }
  return (
    officialRuntime.available &&
    hasCompleteDoudouOfficialLive2DRendererRuntimeEvidence(
      sanitizeDoudouOfficialLive2DRendererRuntimeSmokeEvidence({
        live2DRendererSpike: {
          officialRuntime
        }
      })
    )
  );
}

async function assertInvalidBundleFails(
  label: string,
  tempRoot: string,
  setup: (bundleDir: string) => Promise<void>,
  expectedCode: string
): Promise<void> {
  const bundleDir = path.join(tempRoot, label.replaceAll(" ", "-"));
  await setup(bundleDir);
  const result = await runRuntime(bundleDir);
  if (result.code === 0 || !result.output.includes(expectedCode)) {
    throw new Error(`expected ${label} to fail with ${expectedCode}, got ${result.code}\n${result.output}`);
  }
  console.log(`runtime smoke negative: ${label} failed with ${expectedCode}`);
}

async function copyValidBundle(targetDir: string): Promise<void> {
  await mkdir(targetDir, { recursive: true });
  await mkdir(path.join(targetDir, "atlases"), { recursive: true });
  await writeFile(path.join(targetDir, "pet.json"), await readFile(path.join(validBundle, "pet.json")));
  await writeFile(path.join(targetDir, "preview.png"), await readFile(path.join(validBundle, "preview.png")));
  await writeFile(path.join(targetDir, "source.meta.json"), await readFile(path.join(validBundle, "source.meta.json")));
  await writeFile(path.join(targetDir, "atlases/main.png"), await readFile(path.join(validBundle, "atlases/main.png")));
}

function createSmokeSourcePng(): Buffer {
  const png = new PNG({ width: 32, height: 32 });
  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      const index = (png.width * y + x) << 2;
      png.data[index] = 70;
      png.data[index + 1] = 160;
      png.data[index + 2] = 220;
      png.data[index + 3] = 255;
    }
  }
  return PNG.sync.write(png);
}

function runRuntime(bundleDir: string): Promise<SpawnResult> {
  return new Promise((resolve, reject) => {
    const runtimeUserDataDir = path.join(tmpdir(), `runtime-smoke-user-data-${process.pid}-${Date.now()}`);
    const child = spawn(electronBin, [
      runtimeMain,
      "--bundle",
      bundleDir,
      "--smoke",
      "--tuning",
      "--live2d-renderer-spike"
    ], {
      cwd: repoRoot,
      env: { ...process.env, DOUDOU_RUNTIME_USER_DATA_DIR: runtimeUserDataDir, NODE_OPTIONS: "" },
      stdio: ["ignore", "pipe", "pipe"]
    });
    let output = "";
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`runtime smoke timed out\n${output}`));
    }, 15000);

    child.stdout.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      clearTimeout(timeout);
      void rm(runtimeUserDataDir, { force: true, recursive: true });
      resolve({ code, output });
    });
  });
}

function parseSmokeResult(output: string) {
  const prefix = "runtime smoke: ";
  const line = output.split(/\r?\n/).find((candidate) => candidate.startsWith(prefix));
  if (!line) {
    throw new Error(`runtime smoke output did not include a structured result\n${output}`);
  }
  return JSON.parse(line.slice(prefix.length)) as {
    atlasLoaded: boolean;
    bundleLoaded: boolean;
    dragMoved: boolean;
    idleAdvanced: boolean;
    nonTransparentPixel: boolean;
    renderLoopAdvanced: boolean;
    scale: number;
    scaleChanged: boolean;
    pointerScaleChanged: boolean;
    wheelScaleChanged: boolean;
    passiveCursorMovedWindow: boolean;
    cursorFollowAlphaHitTested: boolean;
    emotionMotionPhasesObserved: string[];
    defaultDoudouEmotionIdsObserved: string[];
    defaultDoudouEmotionScenariosObserved: string[];
    motionTuningApplied: boolean;
    motionTuningPanelVisible: boolean;
    motionTuningPresetButtonVisible: boolean;
    motionTuningPresetApplied: boolean;
    motionTuningPresetCopied: boolean;
    motionTuningPresetNames: string[];
    motionTuningPresetSaved: boolean;
    motionTuningPresetText: string;
    motionTuningSnapshot: {
      recoverySpeedPixelsPerSecond: number;
      retreatDistancePixels: number;
      watchingPauseMs: number;
    };
    maxEmotionWariness: number;
    runtimeStatesObserved: string[];
    visualStateApplied: boolean;
    motionDirectionsObserved: string[];
    maxStopRebound: number;
    tapExpressionFramesObserved: number[];
    drawCount: number;
    initialFrameIndex: number;
    currentFrameIndex: number;
    frameHiddenByDefault: boolean;
    frameVisibleOnResizeEdge: boolean;
    live2DRendererSpike: {
      activeEmotionId: string;
      drawModelCalls: number;
      enabled: boolean;
      expressionCount: number;
      expressionOverlayApplied: boolean;
      expressionSwitches: number;
      frameLoopAdvanced: boolean;
      modelId: string;
      modelLoaded: boolean;
      modelUpdateCalls: number;
      officialRuntime: {
        available: boolean;
        configured: boolean;
        reason?: string;
        canvasLayerVisible: boolean;
        canvasNonTransparentPixel: boolean;
        rendererAssetProbe: string;
        runtimeModule: {
          activeEmotionId: string;
          drawCalls: number;
          expressionAppliedAfterFrame: boolean;
          expressionCount: number;
          expressionEmotionIdsObserved: string[];
          expressionSwitches: number;
          frameLoopAdvanced: boolean;
          modelLoaded: boolean;
          pendingExpressionSwitches: number;
          runtimeLifecycle: {
            drawCalls: number;
            modelUpdateCalls: number;
            updateMotionCalls: number;
          };
          runtimeModuleProbe: string;
          updateCalls: number;
        };
      };
      sdkCallsObserved: string[];
      updateMotionCalls: number;
    } | null;
  };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  void main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}

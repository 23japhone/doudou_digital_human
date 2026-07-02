import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { spawn } from "node:child_process";
import { PNG } from "pngjs";
import { generatePetBundleFromSource } from "../generation/generate-pet.js";

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
    !smokeResult.mouseFollowMoved ||
    !smokeResult.nonTransparentPixel ||
    !smokeResult.idleAdvanced ||
    !smokeResult.frameHiddenByDefault ||
    !smokeResult.frameVisibleOnResizeEdge ||
    !smokeResult.renderLoopAdvanced ||
    smokeResult.scale <= 1 ||
    smokeResult.drawCount < 2 ||
    smokeResult.currentFrameIndex === smokeResult.initialFrameIndex
  ) {
    throw new Error(`${label} runtime smoke returned incomplete result\n${validResult.output}`);
  }
  console.log(`runtime smoke ${label}: ${JSON.stringify(smokeResult)}`);
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
    const child = spawn(electronBin, [runtimeMain, "--bundle", bundleDir, "--smoke"], {
      cwd: repoRoot,
      env: { ...process.env, NODE_OPTIONS: "" },
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
    mouseFollowMoved: boolean;
    drawCount: number;
    initialFrameIndex: number;
    currentFrameIndex: number;
    frameHiddenByDefault: boolean;
    frameVisibleOnResizeEdge: boolean;
  };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  void main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}

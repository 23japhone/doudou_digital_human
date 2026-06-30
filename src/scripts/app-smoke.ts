import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { PNG } from "pngjs";
import type { GuidedAppSmokeResult } from "../app/app-types.js";

const repoRoot = process.cwd();
const electronBin = path.join(repoRoot, "node_modules/.bin/electron");
const appMain = path.join(repoRoot, "dist/src/app/main.js");

interface SpawnResult {
  code: number | null;
  output: string;
}

async function main(): Promise<void> {
  const tempRoot = await mkdtemp(path.join(tmpdir(), "guided-app-smoke-"));
  try {
    const sourceImagePath = path.join(tempRoot, "source.png");
    const workspaceDir = path.join(tempRoot, "workspace");
    await writeFile(sourceImagePath, createSmokeSourcePng());

    const result = await runAppSmoke(sourceImagePath, workspaceDir);
    if (result.code !== 0) {
      throw new Error(`guided app smoke exited ${result.code}\n${result.output}`);
    }
    if (
      result.output.includes(sourceImagePath) ||
      result.output.includes(tempRoot) ||
      result.output.includes("secret-test-key")
    ) {
      throw new Error(`guided app smoke leaked local paths\n${result.output}`);
    }
    const smokeResult = parseSmokeResult(result.output);
    if (
      !smokeResult.sourceSelected ||
      !smokeResult.generated ||
      !smokeResult.reviewed ||
      !smokeResult.previewLoaded ||
      !smokeResult.contactSheetLoaded ||
      smokeResult.generationMode !== "mock_cloud" ||
      smokeResult.petId !== "generated_cloud_pet" ||
      !smokeResult.cloudGenerated ||
      !smokeResult.accepted ||
      !smokeResult.launched ||
      !smokeResult.runtimeSmoke?.bundleLoaded ||
      !smokeResult.runtimeSmoke.atlasLoaded ||
      !smokeResult.runtimeSmoke.nonTransparentPixel ||
      !smokeResult.runtimeSmoke.idleAdvanced ||
      !smokeResult.deletedDraft ||
      !smokeResult.deletedAccepted ||
      smokeResult.finalStatus !== "source_selected"
    ) {
      throw new Error(`guided app smoke returned incomplete result\n${result.output}`);
    }
    console.log(`guided app smoke: ${JSON.stringify(smokeResult)}`);
  } finally {
    await rm(tempRoot, { force: true, recursive: true });
  }
}

function runAppSmoke(sourceImagePath: string, workspaceDir: string): Promise<SpawnResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(electronBin, [
      appMain,
      "--smoke",
      "--source",
      sourceImagePath,
      "--workspace",
      workspaceDir
    ], {
      cwd: repoRoot,
      env: { ...process.env, NODE_OPTIONS: "", DOUDOU_MOCK_CLOUD_API_KEY: "secret-test-key" },
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

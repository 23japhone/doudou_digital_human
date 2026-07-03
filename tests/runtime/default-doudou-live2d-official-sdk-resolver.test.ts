import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import {
  resolveDoudouOfficialLive2DRendererRuntime,
  type DoudouOfficialLive2DRendererRuntimeEvidence
} from "../../src/runtime/default-doudou-live2d-official-sdk-resolver.js";

describe("default doudou official Live2D Web SDK renderer resolver", () => {
  test("reports a sanitized skip when no local SDK or model paths are configured", async () => {
    const result = await resolveDoudouOfficialLive2DRendererRuntime({});

    expect(result).toEqual({
      available: false,
      configured: false,
      publicEvidence: {
        available: false,
        configured: false,
        reason: "not_configured"
      },
      reason: "not_configured"
    });
  });

  test("detects a local official SDK layout and default doudou model without leaking absolute paths", async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "doudou-cubism-sdk-"));
    try {
      const sdkDir = path.join(tempRoot, "CubismSdkForWeb");
      const modelDir = path.join(tempRoot, "default-doudou-model");
      const runtimeModuleFile = path.join(tempRoot, "default-doudou-official-runtime.mjs");
      await writeLocalOfficialSdkFixture(sdkDir);
      await writeDefaultDoudouModelFixture(modelDir);
      await writeFile(runtimeModuleFile, "export function createDoudouOfficialLive2DRendererRuntime() {}\n", "utf8");

      const result = await resolveDoudouOfficialLive2DRendererRuntime({ modelDir, runtimeModuleFile, sdkDir });

      expect(result.available).toBe(true);
      expect(result.configured).toBe(true);
      expect(result.publicEvidence).toEqual({
        available: true,
        configured: true,
        model: {
          expressionCount: 1,
          moc: "default-doudou.moc3",
          model3Json: "default-doudou.model3.json",
          motionGroupCount: 1,
          textureCount: 1
        },
        sdk: {
          coreScript: "Core/live2dcubismcore.js",
          frameworkSource: "Framework/src",
          sampleLAppModel: "Samples/TypeScript/Demo/src/lappmodel.ts"
        },
        runtimeModule: {
          configured: true,
          moduleFormat: "external_es_module"
        }
      } satisfies DoudouOfficialLive2DRendererRuntimeEvidence);
      expect(result.rendererAssets).toMatchObject({
        coreScriptUrl: expect.stringMatching(/^file:/),
        model3JsonUrl: expect.stringMatching(/^file:/),
        modelRootUrl: expect.stringMatching(/^file:.*\/$/),
        runtimeModuleUrl: expect.stringMatching(/^file:.*default-doudou-official-runtime\.mjs$/)
      });
      expect(JSON.stringify(result.publicEvidence)).not.toContain(tempRoot);
      expect(JSON.stringify(result.publicEvidence)).not.toContain("sourceImagePath");
      expect(JSON.stringify(result.publicEvidence)).not.toContain("rawPrompt");
    } finally {
      await rm(tempRoot, { force: true, recursive: true });
    }
  });

  test("rejects a configured SDK Core script path that resolves to a directory", async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "doudou-cubism-sdk-directory-core-"));
    try {
      const sdkDir = path.join(tempRoot, "CubismSdkForWeb");
      const modelDir = path.join(tempRoot, "default-doudou-model");
      const coreScriptPath = path.join(sdkDir, "Core/live2dcubismcore.js");
      await writeLocalOfficialSdkFixture(sdkDir);
      await writeDefaultDoudouModelFixture(modelDir);
      await rm(coreScriptPath, { force: true, recursive: true });
      await mkdir(coreScriptPath, { recursive: true });

      const result = await resolveDoudouOfficialLive2DRendererRuntime({ modelDir, sdkDir });

      expect(result).toMatchObject({
        available: false,
        configured: true,
        publicEvidence: {
          available: false,
          configured: true,
          reason: "sdk_core_missing"
        },
        reason: "sdk_core_missing"
      });
      expect(JSON.stringify(result.publicEvidence)).not.toContain(tempRoot);
    } finally {
      await rm(tempRoot, { force: true, recursive: true });
    }
  });

  test("rejects model3.json references that escape the local model directory", async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "doudou-cubism-sdk-bad-model-"));
    try {
      const sdkDir = path.join(tempRoot, "CubismSdkForWeb");
      const modelDir = path.join(tempRoot, "default-doudou-model");
      await writeLocalOfficialSdkFixture(sdkDir);
      await mkdir(modelDir, { recursive: true });
      await writeFile(
        path.join(modelDir, "default-doudou.model3.json"),
        JSON.stringify({
          Version: 3,
          FileReferences: {
            Moc: "default-doudou.moc3",
            Textures: ["../secret.png"],
            Expressions: [],
            Motions: {}
          }
        }),
        "utf8"
      );

      const result = await resolveDoudouOfficialLive2DRendererRuntime({ modelDir, sdkDir });

      expect(result).toMatchObject({
        available: false,
        configured: true,
        publicEvidence: {
          available: false,
          configured: true,
          reason: "unsafe_model_reference"
        },
        reason: "unsafe_model_reference"
      });
      expect(JSON.stringify(result.publicEvidence)).not.toContain(tempRoot);
    } finally {
      await rm(tempRoot, { force: true, recursive: true });
    }
  });

  test("rejects model3.json references that resolve to directories instead of files", async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "doudou-cubism-sdk-directory-asset-"));
    try {
      const sdkDir = path.join(tempRoot, "CubismSdkForWeb");
      const modelDir = path.join(tempRoot, "default-doudou-model");
      await writeLocalOfficialSdkFixture(sdkDir);
      await writeDefaultDoudouModelFixture(modelDir);
      await rm(path.join(modelDir, "textures/default-doudou.png"), { force: true });
      await mkdir(path.join(modelDir, "textures/default-doudou.png"), { recursive: true });

      const result = await resolveDoudouOfficialLive2DRendererRuntime({ modelDir, sdkDir });

      expect(result).toMatchObject({
        available: false,
        configured: true,
        publicEvidence: {
          available: false,
          configured: true,
          reason: "model_asset_missing"
        },
        reason: "model_asset_missing"
      });
      expect(JSON.stringify(result.publicEvidence)).not.toContain(tempRoot);
    } finally {
      await rm(tempRoot, { force: true, recursive: true });
    }
  });

  test("rejects a configured runtime module path that is missing", async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "doudou-cubism-sdk-missing-runtime-"));
    try {
      const sdkDir = path.join(tempRoot, "CubismSdkForWeb");
      const modelDir = path.join(tempRoot, "default-doudou-model");
      await writeLocalOfficialSdkFixture(sdkDir);
      await writeDefaultDoudouModelFixture(modelDir);

      const result = await resolveDoudouOfficialLive2DRendererRuntime({
        modelDir,
        runtimeModuleFile: path.join(tempRoot, "missing-runtime.mjs"),
        sdkDir
      });

      expect(result).toMatchObject({
        available: false,
        configured: true,
        publicEvidence: {
          available: false,
          configured: true,
          reason: "runtime_module_missing"
        },
        reason: "runtime_module_missing"
      });
      expect(JSON.stringify(result.publicEvidence)).not.toContain(tempRoot);
    } finally {
      await rm(tempRoot, { force: true, recursive: true });
    }
  });

  test("rejects a configured runtime module path that resolves to a directory", async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "doudou-cubism-sdk-directory-runtime-"));
    try {
      const sdkDir = path.join(tempRoot, "CubismSdkForWeb");
      const modelDir = path.join(tempRoot, "default-doudou-model");
      const runtimeModuleFile = path.join(tempRoot, "default-doudou-official-runtime.mjs");
      await writeLocalOfficialSdkFixture(sdkDir);
      await writeDefaultDoudouModelFixture(modelDir);
      await mkdir(runtimeModuleFile, { recursive: true });

      const result = await resolveDoudouOfficialLive2DRendererRuntime({ modelDir, runtimeModuleFile, sdkDir });

      expect(result).toMatchObject({
        available: false,
        configured: true,
        publicEvidence: {
          available: false,
          configured: true,
          reason: "runtime_module_missing"
        },
        reason: "runtime_module_missing"
      });
      expect(JSON.stringify(result.publicEvidence)).not.toContain(tempRoot);
    } finally {
      await rm(tempRoot, { force: true, recursive: true });
    }
  });

  test("rejects a configured SDK missing official sample support files", async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "doudou-cubism-sdk-missing-sample-"));
    try {
      const sdkDir = path.join(tempRoot, "CubismSdkForWeb");
      const modelDir = path.join(tempRoot, "default-doudou-model");
      await writeLocalOfficialSdkFixture(sdkDir, { sampleSupportFiles: false });
      await writeDefaultDoudouModelFixture(modelDir);

      const result = await resolveDoudouOfficialLive2DRendererRuntime({ modelDir, sdkDir });

      expect(result).toMatchObject({
        available: false,
        configured: true,
        publicEvidence: {
          available: false,
          configured: true,
          reason: "sdk_sample_runtime_missing"
        },
        reason: "sdk_sample_runtime_missing"
      });
      expect(JSON.stringify(result.publicEvidence)).not.toContain(tempRoot);
    } finally {
      await rm(tempRoot, { force: true, recursive: true });
    }
  });

  test("rejects a configured SDK sample support file path that resolves to a directory", async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "doudou-cubism-sdk-directory-sample-"));
    try {
      const sdkDir = path.join(tempRoot, "CubismSdkForWeb");
      const modelDir = path.join(tempRoot, "default-doudou-model");
      const sampleSourceFile = path.join(sdkDir, "Samples/TypeScript/Demo/src/lappview.ts");
      await writeLocalOfficialSdkFixture(sdkDir);
      await writeDefaultDoudouModelFixture(modelDir);
      await rm(sampleSourceFile, { force: true, recursive: true });
      await mkdir(sampleSourceFile, { recursive: true });

      const result = await resolveDoudouOfficialLive2DRendererRuntime({ modelDir, sdkDir });

      expect(result).toMatchObject({
        available: false,
        configured: true,
        publicEvidence: {
          available: false,
          configured: true,
          reason: "sdk_sample_runtime_missing"
        },
        reason: "sdk_sample_runtime_missing"
      });
      expect(JSON.stringify(result.publicEvidence)).not.toContain(tempRoot);
    } finally {
      await rm(tempRoot, { force: true, recursive: true });
    }
  });

  test("rejects a configured SDK missing official sample Framework dependencies", async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "doudou-cubism-sdk-missing-framework-"));
    try {
      const sdkDir = path.join(tempRoot, "CubismSdkForWeb");
      const modelDir = path.join(tempRoot, "default-doudou-model");
      await writeLocalOfficialSdkFixture(sdkDir, { sampleFrameworkFiles: false });
      await writeDefaultDoudouModelFixture(modelDir);

      const result = await resolveDoudouOfficialLive2DRendererRuntime({ modelDir, sdkDir });

      expect(result).toMatchObject({
        available: false,
        configured: true,
        publicEvidence: {
          available: false,
          configured: true,
          reason: "sdk_framework_missing"
        },
        reason: "sdk_framework_missing"
      });
      expect(JSON.stringify(result.publicEvidence)).not.toContain(tempRoot);
    } finally {
      await rm(tempRoot, { force: true, recursive: true });
    }
  });

  test("rejects a configured SDK Framework dependency file path that resolves to a directory", async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "doudou-cubism-sdk-directory-framework-"));
    try {
      const sdkDir = path.join(tempRoot, "CubismSdkForWeb");
      const modelDir = path.join(tempRoot, "default-doudou-model");
      const frameworkSourceFile = path.join(sdkDir, "Framework/src/motion/cubismmotion.ts");
      await writeLocalOfficialSdkFixture(sdkDir);
      await writeDefaultDoudouModelFixture(modelDir);
      await rm(frameworkSourceFile, { force: true, recursive: true });
      await mkdir(frameworkSourceFile, { recursive: true });

      const result = await resolveDoudouOfficialLive2DRendererRuntime({ modelDir, sdkDir });

      expect(result).toMatchObject({
        available: false,
        configured: true,
        publicEvidence: {
          available: false,
          configured: true,
          reason: "sdk_framework_missing"
        },
        reason: "sdk_framework_missing"
      });
      expect(JSON.stringify(result.publicEvidence)).not.toContain(tempRoot);
    } finally {
      await rm(tempRoot, { force: true, recursive: true });
    }
  });
});

async function writeLocalOfficialSdkFixture(
  sdkDir: string,
  options: { sampleFrameworkFiles?: boolean; sampleSupportFiles?: boolean } = {}
): Promise<void> {
  await mkdir(path.join(sdkDir, "Core"), { recursive: true });
  await mkdir(path.join(sdkDir, "Framework/src"), { recursive: true });
  await mkdir(path.join(sdkDir, "Samples/TypeScript/Demo/src"), { recursive: true });
  await writeFile(path.join(sdkDir, "Core/live2dcubismcore.js"), "window.Live2DCubismCore = {};\n", "utf8");
  await writeFile(path.join(sdkDir, "Framework/src/live2dcubismframework.ts"), "export {};\n", "utf8");
  if (options.sampleFrameworkFiles ?? true) {
    await writeLocalOfficialSampleFrameworkFiles(sdkDir);
  }
  await writeFile(path.join(sdkDir, "Samples/TypeScript/Demo/src/lappmodel.ts"), "export class LAppModel {}\n", "utf8");
  await writeFile(path.join(sdkDir, "Samples/TypeScript/Demo/src/lapppal.ts"), "export class LAppPal {}\n", "utf8");
  if (options.sampleSupportFiles ?? true) {
    await writeLocalOfficialSampleSupportFiles(sdkDir);
  }
}

async function writeLocalOfficialSampleFrameworkFiles(sdkDir: string): Promise<void> {
  const sampleFrameworkFiles = [
    "cubismdefaultparameterid.ts",
    "cubismmodelsettingjson.ts",
    "effect/cubismbreath.ts",
    "effect/cubismeyeblink.ts",
    "effect/cubismlook.ts",
    "icubismmodelsetting.ts",
    "id/cubismid.ts",
    "math/cubismmatrix44.ts",
    "math/cubismviewmatrix.ts",
    "model/cubismmoc.ts",
    "model/cubismusermodel.ts",
    "motion/acubismmotion.ts",
    "motion/cubismbreathupdater.ts",
    "motion/cubismeyeblinkupdater.ts",
    "motion/cubismexpressionupdater.ts",
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

async function writeLocalOfficialSampleSupportFiles(sdkDir: string): Promise<void> {
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

async function writeDefaultDoudouModelFixture(modelDir: string): Promise<void> {
  await mkdir(path.join(modelDir, "textures"), { recursive: true });
  await mkdir(path.join(modelDir, "expressions"), { recursive: true });
  await mkdir(path.join(modelDir, "motions"), { recursive: true });
  await writeFile(path.join(modelDir, "default-doudou.moc3"), "moc3", "utf8");
  await writeFile(path.join(modelDir, "textures/default-doudou.png"), "png", "utf8");
  await writeFile(path.join(modelDir, "expressions/doudou_delighted.exp3.json"), "{}", "utf8");
  await writeFile(path.join(modelDir, "motions/idle.motion3.json"), "{}", "utf8");
  await writeFile(
    path.join(modelDir, "default-doudou.model3.json"),
    JSON.stringify({
      Version: 3,
      FileReferences: {
        Moc: "default-doudou.moc3",
        Textures: ["textures/default-doudou.png"],
        Expressions: [{ Name: "delighted", File: "expressions/doudou_delighted.exp3.json" }],
        Motions: {
          Idle: [{ File: "motions/idle.motion3.json" }]
        }
      }
    }),
    "utf8"
  );
}

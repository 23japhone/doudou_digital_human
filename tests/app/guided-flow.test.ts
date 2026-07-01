import { mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";
import { afterEach, describe, expect, test } from "vitest";
import { GuidedPetFlow } from "../../src/app/guided-flow.js";
import { validatePetBundle } from "../../src/pet_bundle/validate.js";

const tempDirs: string[] = [];
const fixedNow = new Date("2026-06-30T12:00:00.000Z");

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { force: true, recursive: true })));
});

describe("GuidedPetFlow", () => {
  test("runs local generate, QA, accept, and deletion without exposing the source path in public state", async () => {
    const workspace = await createTempDir();
    const sourcePath = path.join(workspace, "source.png");
    await writeFile(sourcePath, createPngSource());
    const flow = new GuidedPetFlow({
      workspaceDir: path.join(workspace, "app-data"),
      now: fixedNow
    });
    await flow.initialize();

    const selected = await flow.setSourceImagePath(sourcePath);
    expect(selected.sourceImageName).toBe("source.png");
    expect(JSON.stringify(flow.getPublicState())).not.toContain(sourcePath);

    const generated = await flow.generatePet();
    await expect(validatePetBundle(generated.bundleDir)).resolves.toMatchObject({
      manifest: expect.objectContaining({ id: "generated_local_pet" })
    });
    expect(JSON.stringify(flow.getPublicState())).not.toContain(sourcePath);

    const reviewed = await flow.createReview();
    await expect(stat(reviewed.previewPath)).resolves.toMatchObject({ isFile: expect.any(Function) });
    await expect(stat(reviewed.contactSheetPath)).resolves.toMatchObject({ isFile: expect.any(Function) });
    await expect(flow.createReview()).resolves.toMatchObject({
      reportPath: reviewed.reportPath,
      previewPath: reviewed.previewPath,
      contactSheetPath: reviewed.contactSheetPath
    });
    const reportText = await readFile(reviewed.reportPath, "utf8");
    expect(reportText).not.toContain(sourcePath);
    expect(flow.getPublicState()).toMatchObject({
      status: "needs_review",
      petId: "generated_local_pet",
      review: expect.objectContaining({
        previewUrl: expect.stringContaining("preview.png"),
        contactSheetUrl: expect.stringContaining("contact-sheet.png")
      })
    });

    const accepted = await flow.acceptPet();
    await expect(validatePetBundle(accepted.installedBundleDir)).resolves.toMatchObject({
      manifest: expect.objectContaining({ id: "generated_local_pet" })
    });
    expect(flow.getPublicState()).toMatchObject({
      status: "accepted",
      accepted: expect.objectContaining({ petId: "generated_local_pet" })
    });

    const draftDeleted = await flow.deleteDraftAssets();
    expect(draftDeleted.deleted).toBe(true);
    await expect(stat(generated.bundleDir)).rejects.toMatchObject({ code: "ENOENT" });
    await expect(stat(reviewed.reportPath)).rejects.toMatchObject({ code: "ENOENT" });
    expect(flow.getPublicState().accepted?.petId).toBe("generated_local_pet");
    expect(flow.getPublicState().sourceImageName).toBeNull();

    const acceptedDeleted = await flow.deleteAcceptedPet();
    expect(acceptedDeleted.deleted).toBe(true);
    await expect(stat(accepted.installedBundleDir)).rejects.toMatchObject({ code: "ENOENT" });
    expect(flow.getPublicState()).toMatchObject({
      status: "idle",
      sourceImageName: null,
      accepted: null
    });
  });

  test("creates a local stylizer developer preview from derived artifacts only", async () => {
    const workspace = await createTempDir();
    const sourcePath = path.join(workspace, "source.png");
    const appDataDir = path.join(workspace, "app-data");
    await writeFile(sourcePath, createPngSource());
    const flow = new GuidedPetFlow({
      workspaceDir: appDataDir,
      now: fixedNow
    });
    await flow.initialize();
    await flow.setSourceImagePath(sourcePath);

    const result = await flow.createDeveloperPreview();
    expect(result).toEqual({
      presetIds: ["balanced", "soft_mask", "bold_edges"],
      previewCount: 3
    });

    const publicState = flow.getPublicState();
    expect(JSON.stringify(publicState)).not.toContain(sourcePath);
    expect(publicState).toMatchObject({
      developerPreview: {
        contactSheetUrl: expect.stringContaining("contact-sheet.png"),
        previews: [
          expect.objectContaining({ presetId: "balanced", previewUrl: expect.stringContaining("balanced.png") }),
          expect.objectContaining({ presetId: "soft_mask", previewUrl: expect.stringContaining("soft_mask.png") }),
          expect.objectContaining({
            presetId: "bold_edges",
            currentDefault: true,
            previewUrl: expect.stringContaining("bold_edges.png")
          })
        ]
      }
    });

    const contactSheetPath = fileURLToPath(publicState.developerPreview!.contactSheetUrl);
    await expect(stat(contactSheetPath)).resolves.toMatchObject({ isFile: expect.any(Function) });
    for (const preview of publicState.developerPreview!.previews) {
      await expect(stat(fileURLToPath(preview.previewUrl))).resolves.toMatchObject({ isFile: expect.any(Function) });
    }

    const previewOutputDir = path.dirname(contactSheetPath);
    const reportText = await readFile(path.join(previewOutputDir, "stylizer-preview-comparison-report.json"), "utf8");
    expect(reportText).not.toContain(sourcePath);
    expect(reportText).not.toContain("source.png");
    const artifactNames = await listRelativeFiles(path.join(appDataDir, "developer-previews"));
    expect(artifactNames).toContain("run-20260630120000-1/comparison/contact-sheet.png");
    expect(artifactNames).toContain("run-20260630120000-1/comparison/previews/bold_edges.png");
    expect(artifactNames).not.toContain("run-20260630120000-1/comparison/source.png");
    expect(artifactNames.some((name) => name.endsWith("normalized-source.png"))).toBe(false);

    const deleted = await flow.deleteDraftAssets();
    expect(deleted.deleted).toBe(true);
    await expect(stat(contactSheetPath)).rejects.toMatchObject({ code: "ENOENT" });
    expect(flow.getPublicState().developerPreview).toBeNull();
    expect(flow.getPublicState().sourceImageName).toBeNull();
  });

  test("clears selected source image metadata when draft or accepted assets are deleted", async () => {
    const workspace = await createTempDir();
    const sourcePath = path.join(workspace, "1.jpg");
    await writeFile(sourcePath, createPngSource());
    const flow = new GuidedPetFlow({
      workspaceDir: path.join(workspace, "app-data"),
      now: fixedNow
    });
    await flow.initialize();
    await flow.setSourceImagePath(sourcePath);
    await flow.generatePet();
    await flow.acceptPet();

    expect(flow.getPublicState()).toMatchObject({
      sourceImageName: "1.jpg",
      accepted: expect.objectContaining({ petId: "generated_local_pet" })
    });

    await expect(flow.deleteDraftAssets()).resolves.toEqual({ deleted: true });
    await expect(stat(sourcePath)).resolves.toMatchObject({ isFile: expect.any(Function) });
    expect(flow.getPublicState()).toMatchObject({
      status: "accepted",
      sourceImageName: null,
      accepted: expect.objectContaining({ petId: "generated_local_pet" }),
      actions: expect.objectContaining({
        canGenerate: false,
        canLaunch: true
      })
    });

    await flow.setSourceImagePath(sourcePath);
    expect(flow.getPublicState().sourceImageName).toBe("1.jpg");

    await expect(flow.deleteAcceptedPet()).resolves.toEqual({ deleted: true });
    await expect(stat(sourcePath)).resolves.toMatchObject({ isFile: expect.any(Function) });
    expect(flow.getPublicState()).toMatchObject({
      status: "idle",
      sourceImageName: null,
      accepted: null,
      actions: expect.objectContaining({
        canGenerate: false,
        canLaunch: false
      })
    });
  });

  test("cleans up developer preview output when local comparison fails", async () => {
    const workspace = await createTempDir();
    const sourcePath = path.join(workspace, "bad.png");
    const appDataDir = path.join(workspace, "app-data");
    await writeFile(sourcePath, "not a png");
    const flow = new GuidedPetFlow({
      workspaceDir: appDataDir,
      now: fixedNow
    });
    await flow.initialize();
    await flow.setSourceImagePath(sourcePath);

    await expect(flow.createDeveloperPreview()).rejects.toMatchObject({ code: "UNSUPPORTED_SOURCE_IMAGE_TYPE" });
    await expect(readdir(path.join(appDataDir, "developer-previews"))).resolves.toEqual([]);
    expect(flow.getPublicState().developerPreview).toBeNull();
  });

  test("rejects actions before the required previous step", async () => {
    const workspace = await createTempDir();
    const flow = new GuidedPetFlow({
      workspaceDir: path.join(workspace, "app-data"),
      now: fixedNow
    });
    await flow.initialize();

    await expect(flow.generatePet()).rejects.toMatchObject({ code: "SOURCE_IMAGE_REQUIRED" });
    await expect(flow.createReview()).rejects.toMatchObject({ code: "DRAFT_BUNDLE_REQUIRED" });
    await expect(flow.acceptPet()).rejects.toMatchObject({ code: "DRAFT_BUNDLE_REQUIRED" });
    await expect(flow.launchPet()).rejects.toMatchObject({ code: "ACCEPTED_BUNDLE_REQUIRED" });
  });

  test("can stop a launched desktop runtime process", async () => {
    const workspace = await createTempDir();
    const sourcePath = path.join(workspace, "source.png");
    const runtimeStartedPath = path.join(workspace, "runtime-started.txt");
    const runtimeStoppedPath = path.join(workspace, "runtime-stopped.txt");
    const fakeRuntimePath = path.join(workspace, "fake-runtime.cjs");
    await writeFile(sourcePath, createPngSource());
    await writeFile(fakeRuntimePath, createFakeRuntimeScript(runtimeStartedPath, runtimeStoppedPath));
    const flow = new GuidedPetFlow({
      workspaceDir: path.join(workspace, "app-data"),
      runtimeElectronPath: process.execPath,
      runtimeMainPath: fakeRuntimePath,
      now: fixedNow
    });
    await flow.initialize();
    await flow.setSourceImagePath(sourcePath);
    await flow.generatePet();
    await flow.acceptPet();

    await expect(flow.launchPet()).resolves.toEqual({ launched: true });
    await waitForFile(runtimeStartedPath);
    expect(flow.getPublicState()).toMatchObject({
      status: "launched",
      launch: {
        launched: true,
        running: true
      },
      actions: expect.objectContaining({
        canGenerate: false,
        canLaunch: false,
        canStopLaunch: true
      })
    });

    await expect(flow.deleteDraftAssets()).resolves.toEqual({ deleted: true });
    expect(flow.getPublicState()).toMatchObject({
      status: "launched",
      launch: {
        launched: true,
        running: true
      },
      actions: expect.objectContaining({
        canDeleteDraft: false,
        canStopLaunch: true
      })
    });

    await expect(flow.stopPet()).resolves.toEqual({ stopped: true });
    await waitForFile(runtimeStoppedPath);
    expect(flow.getPublicState()).toMatchObject({
      status: "accepted",
      launch: null,
      actions: expect.objectContaining({
        canLaunch: true,
        canStopLaunch: false
      })
    });
  });

  test("requires explicit confirmation before mock cloud generation creates a draft", async () => {
    const workspace = await createTempDir();
    const sourcePath = path.join(workspace, "source.png");
    const appDataDir = path.join(workspace, "app-data");
    await writeFile(sourcePath, createPngSource());
    const flow = new GuidedPetFlow({
      workspaceDir: appDataDir,
      env: { DOUDOU_MOCK_CLOUD_API_KEY: "secret-test-key" },
      now: fixedNow
    });
    await flow.initialize();
    await flow.setSourceImagePath(sourcePath);
    await flow.setGenerationSettings({
      mode: "mock_cloud",
      providerId: "mock-provider",
      confirmCloudUpload: false
    });

    expect(flow.getPublicState()).toMatchObject({
      generation: {
        mode: "mock_cloud",
        providerId: "mock-provider",
        cloudUploadConfirmed: false,
        cloudProviderConfigured: true
      },
      actions: expect.objectContaining({ canGenerate: false })
    });
    expect(JSON.stringify(flow.getPublicState())).not.toContain("secret-test-key");

    await expect(flow.generatePet()).rejects.toMatchObject({ code: "CLOUD_OPT_IN_REQUIRED" });
    await expect(readdir(path.join(appDataDir, "drafts"))).resolves.toEqual([]);
  });

  test("generates a mock cloud bundle after explicit confirmation without exposing source paths or provider secrets", async () => {
    const workspace = await createTempDir();
    const sourcePath = path.join(workspace, "source.png");
    await writeFile(sourcePath, createPngSource());
    const flow = new GuidedPetFlow({
      workspaceDir: path.join(workspace, "app-data"),
      env: { DOUDOU_MOCK_CLOUD_API_KEY: "secret-test-key" },
      now: fixedNow
    });
    await flow.initialize();
    await flow.setSourceImagePath(sourcePath);
    await flow.setGenerationSettings({
      mode: "mock_cloud",
      providerId: "mock-provider",
      confirmCloudUpload: true
    });

    const generated = await flow.generatePet();
    const validated = await validatePetBundle(generated.bundleDir);
    expect(validated.manifest).toMatchObject({
      id: "generated_cloud_pet",
      privacy: {
        sourceImageStored: false,
        cloudGenerated: true
      }
    });
    expect(flow.getPublicState()).toMatchObject({
      status: "generated",
      petId: "generated_cloud_pet",
      generation: {
        mode: "mock_cloud",
        providerId: "mock-provider",
        cloudUploadConfirmed: true,
        cloudProviderConfigured: true
      }
    });
    const sourceMetaText = await readFile(path.join(generated.bundleDir, "source.meta.json"), "utf8");
    expect(sourceMetaText).toContain("cloud-image-adapter.mock-provider");
    expect(sourceMetaText).not.toContain(sourcePath);
    expect(JSON.stringify(flow.getPublicState())).not.toContain(sourcePath);
    expect(JSON.stringify(flow.getPublicState())).not.toContain("secret-test-key");
  });

  test("requires mock cloud provider config before generation", async () => {
    const workspace = await createTempDir();
    const sourcePath = path.join(workspace, "source.png");
    const appDataDir = path.join(workspace, "app-data");
    await writeFile(sourcePath, createPngSource());
    const flow = new GuidedPetFlow({
      workspaceDir: appDataDir,
      env: {},
      now: fixedNow
    });
    await flow.initialize();
    await flow.setSourceImagePath(sourcePath);
    await flow.setGenerationSettings({
      mode: "mock_cloud",
      providerId: "mock-provider",
      confirmCloudUpload: true
    });

    expect(flow.getPublicState()).toMatchObject({
      generation: {
        mode: "mock_cloud",
        cloudUploadConfirmed: true,
        cloudProviderConfigured: false
      },
      actions: expect.objectContaining({ canGenerate: false })
    });
    await expect(flow.generatePet()).rejects.toMatchObject({ code: "PROVIDER_NOT_CONFIGURED" });
    await expect(readdir(path.join(appDataDir, "drafts"))).resolves.toEqual([]);
  });

  test("keeps OpenAI live generation disabled unless the live env gate is enabled", async () => {
    const workspace = await createTempDir();
    const sourcePath = path.join(workspace, "source.png");
    const appDataDir = path.join(workspace, "app-data");
    await writeFile(sourcePath, createPngSource());
    const flow = new GuidedPetFlow({
      workspaceDir: appDataDir,
      env: { OPENAI_API_KEY: "secret-openai-key" },
      now: fixedNow
    });
    await flow.initialize();
    await flow.setSourceImagePath(sourcePath);
    await flow.setGenerationSettings({
      mode: "openai_live",
      providerId: "openai-image",
      confirmCloudUpload: true
    });

    expect(flow.getPublicState()).toMatchObject({
      generation: {
        mode: "openai_live",
        providerId: "openai-image",
        cloudUploadConfirmed: true,
        cloudProviderConfigured: false,
        liveProviderEnabled: false
      },
      actions: expect.objectContaining({ canGenerate: false })
    });
    await expect(flow.generatePet()).rejects.toMatchObject({ code: "LIVE_PROVIDER_NOT_ENABLED" });
    await expect(readdir(path.join(appDataDir, "drafts"))).resolves.toEqual([]);
    expect(JSON.stringify(flow.getPublicState())).not.toContain("secret-openai-key");
  });

  test("requires explicit UI confirmation before OpenAI live generation creates a draft", async () => {
    const workspace = await createTempDir();
    const sourcePath = path.join(workspace, "source.png");
    const appDataDir = path.join(workspace, "app-data");
    await writeFile(sourcePath, createPngSource());
    const flow = new GuidedPetFlow({
      workspaceDir: appDataDir,
      env: { DOUDOU_ENABLE_OPENAI_LIVE: "1", OPENAI_API_KEY: "secret-openai-key" },
      now: fixedNow
    });
    await flow.initialize();
    await flow.setSourceImagePath(sourcePath);
    await flow.setGenerationSettings({
      mode: "openai_live",
      providerId: "openai-image",
      confirmCloudUpload: false
    });

    expect(flow.getPublicState()).toMatchObject({
      generation: {
        mode: "openai_live",
        providerId: "openai-image",
        cloudUploadConfirmed: false,
        cloudProviderConfigured: true,
        liveProviderEnabled: true
      },
      actions: expect.objectContaining({ canGenerate: false })
    });
    await expect(flow.generatePet()).rejects.toMatchObject({ code: "CLOUD_OPT_IN_REQUIRED" });
    await expect(readdir(path.join(appDataDir, "drafts"))).resolves.toEqual([]);
    expect(JSON.stringify(flow.getPublicState())).not.toContain("secret-openai-key");
  });

  test("generates an OpenAI live bundle through mocked fetch without exposing source paths or API keys", async () => {
    const workspace = await createTempDir();
    const sourcePath = path.join(workspace, "source.png");
    await writeFile(sourcePath, createPngSource());
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const flow = new GuidedPetFlow({
      workspaceDir: path.join(workspace, "app-data"),
      env: {
        DOUDOU_ENABLE_OPENAI_LIVE: "1",
        OPENAI_API_KEY: "secret-openai-key",
        DOUDOU_OPENAI_BASE_URL: "https://api.openai.test/custom/v1",
        OPENAI_MODEL: "test-image-model"
      },
      openAiFetch: async (url, init) => {
        calls.push({ url: String(url), init: init ?? {} });
        return new Response(
          JSON.stringify({
            data: [{ b64_json: createPngSource(256, 256).toString("base64") }]
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      },
      now: fixedNow
    });
    await flow.initialize();
    await flow.setSourceImagePath(sourcePath);
    await flow.setGenerationSettings({
      mode: "openai_live",
      providerId: "openai-image",
      confirmCloudUpload: true
    });

    const generated = await flow.generatePet();
    const validated = await validatePetBundle(generated.bundleDir);
    expect(validated.manifest).toMatchObject({
      id: "generated_cloud_pet",
      privacy: {
        sourceImageStored: false,
        cloudGenerated: true
      }
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ url: "https://api.openai.test/custom/v1/images/edits" });
    expect((calls[0]!.init.body as FormData).get("model")).toBe("test-image-model");
    expect(flow.getPublicState()).toMatchObject({
      status: "generated",
      petId: "generated_cloud_pet",
      generation: {
        mode: "openai_live",
        providerId: "openai-image",
        cloudUploadConfirmed: true,
        cloudProviderConfigured: true,
        liveProviderEnabled: true
      }
    });
    const sourceMetaText = await readFile(path.join(generated.bundleDir, "source.meta.json"), "utf8");
    expect(sourceMetaText).toContain("cloud-image-adapter.openai-image");
    expect(sourceMetaText).not.toContain(sourcePath);
    expect(sourceMetaText).not.toContain("secret-openai-key");
    expect(JSON.stringify(flow.getPublicState())).not.toContain(sourcePath);
    expect(JSON.stringify(flow.getPublicState())).not.toContain("secret-openai-key");
  });
});

async function createTempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "guided-flow-"));
  tempDirs.push(dir);
  return dir;
}

function createPngSource(width = 32, height = 32): Buffer {
  const png = new PNG({ width, height });
  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      const index = (png.width * y + x) << 2;
      png.data[index] = 90 + (x % 80);
      png.data[index + 1] = 150 + (y % 60);
      png.data[index + 2] = 220;
      png.data[index + 3] = 255;
    }
  }
  return PNG.sync.write(png);
}

function createFakeRuntimeScript(startedPath: string, stoppedPath: string): string {
  return `
const { writeFileSync } = require("node:fs");
writeFileSync(${JSON.stringify(startedPath)}, String(process.pid));
process.on("SIGTERM", () => {
  writeFileSync(${JSON.stringify(stoppedPath)}, "stopped");
  process.exit(0);
});
setTimeout(() => process.exit(0), 5000);
setInterval(() => undefined, 1000);
`;
}

async function waitForFile(filePath: string): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      await stat(filePath);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }
  throw new Error(`Timed out waiting for ${filePath}.`);
}

async function listRelativeFiles(rootDir: string): Promise<string[]> {
  const entries: string[] = [];
  await collect(rootDir, "");
  return entries.sort();

  async function collect(currentDir: string, relativeDir: string): Promise<void> {
    const dirEntries = await readdir(currentDir, { withFileTypes: true });
    for (const entry of dirEntries) {
      const relativePath = path.join(relativeDir, entry.name);
      const absolutePath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await collect(absolutePath, relativePath);
      } else {
        entries.push(relativePath.split(path.sep).join("/"));
      }
    }
  }
}

import { mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
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

    const acceptedDeleted = await flow.deleteAcceptedPet();
    expect(acceptedDeleted.deleted).toBe(true);
    await expect(stat(accepted.installedBundleDir)).rejects.toMatchObject({ code: "ENOENT" });
    expect(flow.getPublicState()).toMatchObject({
      status: "source_selected",
      accepted: null
    });
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
    const calls: RequestInit[] = [];
    const flow = new GuidedPetFlow({
      workspaceDir: path.join(workspace, "app-data"),
      env: {
        DOUDOU_ENABLE_OPENAI_LIVE: "1",
        OPENAI_API_KEY: "secret-openai-key",
        DOUDOU_OPENAI_IMAGE_ENDPOINT: "https://api.openai.test/v1/images/edits"
      },
      openAiFetch: async (_url, init) => {
        calls.push(init ?? {});
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

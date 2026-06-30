import { mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { PNG } from "pngjs";
import { afterEach, describe, expect, test } from "vitest";
import { runGeneratePetCloudCli } from "../../src/cli/generate-pet-cloud.js";
import {
  CloudImageAdapterError,
  CloudImageProviderError,
  createCloudImageAdapter,
  createMockCloudImageProvider,
  type CloudImageProvider
} from "../../src/generation/adapters/cloud-image-adapter.js";
import { generatePetBundleFromSource } from "../../src/generation/generate-pet.js";
import { validatePetBundle } from "../../src/pet_bundle/validate.js";

const tempDirs: string[] = [];
const fixedNow = new Date("2026-06-30T12:00:00.000Z");

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { force: true, recursive: true })));
});

describe("createCloudImageAdapter", () => {
  test("requires explicit cloud upload confirmation before provider access or normalization", async () => {
    const workspace = await createTempDir();
    const sourcePath = path.join(workspace, "input.png");
    const normalizationRoot = path.join(workspace, "normalization");
    await writeFile(sourcePath, createPngSource());
    const provider = createRecordingProvider();

    await expect(
      generatePetBundleFromSource({
        sourceImagePath: sourcePath,
        outputBundleDir: path.join(workspace, "out"),
        normalizationTempRoot: normalizationRoot,
        adapter: createCloudImageAdapter({
          confirmCloudUpload: false,
          config: { providerId: "mock-provider", apiKey: "secret-test-key" },
          provider
        }),
        now: fixedNow
      })
    ).rejects.toMatchObject({ code: "CLOUD_OPT_IN_REQUIRED" });

    expect(provider.calls).toHaveLength(0);
    await expect(readdir(normalizationRoot)).rejects.toMatchObject({ code: "ENOENT" });
    await expect(stat(path.join(workspace, "out"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  test("requires provider config without exposing the configured secret", async () => {
    const adapter = createCloudImageAdapter({
      confirmCloudUpload: true,
      config: { providerId: "mock-provider", apiKey: "" },
      provider: createRecordingProvider()
    });

    expect(() => adapter.preflight?.()).toThrow(CloudImageAdapterError);
    expect(() => adapter.preflight?.()).toThrow(expect.objectContaining({
      code: "PROVIDER_NOT_CONFIGURED",
      message: expect.not.stringContaining("secret")
    }));
  });

  test.each([
    ["refused", "MODEL_REFUSED"],
    ["rate_limited", "MODEL_RATE_LIMITED"],
    ["timeout", "MODEL_TIMEOUT"],
    ["provider_error", "MODEL_PROVIDER_ERROR"]
  ] as const)("maps provider %s failures to %s", async (providerCode, expectedCode) => {
    const workspace = await createTempDir();
    const sourcePath = path.join(workspace, "input.png");
    await writeFile(sourcePath, createPngSource());

    await expect(
      generatePetBundleFromSource({
        sourceImagePath: sourcePath,
        outputBundleDir: path.join(workspace, "out"),
        normalizationTempRoot: path.join(workspace, "normalization"),
        adapter: createCloudImageAdapter({
          confirmCloudUpload: true,
          config: { providerId: "mock-provider", apiKey: "secret-test-key" },
          provider: {
            id: "mock-provider",
            async generateCharacter() {
              throw new CloudImageProviderError(providerCode, "provider failed");
            }
          }
        }),
        now: fixedNow
      })
    ).rejects.toMatchObject({ code: expectedCode });
  });

  test("rejects provider outputs with raw payload fields before bundle write", async () => {
    const workspace = await createTempDir();
    const sourcePath = path.join(workspace, "input.png");
    await writeFile(sourcePath, createPngSource());

    await expect(
      generatePetBundleFromSource({
        sourceImagePath: sourcePath,
        outputBundleDir: path.join(workspace, "out"),
        normalizationTempRoot: path.join(workspace, "normalization"),
        adapter: createCloudImageAdapter({
          confirmCloudUpload: true,
          config: { providerId: "mock-provider", apiKey: "secret-test-key" },
          provider: {
            id: "mock-provider",
            async generateCharacter() {
              return {
                imagePng: createPngSource(256, 256),
                rawResponse: { id: "provider-payload" }
              } as never;
            }
          }
        }),
        now: fixedNow
      })
    ).rejects.toMatchObject({ code: "MODEL_OUTPUT_INVALID" });

    await expect(stat(path.join(workspace, "out/pet.json"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  test("generates a validated bundle through the mocked cloud provider and cleans normalized temp files", async () => {
    const workspace = await createTempDir();
    const sourcePath = path.join(workspace, "input.png");
    const outputDir = path.join(workspace, "cloud_pet");
    const normalizationRoot = path.join(workspace, "normalization");
    await writeFile(sourcePath, createPngSource(40, 28));
    const provider = createRecordingProvider();

    const result = await generatePetBundleFromSource({
      sourceImagePath: sourcePath,
      outputBundleDir: outputDir,
      normalizationTempRoot: normalizationRoot,
      adapter: createCloudImageAdapter({
        confirmCloudUpload: true,
        config: { providerId: "mock-provider", apiKey: "secret-test-key" },
        provider
      }),
      now: fixedNow
    });

    await expect(validatePetBundle(outputDir)).resolves.toMatchObject({
      manifest: expect.objectContaining({ id: "generated_cloud_pet" })
    });
    expect(result.manifest.privacy.cloudGenerated).toBe(true);
    expect(result.generation).toEqual({
      adapterId: "cloud-image-adapter.mock-provider",
      adapterVersion: "0.1.0"
    });
    expect(provider.calls).toHaveLength(1);
    expect(provider.calls[0]).toMatchObject({
      providerId: "mock-provider",
      normalizedImage: expect.objectContaining({ mime: "image/png", width: 256, height: 256 })
    });
    expect(JSON.stringify(provider.calls[0])).not.toContain(sourcePath);
    expect(JSON.stringify(provider.calls[0])).not.toContain("secret-test-key");
    await expect(readdir(normalizationRoot)).resolves.toEqual([]);

    const sourceMeta = JSON.parse(await readFile(path.join(outputDir, "source.meta.json"), "utf8")) as Record<string, unknown>;
    expect(sourceMeta).toMatchObject({
      generationAdapter: "cloud-image-adapter.mock-provider",
      generationAdapterVersion: "0.1.0",
      sourceImageStored: false
    });
    expect(JSON.stringify(sourceMeta)).not.toContain("secret-test-key");
    expect(JSON.stringify(sourceMeta)).not.toContain(sourcePath);
    expect(JSON.stringify(sourceMeta)).not.toContain("rawResponse");
  });

  test("cleans normalized temp files after provider failure", async () => {
    const workspace = await createTempDir();
    const sourcePath = path.join(workspace, "input.png");
    const normalizationRoot = path.join(workspace, "normalization");
    await writeFile(sourcePath, createPngSource());

    await expect(
      generatePetBundleFromSource({
        sourceImagePath: sourcePath,
        outputBundleDir: path.join(workspace, "out"),
        normalizationTempRoot: normalizationRoot,
        adapter: createCloudImageAdapter({
          confirmCloudUpload: true,
          config: { providerId: "mock-provider", apiKey: "secret-test-key" },
          provider: {
            id: "mock-provider",
            async generateCharacter() {
              throw new CloudImageProviderError("timeout", "provider timed out");
            }
          }
        }),
        now: fixedNow
      })
    ).rejects.toMatchObject({ code: "MODEL_TIMEOUT" });

    await expect(readdir(normalizationRoot)).resolves.toEqual([]);
  });
});

describe("runGeneratePetCloudCli", () => {
  test("fails without --confirm-cloud-upload", async () => {
    const workspace = await createTempDir();
    const sourcePath = path.join(workspace, "input.png");
    await writeFile(sourcePath, createPngSource());

    const exitCode = await runGeneratePetCloudCli([
      "node",
      "generate-pet-cloud",
      sourcePath,
      path.join(workspace, "out"),
      "--provider",
      "mock-provider"
    ], {
      env: { DOUDOU_MOCK_CLOUD_API_KEY: "secret-test-key" },
      now: fixedNow
    });

    expect(exitCode).toBe(1);
  });

  test("generates a bundle with mocked provider config and explicit confirmation", async () => {
    const workspace = await createTempDir();
    const sourcePath = path.join(workspace, "input.png");
    const outputDir = path.join(workspace, "cloud_cli_pet");
    await writeFile(sourcePath, createPngSource());

    const exitCode = await runGeneratePetCloudCli([
      "node",
      "generate-pet-cloud",
      sourcePath,
      outputDir,
      "--provider",
      "mock-provider",
      "--confirm-cloud-upload"
    ], {
      env: { DOUDOU_MOCK_CLOUD_API_KEY: "secret-test-key" },
      now: fixedNow
    });

    expect(exitCode).toBe(0);
    await expect(validatePetBundle(outputDir)).resolves.toMatchObject({
      manifest: expect.objectContaining({ id: "generated_cloud_pet" })
    });
  });
});

async function createTempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "cloud-adapter-"));
  tempDirs.push(dir);
  return dir;
}

function createRecordingProvider(): CloudImageProvider & { calls: unknown[] } {
  const calls: unknown[] = [];
  return {
    id: "mock-provider",
    calls,
    async generateCharacter(request) {
      calls.push(request);
      return { imagePng: createPngSource(256, 256) };
    }
  };
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

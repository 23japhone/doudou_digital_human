import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PNG } from "pngjs";
import { afterEach, describe, expect, test } from "vitest";
import { validatePetBundle } from "../../src/pet_bundle/validate.js";

type JsonObject = Record<string, unknown>;

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { force: true, recursive: true })));
});

describe("validatePetBundle", () => {
  test("accepts a valid v0.1 sprite atlas bundle", async () => {
    const bundleDir = await createBundle();

    const result = await validatePetBundle(bundleDir);

    expect(result.manifest.schemaVersion).toBe("0.1.0");
    expect(result.manifest.assetFormat).toBe("png_sprite_atlas_grid");
    expect(result.manifest.animations.idle.frames).toHaveLength(4);
    expect(result.referencedAssets.sort()).toEqual([
      "atlases/main.png",
      "preview.png",
      "source.meta.json"
    ]);
  });

  test("rejects a missing manifest with a clear error code", async () => {
    const bundleDir = await createBundle({ omitManifest: true });

    await expect(validatePetBundle(bundleDir)).rejects.toMatchObject({
      issues: [expect.objectContaining({ code: "MISSING_MANIFEST", path: "pet.json" })]
    });
  });

  test("rejects an unsupported schema major version", async () => {
    const bundleDir = await createBundle({
      mutateManifest: (manifest) => ({ ...manifest, schemaVersion: "1.0.0" })
    });

    await expect(validatePetBundle(bundleDir)).rejects.toMatchObject({
      issues: [expect.objectContaining({ code: "UNSUPPORTED_SCHEMA_VERSION" })]
    });
  });

  test("rejects a missing atlas asset", async () => {
    const bundleDir = await createBundle({ omitAtlas: true });

    await expect(validatePetBundle(bundleDir)).rejects.toMatchObject({
      issues: [expect.objectContaining({ code: "MISSING_ASSET", path: "atlases/main.png" })]
    });
  });

  test("rejects atlas dimensions that do not match the manifest", async () => {
    const bundleDir = await createBundle({
      mutateManifest: (manifest) => ({
        ...manifest,
        assets: {
          ...(manifest.assets as JsonObject),
          atlases: [
            {
              ...((manifest.assets as JsonObject).atlases as JsonObject[])[0],
              width: 512
            }
          ]
        }
      })
    });

    await expect(validatePetBundle(bundleDir)).rejects.toMatchObject({
      issues: [expect.objectContaining({ code: "ASSET_DIMENSION_MISMATCH", path: "atlases/main.png" })]
    });
  });

  test("rejects frame indexes outside the atlas grid", async () => {
    const bundleDir = await createBundle({
      mutateManifest: (manifest) => ({
        ...manifest,
        animations: {
          ...(manifest.animations as JsonObject),
          idle: {
            ...((manifest.animations as JsonObject).idle as JsonObject),
            frames: [{ index: 8, durationMs: 120 }]
          }
        }
      })
    });

    await expect(validatePetBundle(bundleDir)).rejects.toMatchObject({
      issues: [expect.objectContaining({ code: "FRAME_OUT_OF_RANGE" })]
    });
  });

  test("rejects behavior references to unknown animations", async () => {
    const bundleDir = await createBundle({
      mutateManifest: (manifest) => ({
        ...manifest,
        behavior: {
          initial: "idle",
          onTap: "missing_reaction"
        }
      })
    });

    await expect(validatePetBundle(bundleDir)).rejects.toMatchObject({
      issues: [expect.objectContaining({ code: "UNKNOWN_ANIMATION", path: "behavior.onTap" })]
    });
  });

  test("rejects unsafe bundle paths", async () => {
    const bundleDir = await createBundle({
      mutateManifest: (manifest) => ({
        ...manifest,
        assets: {
          ...(manifest.assets as JsonObject),
          preview: "../secret.png"
        }
      })
    });

    await expect(validatePetBundle(bundleDir)).rejects.toMatchObject({
      issues: [expect.objectContaining({ code: "UNSAFE_PATH", path: "../secret.png" })]
    });
  });

  test("rejects remote asset URLs", async () => {
    const bundleDir = await createBundle({
      mutateManifest: (manifest) => ({
        ...manifest,
        assets: {
          ...(manifest.assets as JsonObject),
          preview: "https://example.invalid/pet.png"
        }
      })
    });

    await expect(validatePetBundle(bundleDir)).rejects.toMatchObject({
      issues: [expect.objectContaining({ code: "UNSAFE_PATH", path: "https://example.invalid/pet.png" })]
    });
  });

  test("rejects fully transparent referenced frames", async () => {
    const bundleDir = await createBundle({ transparentFrameIndexes: [0] });

    await expect(validatePetBundle(bundleDir)).rejects.toMatchObject({
      issues: [expect.objectContaining({ code: "EMPTY_FRAME" })]
    });
  });

  test("rejects sensitive source metadata", async () => {
    const bundleDir = await createBundle({
      sourceMeta: {
        fixture: true,
        sourceImagePath: "/Users/example/private/photo.png"
      }
    });

    await expect(validatePetBundle(bundleDir)).rejects.toMatchObject({
      issues: [expect.objectContaining({ code: "SENSITIVE_SOURCE_METADATA", path: "source.meta.json" })]
    });
  });

  test("rejects stored source images in v0.1 bundles", async () => {
    const bundleDir = await createBundle({
      mutateManifest: (manifest) => ({
        ...manifest,
        privacy: {
          ...((manifest as JsonObject).privacy as JsonObject),
          sourceImageStored: true
        }
      })
    });

    await expect(validatePetBundle(bundleDir)).rejects.toMatchObject({
      issues: [expect.objectContaining({ code: "SOURCE_IMAGE_STORED_UNSUPPORTED", path: "privacy.sourceImageStored" })]
    });
  });

  test("rejects source image paths even when sourceImageStored is true", async () => {
    const bundleDir = await createBundle({
      mutateManifest: (manifest) => ({
        ...manifest,
        privacy: {
          ...((manifest as JsonObject).privacy as JsonObject),
          sourceImageStored: true
        }
      }),
      sourceMeta: {
        fixture: true,
        sourceImagePath: "private/photo.png"
      }
    });

    await expect(validatePetBundle(bundleDir)).rejects.toMatchObject({
      issues: expect.arrayContaining([
        expect.objectContaining({ code: "SOURCE_IMAGE_STORED_UNSUPPORTED", path: "privacy.sourceImageStored" }),
        expect.objectContaining({ code: "SENSITIVE_SOURCE_METADATA", path: "source.meta.json" })
      ])
    });
  });

  test.each([
    ["prompt", { prompt: "private generation prompt" }],
    ["rawPrompt", { rawPrompt: "private generation prompt" }],
    ["rawResponse", { rawResponse: { id: "provider-response" } }],
    ["apiKey", { apiKey: "sk-test" }],
    ["api_key", { api_key: "sk-test" }],
    ["openaiApiKey", { openaiApiKey: "sk-test" }],
    ["apiSecret", { apiSecret: "secret-test" }],
    ["accessToken", { accessToken: "token-test" }],
    ["authToken", { authToken: "token-test" }],
    ["bearerToken", { bearerToken: "token-test" }],
    ["secret", { secret: "not-for-bundles" }],
    ["absolutePath", { absolutePath: "private/photo.png" }],
    ["sourceImageUri", { sourceImageUri: "private/photo.png" }],
    ["sourceImageUrl", { sourceImageUrl: "private/photo.png" }],
    ["absolute path value", { artifact: "/Users/example/private/photo.png" }],
    ["file uri value", { artifact: "file:///Users/example/private/photo.png" }]
  ])("rejects sensitive source metadata field %s", async (_label, sensitiveMeta) => {
    const bundleDir = await createBundle({
      sourceMeta: {
        fixture: true,
        ...sensitiveMeta
      }
    });

    await expect(validatePetBundle(bundleDir)).rejects.toMatchObject({
      issues: [expect.objectContaining({ code: "SENSITIVE_SOURCE_METADATA", path: "source.meta.json" })]
    });
  });

  test("accepts non-sensitive fixture provenance metadata", async () => {
    const bundleDir = await createBundle({
      sourceMeta: {
        fixture: true,
        generatedBy: "vitest",
        sourceType: "synthetic-geometric-shapes",
        license: "project-owned-test-fixture",
        containsPersonalImage: false,
        containsExternalAsset: false
      }
    });

    await expect(validatePetBundle(bundleDir)).resolves.toMatchObject({
      manifest: expect.objectContaining({ schemaVersion: "0.1.0" })
    });
  });

  test("rejects source metadata fields outside the v0.1 allowlist", async () => {
    const bundleDir = await createBundle({
      sourceMeta: {
        fixture: true,
        generatedBy: "vitest",
        modelProvider: "local-placeholder"
      }
    });

    await expect(validatePetBundle(bundleDir)).rejects.toMatchObject({
      issues: [expect.objectContaining({ code: "INVALID_SOURCE_METADATA", path: "source.meta.json" })]
    });
  });

  test("rejects unreferenced source image files when source images are not stored", async () => {
    const bundleDir = await createBundle({
      extraFiles: [{ path: "source.png", contents: createPreviewPng() }]
    });

    await expect(validatePetBundle(bundleDir)).rejects.toMatchObject({
      issues: [expect.objectContaining({ code: "UNREFERENCED_BUNDLE_FILE", path: "source.png" })]
    });
  });

  test("rejects unknown unreferenced files", async () => {
    const bundleDir = await createBundle({
      extraFiles: [{ path: "notes.txt", contents: "unexpected payload" }]
    });

    await expect(validatePetBundle(bundleDir)).rejects.toMatchObject({
      issues: [expect.objectContaining({ code: "UNREFERENCED_BUNDLE_FILE", path: "notes.txt" })]
    });
  });

  test("rejects unreferenced executable payloads", async () => {
    const bundleDir = await createBundle({
      extraFiles: [{ path: "run.sh", contents: "#!/bin/sh\necho no\n" }]
    });

    await expect(validatePetBundle(bundleDir)).rejects.toMatchObject({
      issues: [expect.objectContaining({ code: "UNREFERENCED_BUNDLE_FILE", path: "run.sh" })]
    });
  });

  test("rejects preview files that are not real PNG images", async () => {
    const bundleDir = await createBundle({
      previewContents: "not a png"
    });

    await expect(validatePetBundle(bundleDir)).rejects.toMatchObject({
      issues: [expect.objectContaining({ code: "INVALID_PNG", path: "preview.png" })]
    });
  });

  test("rejects preview images with the wrong dimensions", async () => {
    const bundleDir = await createBundle({
      previewContents: PNG.sync.write(new PNG({ width: 128, height: 128 }))
    });

    await expect(validatePetBundle(bundleDir)).rejects.toMatchObject({
      issues: [expect.objectContaining({ code: "ASSET_DIMENSION_MISMATCH", path: "preview.png" })]
    });
  });
});

async function createBundle(options: {
  mutateManifest?: (manifest: JsonObject) => JsonObject;
  omitManifest?: boolean;
  omitAtlas?: boolean;
  transparentFrameIndexes?: number[];
  previewContents?: Buffer | string;
  sourceMeta?: JsonObject;
  extraFiles?: Array<{ path: string; contents: Buffer | string }>;
} = {}): Promise<string> {
  const bundleDir = await mkdtemp(join(tmpdir(), "pet-bundle-"));
  tempDirs.push(bundleDir);
  await mkdir(join(bundleDir, "atlases"), { recursive: true });

  if (!options.omitAtlas) {
    await writeFile(
      join(bundleDir, "atlases/main.png"),
      createAtlasPng(new Set(options.transparentFrameIndexes ?? []))
    );
  }

  await writeFile(join(bundleDir, "preview.png"), options.previewContents ?? createPreviewPng());
  await writeFile(
    join(bundleDir, "source.meta.json"),
    JSON.stringify(options.sourceMeta ?? { fixture: true, generatedBy: "vitest" }, null, 2)
  );

  for (const extraFile of options.extraFiles ?? []) {
    await writeFile(join(bundleDir, extraFile.path), extraFile.contents);
  }

  if (!options.omitManifest) {
    const manifest = options.mutateManifest?.(baseManifest()) ?? baseManifest();
    await writeFile(join(bundleDir, "pet.json"), JSON.stringify(manifest, null, 2));
  }

  return bundleDir;
}

function baseManifest(): JsonObject {
  return {
    schemaVersion: "0.1.0",
    id: "demo_pet",
    name: "Demo Pet",
    assetFormat: "png_sprite_atlas_grid",
    canvas: {
      width: 256,
      height: 256,
      anchor: { x: 128, y: 232 }
    },
    assets: {
      preview: "preview.png",
      atlases: [
        {
          id: "main",
          path: "atlases/main.png",
          mime: "image/png",
          width: 1024,
          height: 512,
          frameWidth: 256,
          frameHeight: 256,
          columns: 4,
          rows: 2
        }
      ]
    },
    animations: {
      idle: {
        atlas: "main",
        loop: true,
        frames: [
          { index: 0, durationMs: 120 },
          { index: 1, durationMs: 120 },
          { index: 2, durationMs: 120 },
          { index: 1, durationMs: 120 }
        ]
      },
      tap_react: {
        atlas: "main",
        loop: false,
        frames: [
          { index: 4, durationMs: 90 },
          { index: 5, durationMs: 120 }
        ],
        next: "idle"
      }
    },
    behavior: {
      initial: "idle",
      onTap: "tap_react"
    },
    hitArea: {
      type: "alpha",
      alphaThreshold: 16,
      fallbackRect: { x: 48, y: 32, width: 160, height: 208 }
    },
    privacy: {
      sourceImageStored: false,
      cloudGenerated: false
    },
    provenance: {
      sourceMeta: "source.meta.json"
    }
  };
}

function createAtlasPng(transparentFrameIndexes: Set<number>): Buffer {
  const png = new PNG({ width: 1024, height: 512 });
  for (let frameIndex = 0; frameIndex < 8; frameIndex += 1) {
    const cellX = (frameIndex % 4) * 256;
    const cellY = Math.floor(frameIndex / 4) * 256;
    if (transparentFrameIndexes.has(frameIndex)) {
      continue;
    }
    drawPetCell(png, cellX, cellY, frameIndex);
  }
  return PNG.sync.write(png);
}

function createPreviewPng(): Buffer {
  const png = new PNG({ width: 256, height: 256 });
  drawPetCell(png, 0, 0, 0);
  return PNG.sync.write(png);
}

function drawPetCell(png: PNG, offsetX: number, offsetY: number, frameIndex: number): void {
  const bodyColor = [
    80 + frameIndex * 12,
    160,
    220 - frameIndex * 8
  ] as const;
  fillCircle(png, offsetX + 128, offsetY + 138 - (frameIndex % 3), 58, bodyColor);
  fillCircle(png, offsetX + 94, offsetY + 94, 22, [60, 135, 210]);
  fillCircle(png, offsetX + 162, offsetY + 94, 22, [60, 135, 210]);
  fillCircle(png, offsetX + 108, offsetY + 132, 8, [20, 40, 80]);
  fillCircle(png, offsetX + 148, offsetY + 132, 8, [20, 40, 80]);
  fillRect(png, offsetX + 104, offsetY + 170 + (frameIndex % 2), 48, 8, [20, 40, 80]);
}

function fillCircle(png: PNG, centerX: number, centerY: number, radius: number, rgb: readonly number[]): void {
  for (let y = centerY - radius; y <= centerY + radius; y += 1) {
    for (let x = centerX - radius; x <= centerX + radius; x += 1) {
      const dx = x - centerX;
      const dy = y - centerY;
      if (dx * dx + dy * dy <= radius * radius) {
        setPixel(png, x, y, rgb, 255);
      }
    }
  }
}

function fillRect(png: PNG, x: number, y: number, width: number, height: number, rgb: readonly number[]): void {
  for (let yy = y; yy < y + height; yy += 1) {
    for (let xx = x; xx < x + width; xx += 1) {
      setPixel(png, xx, yy, rgb, 255);
    }
  }
}

function setPixel(png: PNG, x: number, y: number, rgb: readonly number[], alpha: number): void {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height) {
    return;
  }
  const index = (png.width * y + x) << 2;
  png.data[index] = rgb[0];
  png.data[index + 1] = rgb[1];
  png.data[index + 2] = rgb[2];
  png.data[index + 3] = alpha;
}

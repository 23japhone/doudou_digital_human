import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  DEFAULT_DOUDOU_CHARACTER_PROFILE,
  createDoudouPreviewPng,
  createDoudouSpriteAtlasPng
} from "../generation/doudou-sprite.js";

const fixtureDir = "fixtures/pet_bundles/valid_minimal_atlas_pet";

export async function generateFixturePetBundle(rootDir = process.cwd()): Promise<void> {
  const bundleDir = path.join(rootDir, fixtureDir);
  await mkdir(path.join(bundleDir, "atlases"), { recursive: true });

  await writeFile(path.join(bundleDir, "atlases/main.png"), createDoudouSpriteAtlasPng());
  await writeFile(path.join(bundleDir, "preview.png"), createDoudouPreviewPng());
  await writeFile(path.join(bundleDir, "source.meta.json"), `${JSON.stringify(sourceMeta(), null, 2)}\n`);
  await writeFile(path.join(bundleDir, "pet.json"), `${JSON.stringify(manifest(), null, 2)}\n`);
}

function manifest(): Record<string, unknown> {
  return {
    schemaVersion: "0.1.0",
    id: "valid_minimal_atlas_pet",
    name: DEFAULT_DOUDOU_CHARACTER_PROFILE.bundleName,
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
          { index: 0, durationMs: 140 },
          { index: 1, durationMs: 140 },
          { index: 2, durationMs: 140 },
          { index: 1, durationMs: 140 }
        ]
      },
      tap_react: {
        atlas: "main",
        loop: false,
        frames: [
          { index: 4, durationMs: 90 },
          { index: 5, durationMs: 120 },
          { index: 6, durationMs: 120 }
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

function sourceMeta(): Record<string, unknown> {
  return {
    fixture: true,
    generatedBy: "src/scripts/generate-fixture.ts",
    sourceType: DEFAULT_DOUDOU_CHARACTER_PROFILE.sourceType,
    license: "user-authorized-derived-default-character-sprite",
    containsPersonalImage: false,
    containsExternalAsset: false
  };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  generateFixturePetBundle().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

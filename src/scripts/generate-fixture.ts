import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { PNG } from "pngjs";

const fixtureDir = "fixtures/pet_bundles/valid_minimal_atlas_pet";

export async function generateFixturePetBundle(rootDir = process.cwd()): Promise<void> {
  const bundleDir = path.join(rootDir, fixtureDir);
  await mkdir(path.join(bundleDir, "atlases"), { recursive: true });

  await writeFile(path.join(bundleDir, "atlases/main.png"), createAtlasPng());
  await writeFile(path.join(bundleDir, "preview.png"), createPreviewPng());
  await writeFile(path.join(bundleDir, "source.meta.json"), `${JSON.stringify(sourceMeta(), null, 2)}\n`);
  await writeFile(path.join(bundleDir, "pet.json"), `${JSON.stringify(manifest(), null, 2)}\n`);
}

function manifest(): Record<string, unknown> {
  return {
    schemaVersion: "0.1.0",
    id: "valid_minimal_atlas_pet",
    name: "Valid Minimal Atlas Pet",
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
    sourceType: "synthetic-geometric-shapes",
    license: "project-owned-test-fixture",
    containsPersonalImage: false,
    containsExternalAsset: false
  };
}

function createAtlasPng(): Buffer {
  const png = new PNG({ width: 1024, height: 512 });
  for (let frameIndex = 0; frameIndex < 8; frameIndex += 1) {
    drawPetFrame(png, (frameIndex % 4) * 256, Math.floor(frameIndex / 4) * 256, frameIndex);
  }
  return PNG.sync.write(png);
}

function createPreviewPng(): Buffer {
  const png = new PNG({ width: 256, height: 256 });
  drawPetFrame(png, 0, 0, 1);
  return PNG.sync.write(png);
}

function drawPetFrame(png: PNG, offsetX: number, offsetY: number, frameIndex: number): void {
  const bounce = frameIndex % 3;
  const react = frameIndex >= 4;
  const bodyColor = react ? [255, 180, 92] : [83, 184, 228];
  const earColor = react ? [245, 126, 92] : [42, 139, 202];
  const eyeColor = [23, 35, 64];

  fillCircle(png, offsetX + 128, offsetY + 142 - bounce * 2, 58, bodyColor, 255);
  fillCircle(png, offsetX + 92, offsetY + 96 - bounce, 24, earColor, 255);
  fillCircle(png, offsetX + 164, offsetY + 96 - bounce, 24, earColor, 255);
  fillCircle(png, offsetX + 109, offsetY + 132 - bounce, react ? 6 : 8, eyeColor, 255);
  fillCircle(png, offsetX + 147, offsetY + 132 - bounce, react ? 6 : 8, eyeColor, 255);

  if (react) {
    fillCircle(png, offsetX + 128, offsetY + 164 - bounce, 10, [255, 255, 255], 255);
    fillRect(png, offsetX + 124, offsetY + 160 - bounce, 8, 8, eyeColor, 255);
    fillCircle(png, offsetX + 70, offsetY + 52, 6, [255, 226, 95], 255);
    fillCircle(png, offsetX + 186, offsetY + 56, 5, [255, 226, 95], 255);
  } else {
    fillRect(png, offsetX + 106, offsetY + 168 - bounce, 44, 7, eyeColor, 255);
  }

  fillRect(png, offsetX + 92, offsetY + 202 - bounce, 72, 8, [38, 90, 150], 180);
}

function fillCircle(
  png: PNG,
  centerX: number,
  centerY: number,
  radius: number,
  rgb: number[],
  alpha: number
): void {
  for (let y = centerY - radius; y <= centerY + radius; y += 1) {
    for (let x = centerX - radius; x <= centerX + radius; x += 1) {
      const dx = x - centerX;
      const dy = y - centerY;
      if (dx * dx + dy * dy <= radius * radius) {
        setPixel(png, x, y, rgb, alpha);
      }
    }
  }
}

function fillRect(png: PNG, x: number, y: number, width: number, height: number, rgb: number[], alpha: number): void {
  for (let yy = y; yy < y + height; yy += 1) {
    for (let xx = x; xx < x + width; xx += 1) {
      setPixel(png, xx, yy, rgb, alpha);
    }
  }
}

function setPixel(png: PNG, x: number, y: number, rgb: number[], alpha: number): void {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height) {
    return;
  }
  const index = (png.width * y + x) << 2;
  png.data[index] = rgb[0] ?? 0;
  png.data[index + 1] = rgb[1] ?? 0;
  png.data[index + 2] = rgb[2] ?? 0;
  png.data[index + 3] = alpha;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  generateFixturePetBundle()
    .then(() => {
      console.log(`Generated ${fixtureDir}`);
    })
    .catch((error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    });
}

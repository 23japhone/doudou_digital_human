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
    name: "兜兜二次元数字人占位",
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
  const yShift = -bounce * 2;
  const react = frameIndex >= 4;
  const blink = frameIndex === 2;
  const hairColor = [54, 48, 88];
  const hairShade = [82, 63, 125];
  const skinColor = [255, 214, 190];
  const eyeColor = [30, 34, 62];
  const outfitColor = [92, 121, 214];
  const outfitShade = [62, 77, 154];
  const blushColor = [255, 139, 156];
  const accentColor = [255, 226, 95];

  fillEllipse(png, offsetX + 128, offsetY + 224 + yShift, 50, 8, [34, 42, 80], 92);
  fillEllipse(png, offsetX + 128, offsetY + 198 + yShift, 44, 34, outfitColor, 255);
  fillEllipse(png, offsetX + 99, offsetY + 202 + yShift, 14, 24, outfitShade, 255);
  fillEllipse(png, offsetX + 157, offsetY + 202 + yShift, 14, 24, outfitShade, 255);
  fillCircle(png, offsetX + 88, offsetY + 202 + yShift, 9, skinColor, 255);
  fillCircle(png, offsetX + 168, offsetY + 202 + yShift, 9, skinColor, 255);
  fillRect(png, offsetX + 117, offsetY + 164 + yShift, 22, 23, skinColor, 255);

  fillEllipse(png, offsetX + 128, offsetY + 107 + yShift, 54, 58, hairColor, 255);
  fillEllipse(png, offsetX + 90, offsetY + 127 + yShift, 15, 48, hairColor, 255);
  fillEllipse(png, offsetX + 166, offsetY + 127 + yShift, 15, 48, hairColor, 255);
  fillEllipse(png, offsetX + 128, offsetY + 124 + yShift, 42, 46, skinColor, 255);

  fillTriangle(
    png,
    offsetX + 92,
    offsetY + 88 + yShift,
    offsetX + 125,
    offsetY + 78 + yShift,
    offsetX + 113,
    offsetY + 118 + yShift,
    hairShade,
    255
  );
  fillTriangle(
    png,
    offsetX + 118,
    offsetY + 76 + yShift,
    offsetX + 158,
    offsetY + 87 + yShift,
    offsetX + 139,
    offsetY + 119 + yShift,
    hairColor,
    255
  );
  fillCircle(png, offsetX + 100, offsetY + 86 + yShift, 12, hairShade, 255);
  fillCircle(png, offsetX + 158, offsetY + 88 + yShift, 11, hairColor, 255);

  fillTriangle(
    png,
    offsetX + 112,
    offsetY + 179 + yShift,
    offsetX + 128,
    offsetY + 190 + yShift,
    offsetX + 144,
    offsetY + 179 + yShift,
    [255, 242, 176],
    255
  );

  if (blink && !react) {
    fillRect(png, offsetX + 106, offsetY + 123 + yShift, 13, 3, eyeColor, 255);
    fillRect(png, offsetX + 137, offsetY + 123 + yShift, 13, 3, eyeColor, 255);
  } else {
    fillEllipse(png, offsetX + 112, offsetY + 123 + yShift, react ? 6 : 5, react ? 8 : 7, eyeColor, 255);
    fillEllipse(png, offsetX + 144, offsetY + 123 + yShift, react ? 6 : 5, react ? 8 : 7, eyeColor, 255);
    fillCircle(png, offsetX + 114, offsetY + 120 + yShift, 2, [255, 255, 255], 255);
    fillCircle(png, offsetX + 146, offsetY + 120 + yShift, 2, [255, 255, 255], 255);
  }

  if (react) {
    fillEllipse(png, offsetX + 128, offsetY + 148 + yShift, 7, 10, eyeColor, 255);
    fillCircle(png, offsetX + 75, offsetY + 58, 6, accentColor, 255);
    fillCircle(png, offsetX + 184, offsetY + 62, 5, accentColor, 255);
    fillCircle(png, offsetX + 75, offsetY + 58, 2, [255, 255, 255], 255);
  } else {
    fillRect(png, offsetX + 119, offsetY + 148 + yShift, 18, 3, eyeColor, 255);
  }

  fillEllipse(png, offsetX + 104, offsetY + 141 + yShift, 5, 3, blushColor, 180);
  fillEllipse(png, offsetX + 152, offsetY + 141 + yShift, 5, 3, blushColor, 180);
}

function fillEllipse(
  png: PNG,
  centerX: number,
  centerY: number,
  radiusX: number,
  radiusY: number,
  rgb: number[],
  alpha: number
): void {
  for (let y = centerY - radiusY; y <= centerY + radiusY; y += 1) {
    for (let x = centerX - radiusX; x <= centerX + radiusX; x += 1) {
      const dx = (x - centerX) / radiusX;
      const dy = (y - centerY) / radiusY;
      if (dx * dx + dy * dy <= 1) {
        setPixel(png, x, y, rgb, alpha);
      }
    }
  }
}

function fillTriangle(
  png: PNG,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
  rgb: number[],
  alpha: number
): void {
  const minX = Math.floor(Math.min(x1, x2, x3));
  const maxX = Math.ceil(Math.max(x1, x2, x3));
  const minY = Math.floor(Math.min(y1, y2, y3));
  const maxY = Math.ceil(Math.max(y1, y2, y3));
  const area = edgeFunction(x1, y1, x2, y2, x3, y3);

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const w1 = edgeFunction(x2, y2, x3, y3, x, y);
      const w2 = edgeFunction(x3, y3, x1, y1, x, y);
      const w3 = edgeFunction(x1, y1, x2, y2, x, y);
      if ((area >= 0 && w1 >= 0 && w2 >= 0 && w3 >= 0) || (area < 0 && w1 <= 0 && w2 <= 0 && w3 <= 0)) {
        setPixel(png, x, y, rgb, alpha);
      }
    }
  }
}

function edgeFunction(ax: number, ay: number, bx: number, by: number, cx: number, cy: number): number {
  return (cx - ax) * (by - ay) - (cy - ay) * (bx - ax);
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

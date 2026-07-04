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
  const pose = doudouFramePose(frameIndex);
  const yShift = pose.yShift;
  const headX = pose.headX;
  const hairColor = [54, 48, 88];
  const hairShade = [82, 63, 125];
  const hairHighlight = [184, 156, 216];
  const skinColor = [255, 214, 190];
  const eyeColor = [30, 34, 62];
  const outfitColor = [92, 121, 214];
  const outfitShade = [62, 77, 154];
  const blushColor = [255, 139, 156];
  const accentColor = [255, 226, 95];
  const tearColor = [132, 202, 255];

  fillEllipse(png, offsetX + 128, offsetY + 226 + yShift, 58, 8, [34, 42, 80], 90);
  fillEllipse(png, offsetX + 128, offsetY + 198 + yShift, 58, 40, outfitColor, 255);
  fillEllipse(png, offsetX + 96 + pose.armOffset, offsetY + 202 + yShift, 15, 27, outfitShade, 255);
  fillEllipse(png, offsetX + 160 + pose.armOffset, offsetY + 202 + yShift, 15, 27, outfitShade, 255);
  fillCircle(png, offsetX + 84 + pose.armOffset, offsetY + 202 + yShift, 9, skinColor, 255);
  fillCircle(png, offsetX + 172 + pose.armOffset, offsetY + 202 + yShift, 9, skinColor, 255);
  fillRect(png, offsetX + 116, offsetY + 163 + yShift, 24, 25, skinColor, 255);

  fillEllipse(png, offsetX + 128 + headX, offsetY + 106 + yShift, 57, 61, hairColor, 255);
  fillEllipse(png, offsetX + 87 + headX, offsetY + 128 + yShift, 14, 50, hairColor, 255);
  fillEllipse(png, offsetX + 169 + headX, offsetY + 128 + yShift, 14, 50, hairColor, 255);
  fillEllipse(png, offsetX + 128 + headX, offsetY + 124 + yShift, 43, 47, skinColor, 255);

  fillTriangle(
    png,
    offsetX + 93 + headX,
    offsetY + 88 + yShift,
    offsetX + 126 + headX,
    offsetY + 77 + yShift,
    offsetX + 114 + headX,
    offsetY + 117 + yShift,
    hairShade,
    255
  );
  fillTriangle(
    png,
    offsetX + 118 + headX,
    offsetY + 76 + yShift,
    offsetX + 159 + headX,
    offsetY + 87 + yShift,
    offsetX + 140 + headX,
    offsetY + 118 + yShift,
    hairColor,
    255
  );
  fillTriangle(
    png,
    offsetX + 129 + headX,
    offsetY + 78 + yShift,
    offsetX + 151 + headX,
    offsetY + 92 + yShift,
    offsetX + 135 + headX,
    offsetY + 113 + yShift,
    hairShade,
    255
  );
  fillCircle(png, offsetX + 100 + headX, offsetY + 86 + yShift, 12, hairShade, 255);
  fillCircle(png, offsetX + 158 + headX, offsetY + 88 + yShift, 11, hairColor, 255);
  fillRect(png, offsetX + 127 + headX, offsetY + 78 + yShift, 21, 3, hairHighlight, 255);

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
  fillTriangle(
    png,
    offsetX + 97,
    offsetY + 176 + yShift,
    offsetX + 120,
    offsetY + 190 + yShift,
    offsetX + 114,
    offsetY + 172 + yShift,
    [255, 242, 176],
    255
  );
  fillTriangle(
    png,
    offsetX + 159,
    offsetY + 176 + yShift,
    offsetX + 136,
    offsetY + 190 + yShift,
    offsetX + 142,
    offsetY + 172 + yShift,
    [255, 242, 176],
    255
  );

  drawDoudouEyes(png, offsetX + headX, offsetY + yShift, pose.expression, eyeColor);
  drawDoudouMouth(png, offsetX + headX, offsetY + yShift, pose.expression, eyeColor);

  fillEllipse(
    png,
    offsetX + 104 + headX,
    offsetY + 141 + yShift,
    5,
    3,
    blushColor,
    pose.expression === "annoyed" ? 230 : 180
  );
  fillEllipse(
    png,
    offsetX + 152 + headX,
    offsetY + 141 + yShift,
    5,
    3,
    blushColor,
    pose.expression === "annoyed" ? 230 : 180
  );

  if (pose.expression === "surprised") {
    fillCircle(png, offsetX + 75, offsetY + 58, 6, accentColor, 255);
    fillCircle(png, offsetX + 184, offsetY + 62, 5, accentColor, 255);
    fillCircle(png, offsetX + 75, offsetY + 58, 2, [255, 255, 255], 255);
  }
  if (pose.expression === "curious") {
    fillCircle(png, offsetX + 184, offsetY + 72, 4, accentColor, 255);
    fillRect(png, offsetX + 183, offsetY + 60, 3, 8, accentColor, 255);
    fillCircle(png, offsetX + 185, offsetY + 58, 5, accentColor, 255);
  }
  if (pose.expression === "teary") {
    fillEllipse(png, offsetX + 107 + headX, offsetY + 137 + yShift, 3, 8, tearColor, 255);
    fillEllipse(png, offsetX + 149 + headX, offsetY + 137 + yShift, 3, 8, tearColor, 255);
    fillCircle(png, offsetX + 108 + headX, offsetY + 134 + yShift, 2, [235, 249, 255], 255);
  }
  if (pose.expression === "working") {
    fillRect(png, offsetX + 106, offsetY + 195 + yShift, 44, 14, accentColor, 255);
    fillRect(png, offsetX + 110, offsetY + 198 + yShift, 36, 3, [255, 248, 186], 255);
    fillRect(png, offsetX + 114, offsetY + 204 + yShift, 28, 2, outfitShade, 255);
  }
}

function doudouFramePose(frameIndex: number): {
  armOffset: number;
  expression: "idle" | "blink" | "curious" | "surprised" | "annoyed" | "teary" | "working";
  headX: number;
  yShift: number;
} {
  switch (frameIndex) {
    case 1:
      return { armOffset: 1, expression: "idle", headX: 0, yShift: -3 };
    case 2:
      return { armOffset: 0, expression: "blink", headX: 0, yShift: -1 };
    case 3:
      return { armOffset: 0, expression: "curious", headX: -3, yShift: -2 };
    case 4:
      return { armOffset: -1, expression: "surprised", headX: 0, yShift: -6 };
    case 5:
      return { armOffset: -2, expression: "annoyed", headX: -2, yShift: -2 };
    case 6:
      return { armOffset: 1, expression: "teary", headX: 2, yShift: 1 };
    case 7:
      return { armOffset: 0, expression: "working", headX: 0, yShift: 0 };
    default:
      return { armOffset: 0, expression: "idle", headX: 0, yShift: 0 };
  }
}

function drawDoudouEyes(
  png: PNG,
  offsetX: number,
  offsetY: number,
  expression: ReturnType<typeof doudouFramePose>["expression"],
  eyeColor: number[]
): void {
  if (expression === "blink") {
    fillRect(png, offsetX + 107, offsetY + 124, 10, 2, eyeColor, 255);
    fillRect(png, offsetX + 139, offsetY + 124, 10, 2, eyeColor, 255);
    return;
  }
  if (expression === "annoyed") {
    fillRect(png, offsetX + 106, offsetY + 122, 13, 4, eyeColor, 255);
    fillRect(png, offsetX + 138, offsetY + 122, 13, 4, eyeColor, 255);
    return;
  }
  if (expression === "teary") {
    fillEllipse(png, offsetX + 112, offsetY + 124, 6, 8, eyeColor, 255);
    fillEllipse(png, offsetX + 144, offsetY + 124, 6, 8, eyeColor, 255);
    fillCircle(png, offsetX + 114, offsetY + 121, 2, [255, 255, 255], 255);
    fillCircle(png, offsetX + 146, offsetY + 121, 2, [255, 255, 255], 255);
    return;
  }
  if (expression === "surprised") {
    fillEllipse(png, offsetX + 112, offsetY + 122, 7, 9, eyeColor, 255);
    fillEllipse(png, offsetX + 144, offsetY + 122, 7, 9, eyeColor, 255);
    fillCircle(png, offsetX + 114, offsetY + 119, 2, [255, 255, 255], 255);
    fillCircle(png, offsetX + 146, offsetY + 119, 2, [255, 255, 255], 255);
    return;
  }
  if (expression === "working") {
    fillEllipse(png, offsetX + 112, offsetY + 123, 5, 6, eyeColor, 255);
    fillEllipse(png, offsetX + 144, offsetY + 123, 5, 6, eyeColor, 255);
    fillRect(png, offsetX + 105, offsetY + 114, 15, 3, eyeColor, 255);
    fillRect(png, offsetX + 137, offsetY + 114, 15, 3, eyeColor, 255);
    return;
  }
  fillEllipse(png, offsetX + 112, offsetY + 123, expression === "curious" ? 6 : 5, 7, eyeColor, 255);
  fillEllipse(png, offsetX + 144, offsetY + 123, 5, 7, eyeColor, 255);
  fillCircle(png, offsetX + 114, offsetY + 120, 2, [255, 255, 255], 255);
  fillCircle(png, offsetX + 146, offsetY + 120, 2, [255, 255, 255], 255);
}

function drawDoudouMouth(
  png: PNG,
  offsetX: number,
  offsetY: number,
  expression: ReturnType<typeof doudouFramePose>["expression"],
  eyeColor: number[]
): void {
  if (expression === "surprised") {
    fillEllipse(png, offsetX + 128, offsetY + 148, 7, 10, eyeColor, 255);
    return;
  }
  if (expression === "annoyed") {
    fillRect(png, offsetX + 108, offsetY + 147, 40, 4, eyeColor, 255);
    fillRect(png, offsetX + 109, offsetY + 151, 38, 2, eyeColor, 255);
    return;
  }
  if (expression === "teary") {
    fillRect(png, offsetX + 119, offsetY + 150, 18, 3, eyeColor, 255);
    fillRect(png, offsetX + 116, offsetY + 147, 5, 3, eyeColor, 255);
    return;
  }
  if (expression === "working") {
    fillRect(png, offsetX + 120, offsetY + 148, 16, 3, eyeColor, 255);
    return;
  }
  if (expression === "curious") {
    fillEllipse(png, offsetX + 128, offsetY + 148, 4, 5, eyeColor, 255);
    return;
  }
  fillRect(png, offsetX + 119, offsetY + 148, 18, 3, eyeColor, 255);
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

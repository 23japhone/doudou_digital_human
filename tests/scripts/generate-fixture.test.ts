import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { PNG } from "pngjs";
import { afterEach, describe, expect, test } from "vitest";
import { analyzeDoudouSpriteAtlasQuality } from "../../src/generation/doudou-sprite-quality.js";
import { generateFixturePetBundle } from "../../src/scripts/generate-fixture.js";

const tempDirs: string[] = [];
const fixtureRelativeDir = path.join("fixtures", "pet_bundles", "valid_minimal_atlas_pet");
const fixtureFiles = ["pet.json", "source.meta.json", "preview.png", path.join("atlases", "main.png")];
const palette = {
  cardigan: [238, 190, 78],
  sailor: [42, 48, 78],
  ribbon: [190, 48, 58],
  hairMain: [108, 70, 42],
  hairShade: [72, 46, 32],
  eye: [30, 34, 62],
  skin: [255, 214, 190],
  tear: [132, 202, 255]
} as const;

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { force: true, recursive: true })));
});

describe("generateFixturePetBundle", () => {
  test("generates a rights-safe AIG-inspired default doudou anime digital-human", async () => {
    const rootDir = await createTempDir();

    await generateFixturePetBundle(rootDir);

    const bundleDir = path.join(rootDir, fixtureRelativeDir);
    const manifest = JSON.parse(await readFile(path.join(bundleDir, "pet.json"), "utf8")) as {
      id: string;
      name: string;
      privacy: { sourceImageStored: boolean; cloudGenerated: boolean };
    };
    const sourceMeta = JSON.parse(await readFile(path.join(bundleDir, "source.meta.json"), "utf8")) as {
      containsExternalAsset: boolean;
      containsPersonalImage: boolean;
      sourceType: string;
    };
    const preview = PNG.sync.read(await readFile(path.join(bundleDir, "preview.png")));

    expect(manifest).toMatchObject({
      id: "valid_minimal_atlas_pet",
      name: "兜兜 AIG 默认二次元数字人",
      privacy: {
        sourceImageStored: false,
        cloudGenerated: false
      }
    });
    expect(sourceMeta).toMatchObject({
      containsExternalAsset: false,
      containsPersonalImage: false,
      sourceType: "authorized-aig-character-sprite"
    });

    expect(pixelAt(preview, 128, 72)).toEqual([108, 70, 42, 255]);
    expect(pixelAt(preview, 95, 91)).toEqual([190, 48, 58, 255]);
    expect(pixelAt(preview, 128, 124)).toEqual([255, 214, 190, 255]);
    expect(pixelAt(preview, 128, 198)).toEqual([238, 190, 78, 255]);
    expect(pixelAt(preview, 128, 214)).toEqual([42, 48, 78, 255]);
    expect(pixelAt(preview, 68, 96)[3]).toBe(0);
    expect(pixelAt(preview, 188, 96)[3]).toBe(0);
  });

  test("keeps the committed fixture synchronized with the generator", async () => {
    const rootDir = await createTempDir();
    await generateFixturePetBundle(rootDir);

    for (const relativeFile of fixtureFiles) {
      const generated = await readFile(path.join(rootDir, fixtureRelativeDir, relativeFile));
      const committed = await readFile(path.resolve(fixtureRelativeDir, relativeFile));
      expect(generated).toEqual(committed);
    }
  });

  test("draws eight distinct default doudou sprite frames", async () => {
    const rootDir = await createTempDir();
    await generateFixturePetBundle(rootDir);
    const atlas = PNG.sync.read(await readFile(path.join(rootDir, fixtureRelativeDir, "atlases", "main.png")));

    const signatures = Array.from({ length: 8 }, (_unused, frameIndex) => frameSignature(atlas, frameIndex));

    expect(new Set(signatures).size).toBe(8);
    expect(analyzeDoudouSpriteAtlasQuality(atlas)).toMatchObject({ ok: true, issues: [] });
  });

  test("preserves brown hair, face, yellow cardigan, sailor outfit, and red ribbon readability at 256px and 128px", async () => {
    const rootDir = await createTempDir();
    await generateFixturePetBundle(rootDir);
    const atlas = PNG.sync.read(await readFile(path.join(rootDir, fixtureRelativeDir, "atlases", "main.png")));

    for (let frameIndex = 0; frameIndex < 8; frameIndex += 1) {
      const frame = framePng(atlas, frameIndex);
      const smallFrame = downscaleNearest(frame, 128, 128);

      expect(countApproxColor(frame, palette.hairMain) + countApproxColor(frame, palette.hairShade)).toBeGreaterThan(6600);
      expect(countApproxColor(frame, palette.skin)).toBeGreaterThan(2800);
      expect(countApproxColor(frame, palette.cardigan)).toBeGreaterThan(1600);
      expect(countApproxColor(frame, palette.sailor)).toBeGreaterThan(600);
      expect(countApproxColor(frame, palette.ribbon)).toBeGreaterThan(180);
      expect(countApproxColor(smallFrame, palette.hairMain) + countApproxColor(smallFrame, palette.hairShade)).toBeGreaterThan(
        1450
      );
      expect(countApproxColor(smallFrame, palette.skin)).toBeGreaterThan(650);
      expect(countApproxColor(smallFrame, palette.cardigan)).toBeGreaterThan(390);
      expect(countApproxColor(smallFrame, palette.sailor)).toBeGreaterThan(145);
      expect(countApproxColor(smallFrame, palette.ribbon)).toBeGreaterThan(35);
      expect(pixelAt(frame, 68, 96)[3]).toBe(0);
      expect(pixelAt(frame, 188, 96)[3]).toBe(0);
    }
  });

  test("locks small-size readable core expressions across the eight-frame atlas", async () => {
    const rootDir = await createTempDir();
    await generateFixturePetBundle(rootDir);
    const atlas = PNG.sync.read(await readFile(path.join(rootDir, fixtureRelativeDir, "atlases", "main.png")));
    const idleFrame = framePng(atlas, 1);
    const blinkFrame = framePng(atlas, 2);
    const surprisedFrame = framePng(atlas, 4);
    const poutFrame = framePng(atlas, 5);
    const tearyFrame = framePng(atlas, 6);
    const workingFrame = framePng(atlas, 7);

    expect(countApproxColor(blinkFrame, palette.eye, 12, { x: 100, y: 116, width: 56, height: 16 })).toBeLessThan(
      countApproxColor(idleFrame, palette.eye, 12, { x: 100, y: 116, width: 56, height: 16 }) * 0.7
    );
    expect(countApproxColor(surprisedFrame, palette.eye, 12, { x: 118, y: 140, width: 22, height: 24 })).toBeGreaterThan(110);
    expect(countApproxColor(poutFrame, palette.eye, 12, { x: 108, y: 143, width: 40, height: 14 })).toBeGreaterThan(95);
    expect(countApproxColor(poutFrame, palette.eye, 12, { x: 120, y: 150, width: 18, height: 18 })).toBeLessThan(55);
    expect(countApproxColor(tearyFrame, palette.tear, 12)).toBeGreaterThan(35);
    expect(countApproxColor(workingFrame, palette.cardigan, 12, { x: 91, y: 171, width: 74, height: 36 })).toBeGreaterThan(
      120
    );
  });
});

async function createTempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "doudou-fixture-test-"));
  tempDirs.push(dir);
  return dir;
}

function pixelAt(png: PNG, x: number, y: number): [number, number, number, number] {
  const index = (png.width * y + x) << 2;
  return [png.data[index], png.data[index + 1], png.data[index + 2], png.data[index + 3]];
}

function framePng(atlas: PNG, frameIndex: number): PNG {
  const frame = new PNG({ width: 256, height: 256 });
  const offsetX = (frameIndex % 4) * 256;
  const offsetY = Math.floor(frameIndex / 4) * 256;
  for (let y = 0; y < 256; y += 1) {
    for (let x = 0; x < 256; x += 1) {
      const sourceIndex = (atlas.width * (offsetY + y) + offsetX + x) << 2;
      const targetIndex = (frame.width * y + x) << 2;
      frame.data[targetIndex] = atlas.data[sourceIndex];
      frame.data[targetIndex + 1] = atlas.data[sourceIndex + 1];
      frame.data[targetIndex + 2] = atlas.data[sourceIndex + 2];
      frame.data[targetIndex + 3] = atlas.data[sourceIndex + 3];
    }
  }
  return frame;
}

function downscaleNearest(source: PNG, targetWidth: number, targetHeight: number): PNG {
  const target = new PNG({ width: targetWidth, height: targetHeight });
  for (let y = 0; y < targetHeight; y += 1) {
    for (let x = 0; x < targetWidth; x += 1) {
      const sourceX = Math.floor((x / targetWidth) * source.width);
      const sourceY = Math.floor((y / targetHeight) * source.height);
      const sourceIndex = (source.width * sourceY + sourceX) << 2;
      const targetIndex = (target.width * y + x) << 2;
      target.data[targetIndex] = source.data[sourceIndex];
      target.data[targetIndex + 1] = source.data[sourceIndex + 1];
      target.data[targetIndex + 2] = source.data[sourceIndex + 2];
      target.data[targetIndex + 3] = source.data[sourceIndex + 3];
    }
  }
  return target;
}

function frameSignature(atlas: PNG, frameIndex: number): string {
  const frame = framePng(atlas, frameIndex);
  let hash = 0;
  for (let index = 0; index < frame.data.length; index += 4) {
    if (frame.data[index + 3] === 0) {
      continue;
    }
    hash = (hash * 33 + frame.data[index] * 3 + frame.data[index + 1] * 5 + frame.data[index + 2] * 7 + index) >>> 0;
  }
  return hash.toString(16);
}

function countApproxColor(
  png: PNG,
  rgb: readonly number[],
  tolerance = 8,
  region: { x: number; y: number; width: number; height: number } = { x: 0, y: 0, width: png.width, height: png.height }
): number {
  let count = 0;
  for (let y = region.y; y < region.y + region.height; y += 1) {
    for (let x = region.x; x < region.x + region.width; x += 1) {
      const [red, green, blue, alpha] = pixelAt(png, x, y);
      if (alpha === 0) {
        continue;
      }
      if (
        Math.abs(red - (rgb[0] ?? 0)) <= tolerance &&
        Math.abs(green - (rgb[1] ?? 0)) <= tolerance &&
        Math.abs(blue - (rgb[2] ?? 0)) <= tolerance
      ) {
        count += 1;
      }
    }
  }
  return count;
}

import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { PNG } from "pngjs";
import { afterEach, describe, expect, test } from "vitest";
import { generateFixturePetBundle } from "../../src/scripts/generate-fixture.js";

const tempDirs: string[] = [];
const fixtureRelativeDir = path.join("fixtures", "pet_bundles", "valid_minimal_atlas_pet");
const fixtureFiles = ["pet.json", "source.meta.json", "preview.png", path.join("atlases", "main.png")];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { force: true, recursive: true })));
});

describe("generateFixturePetBundle", () => {
  test("generates a rights-safe default doudou anime digital-human placeholder", async () => {
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
      name: "兜兜二次元数字人占位",
      privacy: {
        sourceImageStored: false,
        cloudGenerated: false
      }
    });
    expect(sourceMeta).toMatchObject({
      containsExternalAsset: false,
      containsPersonalImage: false,
      sourceType: "synthetic-geometric-shapes"
    });

    expect(pixelAt(preview, 128, 72)).toEqual([54, 48, 88, 255]);
    expect(pixelAt(preview, 128, 124)).toEqual([255, 214, 190, 255]);
    expect(pixelAt(preview, 128, 198)).toEqual([92, 121, 214, 255]);
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

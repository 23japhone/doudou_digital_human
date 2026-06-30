import { mkdtemp, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { PNG } from "pngjs";
import { afterEach, describe, expect, test } from "vitest";
import { prepareGuidedAppSmokeSource } from "../../src/scripts/app-smoke.js";
import { resolveLiveSmokeSourceImage } from "../../src/scripts/app-live-smoke.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { force: true, recursive: true })));
});

describe("app smoke source selection", () => {
  test("uses an explicitly provided source image without copying it into the smoke temp root", async () => {
    const workspace = await createTempDir();
    const externalSource = path.join(workspace, "uploaded.jpg");
    const tempRoot = path.join(workspace, "smoke-temp");
    await writeFile(externalSource, createPngSource());

    const sourceImagePath = await prepareGuidedAppSmokeSource({ sourceImagePath: externalSource }, tempRoot);

    expect(sourceImagePath).toBe(externalSource);
    await expect(readdir(tempRoot)).rejects.toMatchObject({ code: "ENOENT" });
  });

  test("creates a synthetic source image only when no explicit source is provided", async () => {
    const workspace = await createTempDir();
    const tempRoot = path.join(workspace, "smoke-temp");

    const sourceImagePath = await prepareGuidedAppSmokeSource({}, tempRoot);

    expect(sourceImagePath).toBe(path.join(tempRoot, "source.png"));
    await expect(stat(sourceImagePath)).resolves.toMatchObject({ isFile: expect.any(Function) });
  });

  test("resolves live smoke source image from --source before environment fallback", () => {
    expect(
      resolveLiveSmokeSourceImage([
        "node",
        "app-live-smoke",
        "--source",
        "/tmp/from-flag.jpg"
      ], {
        DOUDOU_APP_SMOKE_SOURCE_IMAGE: "/tmp/from-env.jpg"
      })
    ).toBe("/tmp/from-flag.jpg");
    expect(resolveLiveSmokeSourceImage(["node", "app-live-smoke"], {
      DOUDOU_APP_SMOKE_SOURCE_IMAGE: "/tmp/from-env.jpg"
    })).toBe("/tmp/from-env.jpg");
  });
});

async function createTempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "app-smoke-test-"));
  tempDirs.push(dir);
  return dir;
}

function createPngSource(width = 32, height = 32): Buffer {
  const png = new PNG({ width, height });
  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      const index = (png.width * y + x) << 2;
      png.data[index] = 96 + (x % 60);
      png.data[index + 1] = 144 + (y % 60);
      png.data[index + 2] = 220;
      png.data[index + 3] = 255;
    }
  }
  return PNG.sync.write(png);
}

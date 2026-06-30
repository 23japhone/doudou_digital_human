import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { encode as encodeJpeg } from "jpeg-js";
import { PNG } from "pngjs";
import { afterEach, describe, expect, test } from "vitest";
import { runGeneratePetCli } from "../../src/cli/generate-pet.js";
import { generatePetBundleFromSource } from "../../src/generation/generate-pet.js";
import { validatePetBundle } from "../../src/pet_bundle/validate.js";

const tempDirs: string[] = [];
const fixedNow = new Date("2026-06-30T12:00:00.000Z");

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { force: true, recursive: true })));
});

describe("generatePetBundleFromSource", () => {
  test("generates a validated v0.1 bundle from a local PNG without copying the source image", async () => {
    const workspace = await createTempDir();
    const sourcePath = path.join(workspace, "input.png");
    const outputDir = path.join(workspace, "generated_pet");
    const sourceBytes = createPngSource();
    await writeFile(sourcePath, sourceBytes);

    const result = await generatePetBundleFromSource({
      sourceImagePath: sourcePath,
      outputBundleDir: outputDir,
      now: fixedNow
    });

    const validated = await validatePetBundle(outputDir);
    expect(validated.manifest.id).toBe(result.manifest.id);
    expect(result.sourceImage.mime).toBe("image/png");
    expect(result.sourceImage).not.toHaveProperty("absolutePath");
    expect(await listRelativeFiles(outputDir)).toEqual([
      "atlases/main.png",
      "pet.json",
      "preview.png",
      "source.meta.json"
    ]);
    await expect(stat(path.join(outputDir, "input.png"))).rejects.toMatchObject({ code: "ENOENT" });

    const sourceMeta = JSON.parse(await readFile(path.join(outputDir, "source.meta.json"), "utf8")) as Record<string, unknown>;
    expect(Object.keys(sourceMeta).sort()).toEqual([
      "createdAt",
      "fixture",
      "generatedBy",
      "inputBytes",
      "inputMime",
      "sourceImageStored",
      "sourceType"
    ]);
    expect(sourceMeta).toMatchObject({
      fixture: false,
      generatedBy: "src/generation/generate-pet.ts",
      sourceType: "local-image-intake",
      inputMime: "image/png",
      inputBytes: sourceBytes.length,
      createdAt: fixedNow.toISOString(),
      sourceImageStored: false
    });
    expect(JSON.stringify(sourceMeta)).not.toContain(sourcePath);
  });

  test("generates a validated v0.1 bundle from a local JPEG", async () => {
    const workspace = await createTempDir();
    const sourcePath = path.join(workspace, "input.jpg");
    const outputDir = path.join(workspace, "generated_jpeg_pet");
    const sourceBytes = createJpegSource(32, 24);
    await writeFile(sourcePath, sourceBytes);

    const result = await generatePetBundleFromSource({
      sourceImagePath: sourcePath,
      outputBundleDir: outputDir,
      now: fixedNow
    });

    await expect(validatePetBundle(outputDir)).resolves.toMatchObject({
      manifest: expect.objectContaining({ schemaVersion: "0.1.0" })
    });
    expect(result.sourceImage.mime).toBe("image/jpeg");
    const sourceMeta = JSON.parse(await readFile(path.join(outputDir, "source.meta.json"), "utf8")) as Record<string, unknown>;
    expect(sourceMeta.inputMime).toBe("image/jpeg");
    expect(sourceMeta.inputBytes).toBe(sourceBytes.length);
  });

  test("rejects a JPEG header that cannot be fully decoded", async () => {
    const workspace = await createTempDir();
    const sourcePath = path.join(workspace, "header-only.jpg");
    await writeFile(sourcePath, createJpegHeaderOnlySource(32, 24));

    await expect(
      generatePetBundleFromSource({
        sourceImagePath: sourcePath,
        outputBundleDir: path.join(workspace, "out"),
        now: fixedNow
      })
    ).rejects.toMatchObject({ code: "INVALID_SOURCE_IMAGE" });
  });

  test("CLI writes a generated bundle and returns zero", async () => {
    const workspace = await createTempDir();
    const sourcePath = path.join(workspace, "input.png");
    const outputDir = path.join(workspace, "cli_pet");
    await writeFile(sourcePath, createPngSource());

    const exitCode = await runGeneratePetCli(["node", "generate-pet", sourcePath, outputDir], { now: fixedNow });

    expect(exitCode).toBe(0);
    await expect(validatePetBundle(outputDir)).resolves.toMatchObject({
      manifest: expect.objectContaining({ id: "generated_local_pet" })
    });
  });

  test.each([
    ["remote URL", "https://example.invalid/source.png", "REMOTE_SOURCE_UNSUPPORTED"],
    ["file URI", "file:///Users/example/private/source.png", "SOURCE_URI_UNSUPPORTED"],
    ["relative traversal", "../private/source.png", "UNSAFE_SOURCE_PATH"]
  ])("rejects %s input before filesystem access", async (_label, sourceImagePath, code) => {
    const workspace = await createTempDir();
    await expect(
      generatePetBundleFromSource({
        sourceImagePath,
        outputBundleDir: path.join(workspace, "out"),
        now: fixedNow
      })
    ).rejects.toMatchObject({ code });
  });

  test("rejects a directory input", async () => {
    const workspace = await createTempDir();
    const sourceDir = path.join(workspace, "source-dir");
    await mkdir(sourceDir);

    await expect(
      generatePetBundleFromSource({
        sourceImagePath: sourceDir,
        outputBundleDir: path.join(workspace, "out"),
        now: fixedNow
      })
    ).rejects.toMatchObject({ code: "SOURCE_IMAGE_NOT_FILE" });
  });

  test("rejects a missing source image file", async () => {
    const workspace = await createTempDir();

    await expect(
      generatePetBundleFromSource({
        sourceImagePath: path.join(workspace, "missing.png"),
        outputBundleDir: path.join(workspace, "out"),
        now: fixedNow
      })
    ).rejects.toMatchObject({ code: "SOURCE_IMAGE_NOT_FOUND" });
  });

  test("rejects unsupported non-image input", async () => {
    const workspace = await createTempDir();
    const sourcePath = path.join(workspace, "notes.txt");
    await writeFile(sourcePath, "not an image");

    await expect(
      generatePetBundleFromSource({
        sourceImagePath: sourcePath,
        outputBundleDir: path.join(workspace, "out"),
        now: fixedNow
      })
    ).rejects.toMatchObject({ code: "UNSUPPORTED_SOURCE_IMAGE_TYPE" });
  });

  test("rejects a corrupt PNG input", async () => {
    const workspace = await createTempDir();
    const sourcePath = path.join(workspace, "corrupt.png");
    await writeFile(sourcePath, Buffer.from("89504e470d0a1a0a00000000", "hex"));

    await expect(
      generatePetBundleFromSource({
        sourceImagePath: sourcePath,
        outputBundleDir: path.join(workspace, "out"),
        now: fixedNow
      })
    ).rejects.toMatchObject({ code: "INVALID_SOURCE_IMAGE" });
  });

  test("rejects a corrupt JPEG input", async () => {
    const workspace = await createTempDir();
    const sourcePath = path.join(workspace, "corrupt.jpg");
    await writeFile(sourcePath, Buffer.from([0xff, 0xd8, 0xff, 0xd9]));

    await expect(
      generatePetBundleFromSource({
        sourceImagePath: sourcePath,
        outputBundleDir: path.join(workspace, "out"),
        now: fixedNow
      })
    ).rejects.toMatchObject({ code: "INVALID_SOURCE_IMAGE" });
  });
});

async function createTempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "generate-pet-"));
  tempDirs.push(dir);
  return dir;
}

async function listRelativeFiles(rootDir: string): Promise<string[]> {
  const files: string[] = [];

  async function walk(currentDir: string): Promise<void> {
    for (const entry of await readdir(currentDir, { withFileTypes: true })) {
      const absolutePath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await walk(absolutePath);
      } else if (entry.isFile()) {
        files.push(path.relative(rootDir, absolutePath).split(path.sep).join("/"));
      }
    }
  }

  await walk(rootDir);
  return files.sort();
}

function createPngSource(): Buffer {
  const png = new PNG({ width: 24, height: 24 });
  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      const index = (png.width * y + x) << 2;
      png.data[index] = 80;
      png.data[index + 1] = 170;
      png.data[index + 2] = 220;
      png.data[index + 3] = 255;
    }
  }
  return PNG.sync.write(png);
}

function createJpegSource(width: number, height: number): Buffer {
  const data = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (width * y + x) << 2;
      data[index] = 230;
      data[index + 1] = 145;
      data[index + 2] = 80;
      data[index + 3] = 255;
    }
  }
  return encodeJpeg({ data, width, height }, 80).data;
}

function createJpegHeaderOnlySource(width: number, height: number): Buffer {
  return Buffer.from([
    0xff, 0xd8,
    0xff, 0xe0, 0x00, 0x10,
    0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00,
    0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
    0xff, 0xc0, 0x00, 0x11,
    0x08,
    (height >> 8) & 0xff, height & 0xff,
    (width >> 8) & 0xff, width & 0xff,
    0x03,
    0x01, 0x11, 0x00,
    0x02, 0x11, 0x00,
    0x03, 0x11, 0x00,
    0xff, 0xd9
  ]);
}

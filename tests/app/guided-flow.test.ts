import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { PNG } from "pngjs";
import { afterEach, describe, expect, test } from "vitest";
import { GuidedPetFlow } from "../../src/app/guided-flow.js";
import { validatePetBundle } from "../../src/pet_bundle/validate.js";

const tempDirs: string[] = [];
const fixedNow = new Date("2026-06-30T12:00:00.000Z");

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { force: true, recursive: true })));
});

describe("GuidedPetFlow", () => {
  test("runs local generate, QA, accept, and deletion without exposing the source path in public state", async () => {
    const workspace = await createTempDir();
    const sourcePath = path.join(workspace, "source.png");
    await writeFile(sourcePath, createPngSource());
    const flow = new GuidedPetFlow({
      workspaceDir: path.join(workspace, "app-data"),
      now: fixedNow
    });
    await flow.initialize();

    const selected = await flow.setSourceImagePath(sourcePath);
    expect(selected.sourceImageName).toBe("source.png");
    expect(JSON.stringify(flow.getPublicState())).not.toContain(sourcePath);

    const generated = await flow.generatePet();
    await expect(validatePetBundle(generated.bundleDir)).resolves.toMatchObject({
      manifest: expect.objectContaining({ id: "generated_local_pet" })
    });
    expect(JSON.stringify(flow.getPublicState())).not.toContain(sourcePath);

    const reviewed = await flow.createReview();
    await expect(stat(reviewed.previewPath)).resolves.toMatchObject({ isFile: expect.any(Function) });
    await expect(stat(reviewed.contactSheetPath)).resolves.toMatchObject({ isFile: expect.any(Function) });
    await expect(flow.createReview()).resolves.toMatchObject({
      reportPath: reviewed.reportPath,
      previewPath: reviewed.previewPath,
      contactSheetPath: reviewed.contactSheetPath
    });
    const reportText = await readFile(reviewed.reportPath, "utf8");
    expect(reportText).not.toContain(sourcePath);
    expect(flow.getPublicState()).toMatchObject({
      status: "needs_review",
      petId: "generated_local_pet",
      review: expect.objectContaining({
        previewUrl: expect.stringContaining("preview.png"),
        contactSheetUrl: expect.stringContaining("contact-sheet.png")
      })
    });

    const accepted = await flow.acceptPet();
    await expect(validatePetBundle(accepted.installedBundleDir)).resolves.toMatchObject({
      manifest: expect.objectContaining({ id: "generated_local_pet" })
    });
    expect(flow.getPublicState()).toMatchObject({
      status: "accepted",
      accepted: expect.objectContaining({ petId: "generated_local_pet" })
    });

    const draftDeleted = await flow.deleteDraftAssets();
    expect(draftDeleted.deleted).toBe(true);
    await expect(stat(generated.bundleDir)).rejects.toMatchObject({ code: "ENOENT" });
    await expect(stat(reviewed.reportPath)).rejects.toMatchObject({ code: "ENOENT" });
    expect(flow.getPublicState().accepted?.petId).toBe("generated_local_pet");

    const acceptedDeleted = await flow.deleteAcceptedPet();
    expect(acceptedDeleted.deleted).toBe(true);
    await expect(stat(accepted.installedBundleDir)).rejects.toMatchObject({ code: "ENOENT" });
    expect(flow.getPublicState()).toMatchObject({
      status: "source_selected",
      accepted: null
    });
  });

  test("rejects actions before the required previous step", async () => {
    const workspace = await createTempDir();
    const flow = new GuidedPetFlow({
      workspaceDir: path.join(workspace, "app-data"),
      now: fixedNow
    });
    await flow.initialize();

    await expect(flow.generatePet()).rejects.toMatchObject({ code: "SOURCE_IMAGE_REQUIRED" });
    await expect(flow.createReview()).rejects.toMatchObject({ code: "DRAFT_BUNDLE_REQUIRED" });
    await expect(flow.acceptPet()).rejects.toMatchObject({ code: "DRAFT_BUNDLE_REQUIRED" });
    await expect(flow.launchPet()).rejects.toMatchObject({ code: "ACCEPTED_BUNDLE_REQUIRED" });
  });
});

async function createTempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "guided-flow-"));
  tempDirs.push(dir);
  return dir;
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

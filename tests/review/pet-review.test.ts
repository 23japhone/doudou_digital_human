import { cp, mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { PNG } from "pngjs";
import { afterEach, describe, expect, test } from "vitest";
import { runReviewPetCli } from "../../src/cli/review-pet.js";
import {
  acceptPetBundle,
  createPetReview,
  deletePetAssets,
  PetReviewError
} from "../../src/review/pet-review.js";
import { validatePetBundle } from "../../src/pet_bundle/validate.js";

const tempDirs: string[] = [];
const fixtureBundle = path.resolve("fixtures/pet_bundles/valid_minimal_atlas_pet");
const fixedNow = new Date("2026-06-30T12:00:00.000Z");

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { force: true, recursive: true })));
});

describe("createPetReview", () => {
  test("creates a privacy-safe QA report with preview assets for a valid bundle", async () => {
    const workspace = await createTempDir();
    const reviewDir = path.join(workspace, "review");

    const result = await createPetReview({
      bundleDir: fixtureBundle,
      reviewDir,
      now: fixedNow
    });

    expect(result.report.status).toBe("needs_review");
    expect(result.report.bundle).toMatchObject({
      id: "valid_minimal_atlas_pet",
      name: "兜兜 AIG 默认二次元数字人",
      schemaVersion: "0.1.0",
      privacy: {
        sourceImageStored: false,
        cloudGenerated: false
      }
    });
    expect(result.report.qa.checks.map((check) => check.id)).toEqual([
      "bundle-valid",
      "preview-png",
      "atlas-contact-sheet",
      "privacy-source-not-stored",
      "source-metadata-sanitized"
    ]);
    expect(result.report.qa.checks.every((check) => check.status === "passed")).toBe(true);
    expect(result.report.artifacts).toEqual({
      preview: "preview.png",
      contactSheet: "contact-sheet.png"
    });

    const reviewFiles = await listRelativeFiles(reviewDir);
    expect(reviewFiles).toEqual(["contact-sheet.png", "preview.png", "review.json"]);
    expect(PNG.sync.read(await readFile(path.join(reviewDir, "preview.png")))).toMatchObject({
      width: 256,
      height: 256
    });
    expect(PNG.sync.read(await readFile(path.join(reviewDir, "contact-sheet.png")))).toMatchObject({
      width: 1024,
      height: 512
    });

    const reportText = await readFile(path.join(reviewDir, "review.json"), "utf8");
    expect(reportText).not.toContain(fixtureBundle);
    expect(reportText).not.toContain("/Users/");
    expect(reportText).not.toContain("sourceImagePath");
    expect(reportText).not.toContain("rawResponse");
    expect(reportText).not.toContain("secret");
  });

  test("rejects invalid bundles before creating review artifacts", async () => {
    const workspace = await createTempDir();
    const badBundle = path.join(workspace, "bad-bundle");
    const reviewDir = path.join(workspace, "review");
    await cp(fixtureBundle, badBundle, { recursive: true });
    await rm(path.join(badBundle, "preview.png"));

    await expect(
      createPetReview({
        bundleDir: badBundle,
        reviewDir,
        now: fixedNow
      })
    ).rejects.toMatchObject({ issues: [expect.objectContaining({ code: "MISSING_ASSET" })] });

    await expect(stat(reviewDir)).rejects.toMatchObject({ code: "ENOENT" });
  });

  test("refuses to write review artifacts inside the source bundle", async () => {
    await expect(
      createPetReview({
        bundleDir: fixtureBundle,
        reviewDir: path.join(fixtureBundle, "review"),
        now: fixedNow
      })
    ).rejects.toMatchObject({ code: "REVIEW_DIR_UNSAFE" });

    await expect(stat(path.join(fixtureBundle, "review"))).rejects.toMatchObject({ code: "ENOENT" });
  });
});

describe("acceptPetBundle", () => {
  test("installs a validated bundle into a local library without source images", async () => {
    const workspace = await createTempDir();
    const libraryDir = path.join(workspace, "library");

    const result = await acceptPetBundle({
      bundleDir: fixtureBundle,
      libraryDir,
      now: fixedNow
    });

    expect(result.installation).toMatchObject({
      schemaVersion: "pet-installation.v0.1",
      status: "accepted",
      bundle: {
        id: "valid_minimal_atlas_pet",
        name: "兜兜 AIG 默认二次元数字人"
      },
      createdAt: fixedNow.toISOString()
    });
    expect(path.basename(result.installedBundleDir)).toBe("valid_minimal_atlas_pet");
    await expect(validatePetBundle(result.installedBundleDir)).resolves.toMatchObject({
      manifest: expect.objectContaining({ id: "valid_minimal_atlas_pet" })
    });
    await expect(stat(path.join(result.installedBundleDir, "source.png"))).rejects.toMatchObject({ code: "ENOENT" });

    const installedFiles = await listRelativeFiles(result.installedBundleDir);
    expect(installedFiles).toEqual([
      "atlases/main.png",
      "pet.json",
      "preview.png",
      "source.meta.json"
    ]);

    const installationText = JSON.stringify(result.installation);
    expect(installationText).not.toContain(fixtureBundle);
    expect(installationText).not.toContain("/Users/");
    expect(installationText).not.toContain("secret");
  });

  test("refuses to overwrite an existing installed bundle", async () => {
    const workspace = await createTempDir();
    const libraryDir = path.join(workspace, "library");
    await acceptPetBundle({ bundleDir: fixtureBundle, libraryDir, now: fixedNow });

    await expect(
      acceptPetBundle({ bundleDir: fixtureBundle, libraryDir, now: fixedNow })
    ).rejects.toMatchObject({
      code: "INSTALLATION_ALREADY_EXISTS"
    });
  });

  test("refuses to install a bundle into itself", async () => {
    await expect(
      acceptPetBundle({
        bundleDir: fixtureBundle,
        libraryDir: path.join(fixtureBundle, "library"),
        now: fixedNow
      })
    ).rejects.toMatchObject({ code: "INSTALLATION_ROOT_UNSAFE" });

    await expect(stat(path.join(fixtureBundle, "library"))).rejects.toMatchObject({ code: "ENOENT" });
  });
});

describe("deletePetAssets", () => {
  test("deletes an accepted bundle directory inside the allowed root", async () => {
    const workspace = await createTempDir();
    const libraryDir = path.join(workspace, "library");
    const accepted = await acceptPetBundle({ bundleDir: fixtureBundle, libraryDir, now: fixedNow });

    const result = await deletePetAssets({
      targetDir: accepted.installedBundleDir,
      allowedRoot: libraryDir
    });

    expect(result).toEqual({
      deleted: true,
      targetName: "valid_minimal_atlas_pet"
    });
    await expect(stat(accepted.installedBundleDir)).rejects.toMatchObject({ code: "ENOENT" });
  });

  test("rejects deletion outside the allowed root and rejects deleting the root itself", async () => {
    const workspace = await createTempDir();
    const libraryDir = path.join(workspace, "library");

    await expect(
      deletePetAssets({
        targetDir: workspace,
        allowedRoot: libraryDir
      })
    ).rejects.toBeInstanceOf(PetReviewError);

    await expect(
      deletePetAssets({
        targetDir: libraryDir,
        allowedRoot: libraryDir
      })
    ).rejects.toMatchObject({ code: "DELETE_TARGET_UNSAFE" });
  });
});

describe("runReviewPetCli", () => {
  test("runs QA, accept, and delete commands with structured results", async () => {
    const workspace = await createTempDir();
    const reviewDir = path.join(workspace, "review");
    const libraryDir = path.join(workspace, "library");

    await expect(
      runReviewPetCli(["node", "review-pet", "qa", fixtureBundle, reviewDir], { now: fixedNow })
    ).resolves.toBe(0);
    await expect(stat(path.join(reviewDir, "review.json"))).resolves.toMatchObject({ isFile: expect.any(Function) });

    await expect(
      runReviewPetCli(["node", "review-pet", "accept", fixtureBundle, libraryDir], { now: fixedNow })
    ).resolves.toBe(0);
    await expect(validatePetBundle(path.join(libraryDir, "valid_minimal_atlas_pet"))).resolves.toBeTruthy();

    await expect(
      runReviewPetCli([
        "node",
        "review-pet",
        "delete",
        path.join(libraryDir, "valid_minimal_atlas_pet"),
        "--root",
        libraryDir
      ])
    ).resolves.toBe(0);
    await expect(stat(path.join(libraryDir, "valid_minimal_atlas_pet"))).rejects.toMatchObject({ code: "ENOENT" });
  });
});

async function createTempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "pet-review-"));
  tempDirs.push(dir);
  return dir;
}

async function listRelativeFiles(rootDir: string): Promise<string[]> {
  const files: string[] = [];

  async function walk(currentDir: string): Promise<void> {
    const entries = await readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
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

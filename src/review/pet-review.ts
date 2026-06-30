import { lstat, mkdir, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { PNG } from "pngjs";
import { validatePetBundle, type ValidatedPetBundle } from "../pet_bundle/validate.js";

export type PetReviewErrorCode =
  | "REVIEW_DIR_UNSAFE"
  | "REVIEW_DIR_NOT_EMPTY"
  | "INSTALLATION_ALREADY_EXISTS"
  | "INSTALLATION_ROOT_UNSAFE"
  | "INSTALLATION_ROOT_INVALID"
  | "DELETE_TARGET_UNSAFE"
  | "DELETE_TARGET_MISSING"
  | "DELETE_TARGET_NOT_DIRECTORY";

export class PetReviewError extends Error {
  readonly code: PetReviewErrorCode;

  constructor(code: PetReviewErrorCode, message: string) {
    super(message);
    this.name = "PetReviewError";
    this.code = code;
  }
}

export interface PetReviewReport {
  schemaVersion: "pet-review.v0.1";
  status: "needs_review";
  createdAt: string;
  bundle: {
    id: string;
    name: string;
    schemaVersion: string;
    assetFormat: string;
    canvas: {
      width: 256;
      height: 256;
    };
    privacy: {
      sourceImageStored: false;
      cloudGenerated: boolean;
    };
  };
  qa: {
    result: "passed";
    checks: PetReviewCheck[];
  };
  artifacts: {
    preview: "preview.png";
    contactSheet: "contact-sheet.png";
  };
}

export interface PetReviewCheck {
  id:
    | "bundle-valid"
    | "preview-png"
    | "atlas-contact-sheet"
    | "privacy-source-not-stored"
    | "source-metadata-sanitized";
  status: "passed";
  message: string;
}

export interface CreatePetReviewOptions {
  bundleDir: string;
  reviewDir: string;
  now?: Date;
}

export interface CreatePetReviewResult {
  reviewDir: string;
  report: PetReviewReport;
}

export interface AcceptPetBundleOptions {
  bundleDir: string;
  libraryDir: string;
  now?: Date;
}

export interface PetInstallationRecord {
  schemaVersion: "pet-installation.v0.1";
  status: "accepted";
  createdAt: string;
  bundle: {
    id: string;
    name: string;
    schemaVersion: string;
  };
}

export interface AcceptPetBundleResult {
  installedBundleDir: string;
  installation: PetInstallationRecord;
}

export interface DeletePetAssetsOptions {
  targetDir: string;
  allowedRoot: string;
}

export interface DeletePetAssetsResult {
  deleted: true;
  targetName: string;
}

export async function createPetReview(options: CreatePetReviewOptions): Promise<CreatePetReviewResult> {
  const bundle = await validatePetBundle(options.bundleDir);
  const reviewDir = path.resolve(options.reviewDir);
  assertOutsideRoot(
    bundle.rootDir,
    reviewDir,
    "REVIEW_DIR_UNSAFE",
    "Review output directory must be outside the pet bundle."
  );
  await prepareEmptyDirectory(reviewDir, "REVIEW_DIR_NOT_EMPTY", "Review output directory must be empty.");

  const manifest = bundle.manifest;
  const previewPng = await readFile(path.join(bundle.rootDir, manifest.assets.preview));
  const atlas = manifest.assets.atlases[0];
  const contactSheetPng = await readFile(path.join(bundle.rootDir, atlas.path));
  const contactSheet = PNG.sync.read(contactSheetPng);
  const report: PetReviewReport = {
    schemaVersion: "pet-review.v0.1",
    status: "needs_review",
    createdAt: (options.now ?? new Date()).toISOString(),
    bundle: {
      id: manifest.id,
      name: manifest.name,
      schemaVersion: manifest.schemaVersion,
      assetFormat: manifest.assetFormat,
      canvas: {
        width: manifest.canvas.width,
        height: manifest.canvas.height
      },
      privacy: {
        sourceImageStored: false,
        cloudGenerated: manifest.privacy.cloudGenerated
      }
    },
    qa: {
      result: "passed",
      checks: [
        {
          id: "bundle-valid",
          status: "passed",
          message: "pet bundle v0.1 validation passed."
        },
        {
          id: "preview-png",
          status: "passed",
          message: "preview.png is a valid 256x256 PNG."
        },
        {
          id: "atlas-contact-sheet",
          status: "passed",
          message: `contact sheet is ${contactSheet.width}x${contactSheet.height}.`
        },
        {
          id: "privacy-source-not-stored",
          status: "passed",
          message: "bundle declares sourceImageStored:false."
        },
        {
          id: "source-metadata-sanitized",
          status: "passed",
          message: "source.meta.json passed the v0.1 privacy allowlist."
        }
      ]
    },
    artifacts: {
      preview: "preview.png",
      contactSheet: "contact-sheet.png"
    }
  };

  await writeFile(path.join(reviewDir, "preview.png"), previewPng);
  await writeFile(path.join(reviewDir, "contact-sheet.png"), contactSheetPng);
  await writeFile(path.join(reviewDir, "review.json"), `${JSON.stringify(report, null, 2)}\n`);

  return { reviewDir, report };
}

export async function acceptPetBundle(options: AcceptPetBundleOptions): Promise<AcceptPetBundleResult> {
  const bundle = await validatePetBundle(options.bundleDir);
  const libraryDir = path.resolve(options.libraryDir);
  assertOutsideRoot(
    bundle.rootDir,
    libraryDir,
    "INSTALLATION_ROOT_UNSAFE",
    "Pet library directory must be outside the source pet bundle."
  );
  await ensureDirectory(libraryDir, "INSTALLATION_ROOT_INVALID", "Pet library path must be a directory.");

  const installedBundleDir = path.join(libraryDir, bundle.manifest.id);
  await assertPathMissing(installedBundleDir);

  try {
    await mkdir(installedBundleDir, { recursive: true });
    await copyBundleFile(bundle, "pet.json", installedBundleDir);
    for (const relativePath of bundle.referencedAssets) {
      await copyBundleFile(bundle, relativePath, installedBundleDir);
    }
    await validatePetBundle(installedBundleDir);
  } catch (error) {
    await rm(installedBundleDir, { force: true, recursive: true });
    throw error;
  }

  return {
    installedBundleDir,
    installation: {
      schemaVersion: "pet-installation.v0.1",
      status: "accepted",
      createdAt: (options.now ?? new Date()).toISOString(),
      bundle: {
        id: bundle.manifest.id,
        name: bundle.manifest.name,
        schemaVersion: bundle.manifest.schemaVersion
      }
    }
  };
}

export async function deletePetAssets(options: DeletePetAssetsOptions): Promise<DeletePetAssetsResult> {
  const allowedRoot = path.resolve(options.allowedRoot);
  const targetDir = path.resolve(options.targetDir);
  const relativeTarget = path.relative(allowedRoot, targetDir);
  if (!isInsideRoot(allowedRoot, targetDir) || relativeTarget === "") {
    throw new PetReviewError("DELETE_TARGET_UNSAFE", "Deletion target must be a child directory inside the allowed root.");
  }

  const allowedRootRealPath = await resolveExistingOrAbsolute(allowedRoot);
  let targetRealPath: string;
  try {
    targetRealPath = await realpath(targetDir);
  } catch (error) {
    if (isNodeError(error, "ENOENT")) {
      throw new PetReviewError("DELETE_TARGET_MISSING", "Deletion target does not exist.");
    }
    throw error;
  }
  if (!isInsideRoot(allowedRootRealPath, targetRealPath)) {
    throw new PetReviewError("DELETE_TARGET_UNSAFE", "Deletion target must not escape the allowed root.");
  }

  const targetStat = await lstat(targetDir);
  if (targetStat.isSymbolicLink()) {
    throw new PetReviewError("DELETE_TARGET_UNSAFE", "Deletion target must not be a symbolic link.");
  }
  if (!targetStat.isDirectory()) {
    throw new PetReviewError("DELETE_TARGET_NOT_DIRECTORY", "Deletion target must be a directory.");
  }

  await rm(targetDir, { recursive: true });
  return {
    deleted: true,
    targetName: path.basename(targetDir)
  };
}

async function prepareEmptyDirectory(dir: string, code: PetReviewErrorCode, message: string): Promise<void> {
  await ensureDirectory(dir, code, message);
  const entries = await readdir(dir);
  if (entries.length > 0) {
    throw new PetReviewError(code, message);
  }
}

async function ensureDirectory(dir: string, code: PetReviewErrorCode, message: string): Promise<void> {
  try {
    await mkdir(dir, { recursive: true });
  } catch (error) {
    if (isNodeError(error, "EEXIST")) {
      throw new PetReviewError(code, message);
    }
    throw error;
  }
  const dirStat = await lstat(dir);
  if (!dirStat.isDirectory()) {
    throw new PetReviewError(code, message);
  }
}

async function assertPathMissing(targetPath: string): Promise<void> {
  try {
    await lstat(targetPath);
  } catch (error) {
    if (isNodeError(error, "ENOENT")) {
      return;
    }
    throw error;
  }
  throw new PetReviewError("INSTALLATION_ALREADY_EXISTS", "Accepted pet bundle already exists.");
}

async function copyBundleFile(bundle: ValidatedPetBundle, relativePath: string, installedBundleDir: string): Promise<void> {
  const source = path.join(bundle.rootDir, relativePath);
  const target = path.join(installedBundleDir, relativePath);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, await readFile(source));
}

async function resolveExistingOrAbsolute(targetPath: string): Promise<string> {
  try {
    return await realpath(targetPath);
  } catch (error) {
    if (isNodeError(error, "ENOENT")) {
      return path.resolve(targetPath);
    }
    throw error;
  }
}

function isInsideRoot(rootDir: string, targetPath: string): boolean {
  const relative = path.relative(rootDir, targetPath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function assertOutsideRoot(rootDir: string, targetPath: string, code: PetReviewErrorCode, message: string): void {
  if (isInsideRoot(rootDir, path.resolve(targetPath))) {
    throw new PetReviewError(code, message);
  }
}

function isNodeError(error: unknown, code: string): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === code;
}

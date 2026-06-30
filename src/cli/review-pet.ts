import { pathToFileURL } from "node:url";
import { PetBundleValidationError } from "../pet_bundle/validate.js";
import {
  acceptPetBundle,
  createPetReview,
  deletePetAssets,
  PetReviewError,
  type AcceptPetBundleOptions,
  type CreatePetReviewOptions
} from "../review/pet-review.js";

export interface ReviewPetCliOptions extends Pick<CreatePetReviewOptions, "now"> {}

export async function runReviewPetCli(argv: string[], options: ReviewPetCliOptions = {}): Promise<number> {
  const command = argv[2];
  try {
    if (command === "qa") {
      return await runQa(argv, options);
    }
    if (command === "accept") {
      return await runAccept(argv, options);
    }
    if (command === "delete") {
      return await runDelete(argv);
    }
    printUsage();
    return 2;
  } catch (error) {
    if (error instanceof PetBundleValidationError) {
      console.error(
        JSON.stringify(
          {
            ok: false,
            issues: error.issues
          },
          null,
          2
        )
      );
      return 1;
    }
    if (error instanceof PetReviewError) {
      console.error(
        JSON.stringify(
          {
            ok: false,
            code: error.code,
            message: error.message
          },
          null,
          2
        )
      );
      return 1;
    }
    throw error;
  }
}

async function runQa(argv: string[], options: ReviewPetCliOptions): Promise<number> {
  const bundleDir = argv[3];
  const reviewDir = argv[4];
  if (!bundleDir || !reviewDir) {
    printUsage();
    return 2;
  }
  const result = await createPetReview({
    bundleDir,
    reviewDir,
    now: options.now
  });
  console.log(
    JSON.stringify(
      {
        ok: true,
        status: result.report.status,
        id: result.report.bundle.id,
        artifacts: result.report.artifacts,
        checks: result.report.qa.checks.map((check) => check.id)
      },
      null,
      2
    )
  );
  return 0;
}

async function runAccept(argv: string[], options: Pick<AcceptPetBundleOptions, "now">): Promise<number> {
  const bundleDir = argv[3];
  const libraryDir = argv[4];
  if (!bundleDir || !libraryDir) {
    printUsage();
    return 2;
  }
  const result = await acceptPetBundle({
    bundleDir,
    libraryDir,
    now: options.now
  });
  console.log(
    JSON.stringify(
      {
        ok: true,
        status: result.installation.status,
        id: result.installation.bundle.id,
        installedBundleName: result.installation.bundle.id
      },
      null,
      2
    )
  );
  return 0;
}

async function runDelete(argv: string[]): Promise<number> {
  const targetDir = argv[3];
  const allowedRoot = readFlagValue(argv, "--root");
  if (!targetDir || !allowedRoot) {
    printUsage();
    return 2;
  }
  const result = await deletePetAssets({
    targetDir,
    allowedRoot
  });
  console.log(
    JSON.stringify(
      {
        ok: true,
        deleted: result.deleted,
        targetName: result.targetName
      },
      null,
      2
    )
  );
  return 0;
}

function readFlagValue(argv: string[], flag: string): string | undefined {
  const index = argv.indexOf(flag);
  if (index === -1) {
    return undefined;
  }
  return argv[index + 1];
}

function printUsage(): void {
  console.error("Usage:");
  console.error("  review-pet qa <bundle-dir> <review-dir>");
  console.error("  review-pet accept <bundle-dir> <library-dir>");
  console.error("  review-pet delete <target-dir> --root <allowed-root>");
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  runReviewPetCli(process.argv)
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    });
}

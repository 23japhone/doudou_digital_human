import { pathToFileURL } from "node:url";
import { PetBundleValidationError, validatePetBundle } from "../pet_bundle/validate.js";

export async function runValidatePetCli(argv: string[]): Promise<number> {
  const bundleDir = argv[2];
  if (!bundleDir) {
    console.error("Usage: validate-pet <bundle-dir>");
    return 2;
  }

  try {
    const result = await validatePetBundle(bundleDir);
    console.log(
      JSON.stringify(
        {
          ok: true,
          schemaVersion: result.manifest.schemaVersion,
          id: result.manifest.id,
          referencedAssets: result.referencedAssets.sort()
        },
        null,
        2
      )
    );
    return 0;
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
    throw error;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  runValidatePetCli(process.argv)
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    });
}

import { pathToFileURL } from "node:url";
import {
  generatePetBundleFromSource,
  PetGenerationError,
  SourceImageIntakeError,
  type GeneratePetBundleOptions
} from "../generation/generate-pet.js";

export async function runGeneratePetCli(
  argv: string[],
  options: Pick<GeneratePetBundleOptions, "now"> = {}
): Promise<number> {
  const sourceImagePath = argv[2];
  const outputBundleDir = argv[3];
  if (!sourceImagePath || !outputBundleDir) {
    console.error("Usage: generate-pet <source-image-path> <output-bundle-dir>");
    return 2;
  }

  try {
    const result = await generatePetBundleFromSource({
      sourceImagePath,
      outputBundleDir,
      now: options.now
    });
    console.log(
      JSON.stringify(
        {
          ok: true,
          id: result.manifest.id,
          schemaVersion: result.manifest.schemaVersion,
          inputMime: result.sourceImage.mime
        },
        null,
        2
      )
    );
    return 0;
  } catch (error) {
    if (error instanceof SourceImageIntakeError || error instanceof PetGenerationError) {
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

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  runGeneratePetCli(process.argv)
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    });
}

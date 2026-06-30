import { pathToFileURL } from "node:url";
import {
  CloudImageAdapterError,
  createCloudImageAdapter,
  createMockCloudImageProvider
} from "../generation/adapters/cloud-image-adapter.js";
import {
  generatePetBundleFromSource,
  PetGenerationError,
  SourceImageIntakeError,
  SourceImageNormalizationError,
  type GeneratePetBundleOptions
} from "../generation/generate-pet.js";

export interface GeneratePetCloudCliOptions extends Pick<GeneratePetBundleOptions, "now" | "normalizationTempRoot"> {
  env?: NodeJS.ProcessEnv;
}

export async function runGeneratePetCloudCli(
  argv: string[],
  options: GeneratePetCloudCliOptions = {}
): Promise<number> {
  const sourceImagePath = argv[2];
  const outputBundleDir = argv[3];
  const providerId = readFlagValue(argv, "--provider");
  const confirmCloudUpload = argv.includes("--confirm-cloud-upload");
  if (!sourceImagePath || !outputBundleDir || !providerId) {
    console.error(
      "Usage: generate-pet-cloud <source-image-path> <output-bundle-dir> --provider <provider-id> --confirm-cloud-upload"
    );
    return 2;
  }

  try {
    const provider = createProvider(providerId);
    const result = await generatePetBundleFromSource({
      sourceImagePath,
      outputBundleDir,
      now: options.now,
      normalizationTempRoot: options.normalizationTempRoot,
      adapter: createCloudImageAdapter({
        confirmCloudUpload,
        config: {
          providerId,
          apiKey: readApiKey(providerId, options.env ?? process.env)
        },
        provider
      })
    });
    console.log(
      JSON.stringify(
        {
          ok: true,
          id: result.manifest.id,
          schemaVersion: result.manifest.schemaVersion,
          inputMime: result.sourceImage.mime,
          generationAdapter: result.generation.adapterId
        },
        null,
        2
      )
    );
    return 0;
  } catch (error) {
    if (
      error instanceof SourceImageIntakeError ||
      error instanceof SourceImageNormalizationError ||
      error instanceof CloudImageAdapterError ||
      error instanceof PetGenerationError
    ) {
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

function readFlagValue(argv: string[], flag: string): string | undefined {
  const index = argv.indexOf(flag);
  if (index === -1) {
    return undefined;
  }
  return argv[index + 1];
}

function createProvider(providerId: string) {
  if (providerId === "mock-provider") {
    return createMockCloudImageProvider();
  }
  throw new CloudImageAdapterError("PROVIDER_NOT_CONFIGURED", "Selected cloud provider is not configured.");
}

function readApiKey(providerId: string, env: NodeJS.ProcessEnv): string | undefined {
  if (providerId === "mock-provider") {
    return env.DOUDOU_MOCK_CLOUD_API_KEY;
  }
  return undefined;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  runGeneratePetCloudCli(process.argv)
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    });
}

import { pathToFileURL } from "node:url";
import { PNG } from "pngjs";
import {
  CloudImageAdapterError,
  createCloudImageAdapter
} from "../generation/adapters/cloud-image-adapter.js";
import { createOpenAiImageProvider } from "../generation/adapters/openai-image-provider.js";

export interface OpenAiImageProbeOptions {
  env?: NodeJS.ProcessEnv;
  fetch?: typeof fetch;
}

export interface OpenAiImageProbeResult {
  exitCode: number;
  output: string;
}

export async function runOpenAiImageProbe(options: OpenAiImageProbeOptions = {}): Promise<OpenAiImageProbeResult> {
  const env = options.env ?? process.env;
  if (env.DOUDOU_ENABLE_OPENAI_LIVE !== "1" || !env.OPENAI_API_KEY) {
    return jsonResult(0, {
      skipped: true,
      reason: "Set DOUDOU_ENABLE_OPENAI_LIVE=1 and OPENAI_API_KEY to probe OpenAI image edits."
    });
  }

  const adapter = createCloudImageAdapter({
    confirmCloudUpload: true,
    config: {
      providerId: "openai-image",
      apiKey: env.OPENAI_API_KEY
    },
    provider: createOpenAiImageProvider({
      apiKey: env.OPENAI_API_KEY,
      endpoint: resolveOpenAiImageEndpoint(env),
      model: env.DOUDOU_OPENAI_IMAGE_MODEL ?? env.OPENAI_MODEL,
      fetch: options.fetch
    })
  });

  const probePng = syntheticProbePng();
  try {
    await adapter.generate({
      sourceImage: {
        mime: "image/png",
        bytes: probePng.byteLength,
        width: 256,
        height: 256
      },
      normalizedSourceImage: {
        bytes: probePng,
        mime: "image/png",
        width: 256,
        height: 256,
        temporaryPath: "synthetic-probe.png"
      }
    });
    return jsonResult(0, {
      ok: true,
      providerId: "openai-image"
    });
  } catch (error) {
    if (error instanceof CloudImageAdapterError) {
      return jsonResult(1, {
        ok: false,
        providerId: "openai-image",
        code: error.code,
        message: error.message
      });
    }
    throw error;
  }
}

function resolveOpenAiImageEndpoint(env: NodeJS.ProcessEnv): string | undefined {
  if (env.DOUDOU_OPENAI_IMAGE_ENDPOINT) {
    return env.DOUDOU_OPENAI_IMAGE_ENDPOINT;
  }
  const baseUrl = env.DOUDOU_OPENAI_BASE_URL ?? env.OPENAI_BASE_URL;
  if (!baseUrl) {
    return undefined;
  }
  return `${baseUrl.replace(/\/+$/, "")}/images/edits`;
}

function jsonResult(exitCode: number, payload: Record<string, unknown>): OpenAiImageProbeResult {
  return {
    exitCode,
    output: `${JSON.stringify(payload, null, 2)}\n`
  };
}

function syntheticProbePng(): Buffer {
  const png = new PNG({ width: 256, height: 256 });
  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      const index = (png.width * y + x) << 2;
      png.data[index] = 48 + (x % 120);
      png.data[index + 1] = 118 + (y % 90);
      png.data[index + 2] = 220;
      png.data[index + 3] = 255;
    }
  }
  return PNG.sync.write(png);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  runOpenAiImageProbe()
    .then((result) => {
      process.stdout.write(result.output);
      process.exitCode = result.exitCode;
    })
    .catch((error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    });
}

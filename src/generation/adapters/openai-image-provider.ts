import {
  CloudImageProviderError,
  type CloudImageProvider,
  type CloudImageProviderOutput,
  type CloudImageProviderRequest
} from "./cloud-image-adapter.js";

const DEFAULT_OPENAI_IMAGE_ENDPOINT = "https://api.openai.com/v1/images/edits";
const DEFAULT_OPENAI_IMAGE_MODEL = "gpt-image-1.5";
const DEFAULT_TIMEOUT_MS = 120000;

type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

export interface OpenAiImageProviderOptions {
  apiKey: string;
  endpoint?: string;
  model?: string;
  fetch?: FetchLike;
  timeoutMs?: number;
}

export function createOpenAiImageProvider(options: OpenAiImageProviderOptions): CloudImageProvider {
  return {
    id: "openai-image",
    async generateCharacter(request: CloudImageProviderRequest): Promise<CloudImageProviderOutput> {
      const fetchImpl = options.fetch ?? globalThis.fetch;
      if (!fetchImpl) {
        throw new CloudImageProviderError("provider_error", "OpenAI image provider fetch is unavailable.");
      }
      if (!options.apiKey) {
        throw new CloudImageProviderError("provider_error", "OpenAI image provider is not configured.");
      }

      const response = await postImageEdit(fetchImpl, options, request);
      if (!response.ok) {
        throw await mapOpenAiError(response);
      }

      return decodeOpenAiImageResponse(response);
    }
  };
}

async function postImageEdit(
  fetchImpl: FetchLike,
  options: OpenAiImageProviderOptions,
  request: CloudImageProviderRequest
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  timeout.unref?.();

  const form = new FormData();
  form.append("model", options.model ?? DEFAULT_OPENAI_IMAGE_MODEL);
  form.append("image[]", new Blob([toArrayBufferView(request.normalizedImage.bytes)], { type: "image/png" }), "normalized-source.png");
  form.append("prompt", createPrompt(request));
  form.append("size", "1024x1024");
  form.append("output_format", "png");
  form.append("background", "transparent");

  try {
    return await fetchImpl(options.endpoint ?? DEFAULT_OPENAI_IMAGE_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${options.apiKey}`
      },
      body: form,
      signal: controller.signal
    });
  } catch (error) {
    if (isAbortError(error)) {
      throw new CloudImageProviderError("timeout", "OpenAI image request timed out.");
    }
    throw new CloudImageProviderError("provider_error", "OpenAI image request failed.");
  } finally {
    clearTimeout(timeout);
  }
}

function toArrayBufferView(buffer: Buffer): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(buffer.byteLength);
  bytes.set(buffer);
  return bytes;
}

function createPrompt(request: CloudImageProviderRequest): string {
  if (request.instructionPreset !== "desktop-pet-v0.1") {
    throw new CloudImageProviderError("provider_error", "Unsupported OpenAI image instruction preset.");
  }
  return [
    "Transform the input image into a cute transparent-background desktop pet character.",
    "Keep the result as a single centered full-body mascot with readable silhouette, soft friendly styling, and no text.",
    "Return PNG artwork suitable for a 256x256 sprite frame."
  ].join(" ");
}

async function mapOpenAiError(response: Response): Promise<CloudImageProviderError> {
  const providerCode = await readProviderErrorCode(response);
  if (response.status === 429) {
    return new CloudImageProviderError("rate_limited", "OpenAI image provider rate limit was reached.");
  }
  if (response.status === 408 || response.status === 504) {
    return new CloudImageProviderError("timeout", "OpenAI image provider timed out.");
  }
  if (isRefusalCode(providerCode)) {
    return new CloudImageProviderError("refused", "OpenAI image provider refused the generation request.");
  }
  return new CloudImageProviderError("provider_error", "OpenAI image provider failed.");
}

async function readProviderErrorCode(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as unknown;
    if (!body || typeof body !== "object") {
      return "";
    }
    const error = (body as { error?: unknown }).error;
    if (!error || typeof error !== "object") {
      return "";
    }
    const code = (error as { code?: unknown; type?: unknown }).code ?? (error as { type?: unknown }).type;
    return typeof code === "string" ? code : "";
  } catch {
    return "";
  }
}

function isRefusalCode(code: string): boolean {
  const normalized = code.toLowerCase();
  return normalized.includes("moderation") || normalized.includes("policy") || normalized.includes("safety");
}

async function decodeOpenAiImageResponse(response: Response): Promise<CloudImageProviderOutput> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw invalidOutput();
  }

  const imageBase64 = readFirstImageBase64(body);
  if (!imageBase64) {
    throw invalidOutput();
  }
  const imagePng = Buffer.from(imageBase64, "base64");
  if (!hasPngSignature(imagePng)) {
    throw invalidOutput();
  }
  return { imagePng };
}

function readFirstImageBase64(body: unknown): string | null {
  if (!body || typeof body !== "object") {
    return null;
  }
  const data = (body as { data?: unknown }).data;
  if (!Array.isArray(data) || data.length === 0) {
    return null;
  }
  const first = data[0];
  if (!first || typeof first !== "object") {
    return null;
  }
  const b64Json = (first as { b64_json?: unknown }).b64_json;
  return typeof b64Json === "string" && b64Json.length > 0 ? b64Json : null;
}

function hasPngSignature(buffer: Buffer): boolean {
  return (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  );
}

function invalidOutput(): CloudImageProviderError {
  return new CloudImageProviderError("invalid_output", "OpenAI image provider output was invalid.");
}

function isAbortError(error: unknown): boolean {
  return (
    error instanceof DOMException && error.name === "AbortError"
  ) || (
    error instanceof Error && error.name === "AbortError"
  );
}

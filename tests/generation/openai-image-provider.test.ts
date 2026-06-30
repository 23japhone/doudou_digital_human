import { PNG } from "pngjs";
import { describe, expect, test } from "vitest";
import { createOpenAiImageProvider } from "../../src/generation/adapters/openai-image-provider.js";

describe("createOpenAiImageProvider", () => {
  test("posts normalized image edits to OpenAI and returns only decoded PNG bytes", async () => {
    const requests: Array<{ url: string; init: RequestInit }> = [];
    const provider = createOpenAiImageProvider({
      apiKey: "secret-openai-key",
      endpoint: "https://api.openai.test/v1/images/edits",
      fetch: async (url, init) => {
        requests.push({ url: String(url), init: init ?? {} });
        return new Response(
          JSON.stringify({
            created: 1782800000,
            data: [{ b64_json: createPngSource(256, 256).toString("base64") }]
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }
    });

    const result = await provider.generateCharacter({
      providerId: "openai-image",
      instructionPreset: "desktop-pet-v0.1",
      normalizedImage: {
        bytes: createPngSource(256, 256),
        mime: "image/png",
        width: 256,
        height: 256
      }
    });

    expect(result).toEqual({ imagePng: expect.any(Buffer) });
    expect(Object.keys(result)).toEqual(["imagePng"]);
    expect(PNG.sync.read(result.imagePng)).toMatchObject({ width: 256, height: 256 });
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      url: "https://api.openai.test/v1/images/edits",
      init: {
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer secret-openai-key"
        })
      }
    });
    expect(requests[0]!.init.body).toBeInstanceOf(FormData);
    expect(JSON.stringify(result)).not.toContain("secret-openai-key");
  });

  test.each([
    [429, { error: { code: "rate_limit_exceeded" } }, "rate_limited"],
    [504, { error: { code: "gateway_timeout" } }, "timeout"],
    [400, { error: { code: "moderation_blocked" } }, "refused"],
    [500, { error: { code: "server_error" } }, "provider_error"]
  ] as const)("maps HTTP %s to provider code %s", async (status, body, expectedCode) => {
    const provider = createOpenAiImageProvider({
      apiKey: "secret-openai-key",
      fetch: async () =>
        new Response(JSON.stringify(body), {
          status,
          headers: { "content-type": "application/json" }
        })
    });

    await expect(provider.generateCharacter(createRequest())).rejects.toMatchObject({
      providerCode: expectedCode,
      message: expect.not.stringContaining("secret-openai-key")
    });
  });

  test("maps invalid OpenAI image responses without retaining raw provider payloads", async () => {
    const provider = createOpenAiImageProvider({
      apiKey: "secret-openai-key",
      fetch: async () =>
        new Response(JSON.stringify({ data: [{ url: "https://example.test/image.png" }] }), {
          status: 200,
          headers: { "content-type": "application/json" }
        })
    });

    await expect(provider.generateCharacter(createRequest())).rejects.toMatchObject({
      providerCode: "invalid_output",
      message: expect.not.stringContaining("example.test")
    });
  });

  test("maps aborted requests to timeout", async () => {
    const provider = createOpenAiImageProvider({
      apiKey: "secret-openai-key",
      fetch: async () => {
        throw new DOMException("The operation was aborted.", "AbortError");
      }
    });

    await expect(provider.generateCharacter(createRequest())).rejects.toMatchObject({
      providerCode: "timeout"
    });
  });
});

function createRequest() {
  return {
    providerId: "openai-image" as const,
    instructionPreset: "desktop-pet-v0.1" as const,
    normalizedImage: {
      bytes: createPngSource(256, 256),
      mime: "image/png" as const,
      width: 256 as const,
      height: 256 as const
    }
  };
}

function createPngSource(width = 32, height = 32): Buffer {
  const png = new PNG({ width, height });
  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      const index = (png.width * y + x) << 2;
      png.data[index] = 120 + (x % 80);
      png.data[index + 1] = 90 + (y % 60);
      png.data[index + 2] = 210;
      png.data[index + 3] = 255;
    }
  }
  return PNG.sync.write(png);
}

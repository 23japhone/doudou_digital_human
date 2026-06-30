import { describe, expect, test } from "vitest";
import { PNG } from "pngjs";
import { runOpenAiImageProbe } from "../../src/scripts/openai-image-probe.js";

describe("runOpenAiImageProbe", () => {
  test("skips unless live env and API key are present", async () => {
    const result = await runOpenAiImageProbe({
      env: {},
      fetch: async () => {
        throw new Error("fetch should not run");
      }
    });

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.output)).toMatchObject({ skipped: true });
  });

  test("reports successful image edit compatibility without exposing the API key", async () => {
    const result = await runOpenAiImageProbe({
      env: {
        DOUDOU_ENABLE_OPENAI_LIVE: "1",
        OPENAI_API_KEY: "secret-openai-key",
        DOUDOU_OPENAI_BASE_URL: "https://api.openai.test/v1",
        OPENAI_MODEL: "test-image-model"
      },
      fetch: async () =>
        new Response(JSON.stringify({
          data: [{ b64_json: createPngSource(256, 256).toString("base64") }]
        }), {
          status: 200,
          headers: { "content-type": "application/json" }
        })
    });

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.output)).toMatchObject({
      ok: true,
      providerId: "openai-image"
    });
    expect(result.output).not.toContain("secret-openai-key");
  });

  test("maps incompatible image providers to a clear failure without exposing the API key", async () => {
    const result = await runOpenAiImageProbe({
      env: {
        DOUDOU_ENABLE_OPENAI_LIVE: "1",
        OPENAI_API_KEY: "secret-openai-key",
        DOUDOU_OPENAI_BASE_URL: "https://api.openai.test/v1",
        OPENAI_MODEL: "test-image-model"
      },
      fetch: async () =>
        new Response(JSON.stringify({ detail: "Not Found" }), {
          status: 404,
          headers: { "content-type": "application/json" }
        })
    });

    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.output)).toMatchObject({
      ok: false,
      code: "MODEL_PROVIDER_ERROR"
    });
    expect(result.output).not.toContain("secret-openai-key");
  });
});

function createPngSource(width = 32, height = 32): Buffer {
  const png = new PNG({ width, height });
  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      const index = (png.width * y + x) << 2;
      png.data[index] = 96 + (x % 60);
      png.data[index + 1] = 144 + (y % 60);
      png.data[index + 2] = 220;
      png.data[index + 3] = 255;
    }
  }
  return PNG.sync.write(png);
}

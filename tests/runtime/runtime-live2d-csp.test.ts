import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "vitest";

describe("runtime Live2D asset CSP", () => {
  test("allows local Cubism asset reads and runtime modules without opening network connections", async () => {
    const html = await readFile(path.join(process.cwd(), "src/runtime/index.html"), "utf8");

    expect(html).toContain("connect-src 'self' file:");
    expect(html).toContain("script-src 'self' file:");
    expect(html).not.toContain("connect-src *");
    expect(html).not.toContain("connect-src http:");
    expect(html).not.toContain("connect-src https:");
    expect(html).not.toContain("script-src *");
    expect(html).not.toContain("script-src http:");
    expect(html).not.toContain("script-src https:");
  });

  test("provides a dedicated WebGL canvas for the official Live2D renderer", async () => {
    const html = await readFile(path.join(process.cwd(), "src/runtime/index.html"), "utf8");
    const css = await readFile(path.join(process.cwd(), "src/runtime/styles.css"), "utf8");

    expect(html).toContain('id="live2d-canvas"');
    expect(html).toContain('aria-label="Live2D 桌面宠物"');
    expect(css).toContain("#live2d-canvas");
    expect(css).toContain('[data-live2d-official-runtime="loaded"]');
  });
});

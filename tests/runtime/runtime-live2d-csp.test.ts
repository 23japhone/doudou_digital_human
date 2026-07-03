import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "vitest";

describe("runtime Live2D asset CSP", () => {
  test("allows local Cubism asset reads without opening network connections", async () => {
    const html = await readFile(path.join(process.cwd(), "src/runtime/index.html"), "utf8");

    expect(html).toContain("connect-src 'self' file:");
    expect(html).not.toContain("connect-src *");
    expect(html).not.toContain("connect-src http:");
    expect(html).not.toContain("connect-src https:");
  });
});

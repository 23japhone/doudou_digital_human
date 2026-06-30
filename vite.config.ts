import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  root: resolve(__dirname, "src/runtime"),
  build: {
    outDir: resolve(__dirname, "dist/runtime/renderer"),
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, "src/runtime/index.html")
    }
  }
});

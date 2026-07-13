import {fileURLToPath, URL} from "node:url";
import react from "@vitejs/plugin-react";
import {defineConfig} from "vite";

const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {dedupe: ["react", "react-dom"]},
  server: {fs: {allow: [repositoryRoot]}},
  build: {
    outDir: "dist",
    // Public source maps require an explicit observability/security decision.
    // Keep the independently deployable alpha artifact source-map free.
    sourcemap: false,
    chunkSizeWarningLimit: 3_000,
  },
});

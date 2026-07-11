import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url));
const esmEntry = (packageName: string) =>
  fileURLToPath(new URL(`./node_modules/${packageName}/dist/index.js`, import.meta.url));
const unifiedVisPackages = [
  "@deck.gl/core",
  "@deck.gl/aggregation-layers",
  "@deck.gl/extensions",
  "@deck.gl/geo-layers",
  "@deck.gl/layers",
  "@deck.gl/mapbox",
  "@deck.gl/mesh-layers",
  "@deck.gl/react",
  "@deck.gl/widgets",
  "@luma.gl/core",
  "@luma.gl/engine",
  "@luma.gl/shadertools",
  "@luma.gl/webgl",
];

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ["@kepler.gl/components"],
  },
  resolve: {
    alias: unifiedVisPackages.map((packageName) => ({
      find: new RegExp(`^${packageName.replace(".", "\\.")}$`),
      replacement: esmEntry(packageName),
    })),
    dedupe: ["react", "react-dom", "styled-components"],
  },
  server: {
    fs: {
      allow: [repositoryRoot],
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
    chunkSizeWarningLimit: 5_000,
  },
});

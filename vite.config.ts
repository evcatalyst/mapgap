import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const apiProxyTarget = process.env.MAPGAP_API_PROXY_TARGET?.trim().replace(/\/+$/, "");

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    ...(apiProxyTarget
      ? {
          proxy: {
            "/api": {
              target: apiProxyTarget,
              changeOrigin: true,
              secure: true,
            },
          },
        }
      : {}),
  },
  preview: {
    host: "0.0.0.0",
    port: 4173,
  },
});

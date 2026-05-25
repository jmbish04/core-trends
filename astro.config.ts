// @ts-check
import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

const site = process.env.SITE ?? "http://localhost:4321";
const base = process.env.BASE || "/";

// https://astro.build/config
export default defineConfig({
  site,
  srcDir: "./src/frontend",
  base,
  output: "server",
  adapter: cloudflare({
    imageService: "cloudflare",
    platformProxy: {
      enabled: true,
    },
    // Natively injects your custom script and exposes your DO class
    workerEntryPoint: {
      path: "./src/index.ts",
      namedExports: ["RepositoryIntelligenceAgent"],
    },
  }),
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
  },
});

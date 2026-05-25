import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  output: 'server',
  adapter: cloudflare({
    mode: 'advanced', // Ensures custom entrypoint capability
    customEntrypoint: 'src/index.ts', // Points to your custom extended entrypoint handler
    runtime: 'cloudflare-binding'
  }),
  integrations: [
    react(),
    tailwind({
      applyBaseStyles: false,
    })
  ]
});

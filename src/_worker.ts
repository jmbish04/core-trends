/**
 * @fileoverview Custom Cloudflare Workers Entrypoint for Astro, Hono & Durable Objects
 */

import type { ExportedHandler } from '@cloudflare/workers-types';
import { routeAgentRequest } from 'agents';
import { createExports } from '@astrojs/cloudflare/entrypoints/server';
import { app as honoApp } from './backend/api/index';
import type { Bindings } from './backend/api/index';

// 1. Mandatory Class Export: Must be present for Wrangler's compiler visibility
export { RepositoryIntelligenceAgent } from './backend/agents/RepositoryIntelligenceAgent';

// 2. Initialize the Astro server runtime exports
const astroServer = createExports(import.meta.env.SSR_APP);

const handler: ExportedHandler<Bindings> = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Route agent WebSocket connections first
    const agentResponse = await routeAgentRequest(request, env);
    if (agentResponse) return agentResponse;

    // Route specific API and Documentation routes directly to the Hono Application layer
    if (
      url.pathname.startsWith('/api/') ||
      url.pathname === '/openapi.json' ||
      url.pathname === '/swagger' ||
      url.pathname === '/scalar' ||
      url.pathname === '/docs'
    ) {
      return honoApp.fetch(request, env, ctx);
    }

    // Pass everything else to Astro's default compiled SSR rendering context
    return astroServer.fetch(request, env, ctx);
  },
};

export default handler;

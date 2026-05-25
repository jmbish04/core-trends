/**
 * @fileoverview Custom Cloudflare Workers Entrypoint wrapper
 * Merges Astro SSR, Hono API Routing, and Exports Durable Objects cleanly.
 */

import type { ExportedHandler } from '@cloudflare/workers-types';
import { routeAgentRequest } from 'agents';
import { app as honoApp } from './backend/api/index';
import type { Bindings } from './backend/api/index';

// @ts-ignore - Dynamically import the compiled framework runtime
import astroHandler from '../dist/_worker.js/index.js';

// CRITICAL EXPORT: Fixes the Durable Object missing export validation error
export { RepositoryIntelligenceAgent } from './backend/agents/RepositoryIntelligenceAgent';

const handler: ExportedHandler<Bindings> = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 1. Route Agent WebSocket connections first
    const agentResponse = await routeAgentRequest(request, env);
    if (agentResponse) return agentResponse;

    // 2. Direct API routes and Documentation servers directly to the Hono engine
    if (
      url.pathname.startsWith('/api/') ||
      url.pathname === '/openapi.json' ||
      url.pathname === '/swagger' ||
      url.pathname === '/scalar' ||
      url.pathname === '/docs'
    ) {
      return honoApp.fetch(request, env, ctx);
    }

    // 3. Forward UI page traffic to Astro's server-side renderer
    return astroHandler.fetch(request, env, ctx);
  },
};

export default handler;

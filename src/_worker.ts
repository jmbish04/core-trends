/**
 * @fileoverview Unified Cloudflare Workers entry point pipeline.
 * Compiles custom code blocks, routes, and Durable Objects alongside Astro SSR.
 */

import type { ExportedHandler } from '@cloudflare/workers-types';
import { routeAgentRequest } from 'agents';
import { app as honoApp } from './backend/api/index';
import type { Bindings } from './backend/api/index';

// Import Astro's underlying compiled production handler 
// @ts-ignore
import astroHandler from '../dist/_worker.js/index.js';

// MANDATORY EXPORT: Resolves the "not exported in your entrypoint file" error
export { RepositoryIntelligenceAgent } from './backend/agents/RepositoryIntelligenceAgent';

const handler: ExportedHandler<Bindings> = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 1. Intercept and route agent WebSocket connections first
    const agentResponse = await routeAgentRequest(request, env);
    if (agentResponse) return agentResponse;

    // 2. Intercept API routes and OpenAPI specs using the Hono App instance
    if (
      url.pathname.startsWith('/api/') ||
      url.pathname === '/openapi.json' ||
      url.pathname === '/swagger' ||
      url.pathname === '/scalar' ||
      url.pathname === '/docs'
    ) {
      return honoApp.fetch(request, env, ctx);
    }

    // 3. Fallback automatically to Astro's server-side rendered application context
    return astroHandler.fetch(request, env, ctx);
  },
};

export default handler;

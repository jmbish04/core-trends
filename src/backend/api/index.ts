/**
 * @fileoverview Main Hono API router
 *
 * This file sets up the main Hono application with all API routes and middleware.
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import type { D1Database, Ai, DurableObjectNamespace } from '@cloudflare/workers-types';
import { dashboardRouter } from './routes/dashboard';
import { threadsRouter } from './routes/threads';
import { healthRouter } from './routes/health';
import { notificationsRouter } from './routes/notifications';
import { aiRouter } from './routes/ai';
import { documentsRouter } from './routes/documents';
import { openapiRouter } from './routes/openapi';
import { webhooksRouter } from './routes/webhooks';
import { repositoriesRouter } from './routes/repositories';
import { pipelineRouter } from './routes/pipeline';

export type Bindings = {
  DB: D1Database;
  AI: Ai;
  REPO_INTEL_AGENT: DurableObjectNamespace;
  WORKER_API_KEY: string;
  AI_GATEWAY_TOKEN?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  ASSETS: Fetcher;
};

export type Variables = Record<string, never>;

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Middleware
app.use('*', cors());
app.use('*', logger());

// Health check
app.get('/api/ping', (c) => c.json({ status: 'ok', timestamp: Date.now() }));

// Mount routers (removed auth router - using API key only)
app.route('/api/dashboard', dashboardRouter);
app.route('/api/threads', threadsRouter);
app.route('/api/health', healthRouter);
app.route('/api/notifications', notificationsRouter);
app.route('/api/ai', aiRouter);
app.route('/api/documents', documentsRouter);
app.route('/api/webhooks', webhooksRouter);
app.route('/api/repositories', repositoriesRouter);
app.route('/api/pipeline', pipelineRouter);
app.route('/', openapiRouter);

export { app };

/**
 * @fileoverview Pipeline API routes for GitHub Actions integration
 *
 * Handles incoming data from the repository intelligence pipeline GitHub Action
 */

import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { pipelineRuns, systemLogs } from '../../db/schema';
import { authMiddleware } from '../middleware/auth';
import type { Bindings, Variables } from '../index';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { desc, eq } from 'drizzle-orm';

const pipelineRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Schema for pipeline run data
const pipelineRunSchema = z.object({
  runId: z.string(),
  status: z.enum(['success', 'failure', 'running']),
  repositoriesProcessed: z.number().int().min(0),
  originalPayload: z.string().optional(), // JSON string
  enrichedData: z.string().optional(), // JSON string
});

/**
 * POST /api/pipeline/runs
 * Record a new pipeline run from GitHub Actions
 */
pipelineRouter.post('/runs', authMiddleware, zValidator('json', pipelineRunSchema), async (c) => {
  const db = drizzle(c.env.DB);
  const data = c.req.valid('json');

  try {
    const result = await db
      .insert(pipelineRuns)
      .values({
        runId: data.runId,
        status: data.status,
        repositoriesProcessed: data.repositoriesProcessed,
        originalPayload: data.originalPayload,
        enrichedData: data.enrichedData,
        completedAt: data.status !== 'running' ? new Date() : undefined,
      })
      .returning()
      .get();

    // Log the pipeline run
    await db.insert(systemLogs).values({
      level: 'info',
      subsystem: 'github_action',
      message: `Pipeline run ${data.runId} recorded with status: ${data.status}`,
      metadata: JSON.stringify({ runId: data.runId, repoCount: data.repositoriesProcessed }),
    });

    return c.json({ success: true, pipelineRun: result }, 201);
  } catch (error) {
    console.error('Pipeline run creation error:', error);
    return c.json({ success: false, error: (error as Error).message }, 500);
  }
});

/**
 * GET /api/pipeline/runs
 * List all pipeline runs
 */
pipelineRouter.get('/runs', async (c) => {
  const db = drizzle(c.env.DB);

  try {
    const runs = await db
      .select()
      .from(pipelineRuns)
      .orderBy(desc(pipelineRuns.createdAt))
      .all();

    return c.json({ success: true, runs });
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500);
  }
});

/**
 * GET /api/pipeline/runs/:id
 * Get a specific pipeline run with full details
 */
pipelineRouter.get('/runs/:id', async (c) => {
  const db = drizzle(c.env.DB);
  const idParam = c.req.param('id');
  const id = parseInt(idParam);

  if (isNaN(id)) {
    return c.json({ success: false, error: 'Invalid pipeline run ID' }, 400);
  }

  try {
    const run = await db
      .select()
      .from(pipelineRuns)
      .where(eq(pipelineRuns.id, id))
      .get();

    if (!run) {
      return c.json({ success: false, error: 'Pipeline run not found' }, 404);
    }

    return c.json({ success: true, run });
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500);
  }
});

export { pipelineRouter };

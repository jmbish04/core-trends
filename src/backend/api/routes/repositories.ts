/**
 * @fileoverview Repository management API routes
 *
 * Handles CRUD operations for tracked repositories and triggers agent evaluations.
 */

import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { repositories, evaluations } from '../../db/schema';
import { eq, desc } from 'drizzle-orm';
import { getAgentByName } from 'agents';
import type { Bindings, Variables } from '../index';
import type { RepositoryIntelligenceAgent } from '../../agents/RepositoryIntelligenceAgent';

const repositoriesRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>();

/**
 * GET /api/repositories
 * List all tracked repositories
 */
repositoriesRouter.get('/', async (c) => {
  const db = drizzle(c.env.DB);

  try {
    const allRepos = await db
      .select()
      .from(repositories)
      .orderBy(desc(repositories.stars))
      .all();

    return c.json({
      success: true,
      count: allRepos.length,
      repositories: allRepos,
    });
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500);
  }
});

/**
 * GET /api/repositories/:id
 * Get a specific repository with evaluations
 */
repositoriesRouter.get('/:id', async (c) => {
  const db = drizzle(c.env.DB);
  const id = parseInt(c.req.param('id'));

  try {
    const repo = await db
      .select()
      .from(repositories)
      .where(eq(repositories.id, id))
      .get();

    if (!repo) {
      return c.json({ success: false, error: 'Repository not found' }, 404);
    }

    const repoEvaluations = await db
      .select()
      .from(evaluations)
      .where(eq(evaluations.repositoryId, id))
      .orderBy(desc(evaluations.createdAt))
      .all();

    return c.json({
      success: true,
      repository: repo,
      evaluations: repoEvaluations,
    });
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500);
  }
});

/**
 * POST /api/repositories/:id/evaluate
 * Trigger an AI evaluation for a repository
 */
repositoriesRouter.post('/:id/evaluate', async (c) => {
  const db = drizzle(c.env.DB);
  const id = parseInt(c.req.param('id'));

  try {
    const repo = await db
      .select()
      .from(repositories)
      .where(eq(repositories.id, id))
      .get();

    if (!repo) {
      return c.json({ success: false, error: 'Repository not found' }, 404);
    }

    // Get or create an agent instance for this repository
    const agent = await getAgentByName<RepositoryIntelligenceAgent>(
      c.env.REPO_INTEL_AGENT,
      `repo-${repo.githubId}`
    );

    // Trigger evaluation via RPC call
    const result = await agent.evaluateRepository({
      name: repo.name,
      owner: repo.owner,
      description: repo.description || undefined,
      language: repo.language,
      stars: repo.stars,
      url: repo.url,
    });

    return c.json({
      success: true,
      evaluation: result,
      message: 'Evaluation started',
    });
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500);
  }
});

/**
 * POST /api/repositories
 * Add a new repository to track
 */
repositoriesRouter.post('/', async (c) => {
  const db = drizzle(c.env.DB);

  try {
    const body = await c.req.json();

    const result = await db
      .insert(repositories)
      .values({
        githubId: body.githubId,
        name: body.name,
        owner: body.owner,
        fullName: body.fullName,
        description: body.description || '',
        url: body.url,
        language: body.language || 'Unknown',
        stars: body.stars || 0,
        trendPeriod: body.trendPeriod || 'manual',
        discoveredMethod: 'manual_entry',
      })
      .returning()
      .get();

    return c.json({ success: true, repository: result }, 201);
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500);
  }
});

/**
 * POST /api/repositories/:id/survey
 * Submit user feedback on an evaluation
 */
repositoriesRouter.post('/:id/survey', async (c) => {
  const db = drizzle(c.env.DB);
  const id = parseInt(c.req.param('id'));

  try {
    const { evaluationId, responseText } = await c.req.json();

    await db
      .update(evaluations)
      .set({ surveyResponse: responseText })
      .where(eq(evaluations.id, evaluationId))
      .run();

    return c.json({ success: true });
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500);
  }
});

export { repositoriesRouter };

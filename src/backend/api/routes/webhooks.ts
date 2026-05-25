/**
 * @fileoverview GitHub webhook handler for repository star events
 *
 * This route handles incoming GitHub webhooks when users star repositories.
 */

import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { repositories, systemLogs } from '../../db/schema';
import type { Bindings, Variables } from '../index';

const webhooksRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>();

/**
 * POST /api/webhooks/github
 * Handle GitHub star events
 */
webhooksRouter.post('/github', async (c) => {
  const db = drizzle(c.env.DB);

  try {
    const payload = await c.req.json();

    // Handle starred repository event
    if (payload.action === 'starred' && payload.repository) {
      const repo = payload.repository;

      await db
        .insert(repositories)
        .values({
          githubId: repo.id,
          name: repo.name,
          owner: repo.owner.login,
          fullName: repo.full_name,
          description: repo.description || '',
          url: repo.html_url,
          language: repo.language || 'Unknown',
          stars: repo.stargazers_count,
          trendPeriod: 'realtime_signal',
          isNewTrending: false,
          isStarredByUser: true,
          discoveredMethod: 'webhook_signal',
        })
        .onConflictDoUpdate({
          target: repositories.githubId,
          set: {
            isStarredByUser: true,
            stars: repo.stargazers_count,
            updatedAt: new Date(),
          },
        });

      // Log successful webhook processing
      await db.insert(systemLogs).values({
        level: 'info',
        subsystem: 'webhook_listener',
        message: `Successfully processed star event for ${repo.full_name}`,
        metadata: JSON.stringify({ githubId: repo.id }),
      });

      return c.json({ success: true, repository: repo.full_name });
    }

    return c.json({ success: true, message: 'Event type not processed' });
  } catch (error) {
    console.error('Webhook processing error:', error);

    await db.insert(systemLogs).values({
      level: 'error',
      subsystem: 'webhook_listener',
      message: `Failed to process webhook: ${(error as Error).message}`,
      metadata: JSON.stringify({ error: (error as Error).stack }),
    });

    return c.json({ success: false, error: (error as Error).message }, 500);
  }
});

export { webhooksRouter };

/**
 * @fileoverview Dashboard API routes
 */

import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { desc, eq, and, gte, sql } from 'drizzle-orm';
import { dashboardMetrics, repositories, evaluations, systemLogs } from '../../db/schema';
import { authMiddleware } from '../middleware/auth';
import type { Bindings, Variables } from '../index';

const dashboardRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Apply auth middleware to protected routes
dashboardRouter.use('/metrics', authMiddleware);
dashboardRouter.use('/charts/*', authMiddleware);

// GET /api/dashboard/summary - Public endpoint for repository intelligence overview
dashboardRouter.get('/summary', async (c) => {
  const db = drizzle(c.env.DB);

  try {
    // Get repository statistics
    const totalRepos = await db
      .select({ count: sql<number>`count(*)` })
      .from(repositories)
      .get();

    const trendingRepos = await db
      .select({ count: sql<number>`count(*)` })
      .from(repositories)
      .where(eq(repositories.isNewTrending, true))
      .get();

    const starredRepos = await db
      .select({ count: sql<number>`count(*)` })
      .from(repositories)
      .where(eq(repositories.isStarredByUser, true))
      .get();

    // Get top repositories by stars
    const topRepositories = await db
      .select()
      .from(repositories)
      .orderBy(desc(repositories.stars))
      .limit(10)
      .all();

    // Get evaluation statistics
    const totalEvaluations = await db
      .select({ count: sql<number>`count(*)` })
      .from(evaluations)
      .get();

    const avgScore = await db
      .select({ avg: sql<number>`avg(score)` })
      .from(evaluations)
      .get();

    // Get recent activity
    const recentLogs = await db
      .select()
      .from(systemLogs)
      .where(eq(systemLogs.subsystem, 'agent_evaluator'))
      .orderBy(desc(systemLogs.createdAt))
      .limit(5)
      .all();

    // Get language distribution
    const languageStats = await db
      .select({
        language: repositories.language,
        count: sql<number>`count(*)`,
        totalStars: sql<number>`sum(${repositories.stars})`,
      })
      .from(repositories)
      .groupBy(repositories.language)
      .orderBy(desc(sql`count(*)`))
      .limit(10)
      .all();

    return c.json({
      success: true,
      statistics: {
        totalRepositories: totalRepos?.count || 0,
        trendingRepositories: trendingRepos?.count || 0,
        starredRepositories: starredRepos?.count || 0,
        totalEvaluations: totalEvaluations?.count || 0,
        averageScore: avgScore?.avg ? Math.round(avgScore.avg * 10) / 10 : 0,
      },
      topRepositories,
      languageDistribution: languageStats,
      recentActivity: recentLogs,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching dashboard summary:', error);
    return c.json({ success: false, error: 'Failed to fetch summary' }, 500);
  }
});

// GET /api/dashboard/metrics
dashboardRouter.get('/metrics', async (c) => {
  const db = drizzle(c.env.DB);
  const category = c.req.query('category');
  const limit = parseInt(c.req.query('limit') || '100');

  try {
    let query = db.select().from(dashboardMetrics);

    if (category) {
      query = query.where(eq(dashboardMetrics.category, category));
    }

    const metrics = await query
      .orderBy(desc(dashboardMetrics.timestamp))
      .limit(limit);

    // Group metrics by category
    const grouped = metrics.reduce((acc, metric) => {
      if (!acc[metric.category]) {
        acc[metric.category] = [];
      }
      acc[metric.category].push(metric);
      return acc;
    }, {} as Record<string, typeof metrics>);

    return c.json({
      metrics,
      grouped,
      total: metrics.length,
    });
  } catch (error) {
    console.error('Error fetching dashboard metrics:', error);
    return c.json({ error: 'Failed to fetch metrics' }, 500);
  }
});

// GET /api/dashboard/charts/:category
dashboardRouter.get('/charts/:category', async (c) => {
  const db = drizzle(c.env.DB);
  const category = c.req.param('category');
  const days = parseInt(c.req.query('days') || '7');

  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startTimestamp = Math.floor(startDate.getTime() / 1000);

    const metrics = await db
      .select()
      .from(dashboardMetrics)
      .where(
        and(
          eq(dashboardMetrics.category, category),
          gte(dashboardMetrics.timestamp, startTimestamp)
        )
      )
      .orderBy(desc(dashboardMetrics.timestamp));

    // Format data for charts
    const chartData = metrics.map((m) => ({
      timestamp: m.timestamp,
      value: m.metricValue,
      name: m.metricName,
      type: m.metricType,
    }));

    return c.json({ data: chartData });
  } catch (error) {
    console.error('Error fetching chart data:', error);
    return c.json({ error: 'Failed to fetch chart data' }, 500);
  }
});

export { dashboardRouter };

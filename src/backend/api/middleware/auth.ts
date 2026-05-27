/**
 * @fileoverview Authentication middleware
 * Single-user system using WORKER_API_KEY for authentication
 */

import type { Context, Next } from 'hono';
import type { Bindings, Variables } from '../index';

/**
 * Validates request using WORKER_API_KEY from secrets store
 * No per-user authentication - single API key for all admin operations
 */
export async function authMiddleware(
  c: Context<{ Bindings: Bindings; Variables: Variables }>,
  next: Next
) {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized - Missing API key' }, 401);
  }

  const providedKey = authHeader.substring(7);

  try {
    // Get the WORKER_API_KEY from secrets store
    const validApiKey = await c.env.WORKER_API_KEY.get();

    if (!validApiKey) {
      console.error('WORKER_API_KEY not configured in secrets store');
      return c.json({ error: 'Server authentication misconfigured' }, 500);
    }

    // Compare provided key with stored key
    if (providedKey !== validApiKey) {
      return c.json({ error: 'Invalid API key' }, 401);
    }

    // Authentication successful - continue to route handler
    await next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return c.json({ error: 'Authentication failed' }, 500);
  }
}

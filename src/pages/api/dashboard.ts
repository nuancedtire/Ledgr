import type { APIRoute } from 'astro';
import { getDb } from '../../lib/db/client';
import { getUserTransactions } from '../../lib/services/transactions';
import { computeDashboardData } from '../../lib/services/insights';

export const GET: APIRoute = async ({ locals }) => {
  const user = locals.user;
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const env = locals.runtime.env;

  try {
    const db = getDb(env.DB);
    const { transactions } = await getUserTransactions(db, env.ENCRYPTION_KEY, user.id, {
      limit: 10000, // Get all transactions for dashboard computation
    });

    const dashboardData = computeDashboardData(transactions);
    return Response.json(dashboardData);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ error: message }, { status: 500 });
  }
};

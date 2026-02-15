import type { APIRoute } from 'astro';
import { json, getAuthUser, getEnv, getDb } from '../../lib/api-helpers';
import { eq, and } from 'drizzle-orm';
import * as schema from '../../lib/schema';
import { computeClientData, type Transaction, type AIInsight } from '../../lib/process-csv';

export const GET: APIRoute = async (context) => {
  const session = await getAuthUser(context);
  if (!session?.user) return json({ error: 'Unauthorized' }, 401);

  const env = getEnv(context);
  const db = getDb(env);
  const userId = session.user.id;

  try {
    const rows = await db
      .select()
      .from(schema.transaction)
      .where(eq(schema.transaction.userId, userId));

    if (rows.length === 0) {
      return json({ empty: true, data: null });
    }

    const txns: Transaction[] = rows.map((r) => ({
      id: r.id,
      type: r.type,
      product: r.product,
      startedDate: r.startedDate,
      completedDate: r.completedDate,
      description: r.description,
      amount: r.amount,
      fee: r.fee,
      currency: r.currency,
      state: r.state,
      balance: r.balance,
      category: r.category,
      fingerprint: r.fingerprint,
    }));

    // Check insight cache
    const dataHash = String(rows.length) + '-' + (rows[rows.length - 1]?.fingerprint || '');
    let insights: AIInsight[] = [];

    const cached = await db
      .select()
      .from(schema.insightCache)
      .where(
        and(
          eq(schema.insightCache.userId, userId),
          eq(schema.insightCache.dataHash, dataHash),
        ),
      );

    if (cached.length > 0) {
      insights = JSON.parse(cached[0].insights);
    }

    const clientData = computeClientData(txns, insights);
    return json({ empty: false, data: clientData, insightsCached: cached.length > 0 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return json({ error: message }, 500);
  }
};

export const DELETE: APIRoute = async (context) => {
  const session = await getAuthUser(context);
  if (!session?.user) return json({ error: 'Unauthorized' }, 401);

  const env = getEnv(context);
  const db = getDb(env);
  const userId = session.user.id;

  await db.delete(schema.transaction).where(eq(schema.transaction.userId, userId));
  await db.delete(schema.csvUpload).where(eq(schema.csvUpload.userId, userId));
  await db.delete(schema.insightCache).where(eq(schema.insightCache.userId, userId));

  return json({ deleted: true });
};

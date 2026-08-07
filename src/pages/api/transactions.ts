import type { APIRoute } from 'astro';
import { eq, and } from 'drizzle-orm';
import { getDb } from '../../db';
import { transactions } from '../../db/schema';

export const DELETE: APIRoute = async ({ request, locals }) => {
  const session = locals.session;
  if (!session) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const env = locals.runtime.env;
  const db = getDb(env.DB);

  try {
    const body = (await request.json()) as { ids?: string[] };
    const ids = body.ids;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return new Response(JSON.stringify({ error: 'No transaction IDs provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let deleted = 0;
    for (const id of ids) {
      const result = await db
        .delete(transactions)
        .where(and(eq(transactions.id, id), eq(transactions.userId, session.userId)));
      deleted++;
    }

    return new Response(JSON.stringify({ success: true, deleted }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Delete transactions error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Delete failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
};

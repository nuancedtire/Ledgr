import type { APIRoute } from 'astro';
import { getDb } from '../../lib/db/client';
import { getUserTransactions, deleteTransaction } from '../../lib/services/transactions';

export const GET: APIRoute = async ({ url, locals }) => {
  const user = locals.user;
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const env = locals.runtime.env;
  const db = getDb(env.DB);

  const limit = parseInt(url.searchParams.get('limit') ?? '50');
  const offset = parseInt(url.searchParams.get('offset') ?? '0');
  const category = url.searchParams.get('category') ?? undefined;
  const search = url.searchParams.get('search') ?? undefined;

  try {
    const result = await getUserTransactions(db, env.ENCRYPTION_KEY, user.id, {
      limit,
      offset,
      category,
      search,
    });

    return Response.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ error: message }, { status: 500 });
  }
};

export const DELETE: APIRoute = async ({ url, locals }) => {
  const user = locals.user;
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const env = locals.runtime.env;
  const db = getDb(env.DB);
  const id = url.searchParams.get('id');

  if (!id) {
    return Response.json({ error: 'Missing transaction id' }, { status: 400 });
  }

  try {
    const deleted = await deleteTransaction(db, user.id, id);
    return Response.json({ deleted });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ error: message }, { status: 500 });
  }
};

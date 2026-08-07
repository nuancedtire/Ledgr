import type { APIRoute } from 'astro';
import { getDb } from '../../lib/db/client';
import { getUserUploads, deleteUpload } from '../../lib/services/transactions';

export const GET: APIRoute = async ({ locals }) => {
  const user = locals.user;
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const env = locals.runtime.env;
  const db = getDb(env.DB);

  try {
    const uploadsList = await getUserUploads(db, user.id);
    return Response.json({ uploads: uploadsList });
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
    return Response.json({ error: 'Missing upload id' }, { status: 400 });
  }

  try {
    const result = await deleteUpload(db, user.id, id);
    return Response.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ error: message }, { status: 500 });
  }
};

import type { APIRoute } from 'astro';
import { json, getAuthUser } from '../../lib/api-helpers';

export const GET: APIRoute = async (context) => {
  const session = await getAuthUser(context);
  if (!session?.user) return json({ error: 'Unauthorized' }, 401);
  return json({ user: session.user });
};

import type { APIRoute } from 'astro';
import { createAuth } from '../../../lib/auth';

export const ALL: APIRoute = async (context) => {
  const runtime = (context.locals as any).runtime;
  const env = runtime?.env;
  if (!env?.DB) {
    return new Response('Server not configured', { status: 500 });
  }
  const auth = createAuth(env.DB, env);
  return auth.handler(context.request);
};

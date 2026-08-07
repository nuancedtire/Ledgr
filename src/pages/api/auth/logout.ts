import type { APIRoute } from 'astro';
import { destroySession } from '../../../lib/auth/session';

export const GET: APIRoute = async ({ request, locals, redirect }) => {
  const env = locals.runtime.env;
  const cookieHeader = request.headers.get('cookie');
  const clearCookie = await destroySession(env.SESSIONS, cookieHeader);

  return new Response(null, {
    status: 302,
    headers: {
      Location: '/login',
      'Set-Cookie': clearCookie,
    },
  });
};

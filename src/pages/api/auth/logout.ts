import type { APIRoute } from 'astro';
import {
  deleteSession,
  getSessionIdFromCookie,
  getClearSessionCookie,
} from '../../../lib/auth';

export const GET: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env;
  const cookieHeader = request.headers.get('cookie');
  const sessionId = getSessionIdFromCookie(cookieHeader);

  if (sessionId) {
    await deleteSession(env.SESSIONS, sessionId);
  }

  return new Response(null, {
    status: 302,
    headers: {
      Location: '/login',
      'Set-Cookie': getClearSessionCookie(),
    },
  });
};

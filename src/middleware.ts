import { defineMiddleware } from 'astro:middleware';
import { getSession, getSessionIdFromCookie } from './lib/auth';

// Routes that don't require authentication
const PUBLIC_ROUTES = [
  '/login',
  '/api/auth/login',
  '/api/auth/callback',
  '/api/auth/logout',
];

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

  // Allow public routes
  if (PUBLIC_ROUTES.some((route) => pathname.startsWith(route))) {
    return next();
  }

  // Allow static assets
  if (pathname.startsWith('/_astro/') || pathname.match(/\.(css|js|png|jpg|svg|ico|woff2?)$/)) {
    return next();
  }

  const env = context.locals.runtime.env;
  const cookieHeader = context.request.headers.get('cookie');
  const sessionId = getSessionIdFromCookie(cookieHeader);

  if (sessionId) {
    const session = await getSession(env.SESSIONS, sessionId);
    if (session) {
      context.locals.session = session;
      return next();
    }
  }

  // No valid session — redirect to login
  return context.redirect('/login');
});

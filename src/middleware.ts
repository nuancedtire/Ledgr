import { defineMiddleware } from 'astro:middleware';
import { getSession } from './lib/auth/session';

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
  if (PUBLIC_ROUTES.some(route => pathname.startsWith(route))) {
    return next();
  }

  // Allow static assets
  if (pathname.startsWith('/_astro/') || pathname.startsWith('/favicon')) {
    return next();
  }

  const env = context.locals.runtime.env;
  const cookieHeader = context.request.headers.get('cookie');
  const session = await getSession(env.SESSIONS, cookieHeader);

  if (!session) {
    // Redirect to login for page requests, 401 for API requests
    if (pathname.startsWith('/api/')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return context.redirect('/login');
  }

  // Attach user info to locals
  context.locals.user = {
    id: session.userId,
    email: session.email,
    displayName: session.displayName,
  };
  context.locals.session = {
    id: session.id,
    userId: session.userId,
  };

  return next();
});

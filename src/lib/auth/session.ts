/**
 * Session management using Cloudflare KV.
 * Sessions are stored with a TTL and contain user info.
 */

const SESSION_TTL = 60 * 60 * 24 * 7; // 7 days
const SESSION_COOKIE = 'ledgr_session';

export interface SessionData {
  userId: string;
  email: string;
  displayName: string;
  createdAt: number;
}

/** Generate a cryptographically random session ID */
function generateSessionId(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let hex = '';
  for (const b of bytes) hex += b.toString(16).padStart(2, '0');
  return hex;
}

/** Create a new session in KV and return the session cookie header */
export async function createSession(
  kv: KVNamespace,
  data: SessionData,
): Promise<{ sessionId: string; cookie: string }> {
  const sessionId = generateSessionId();
  await kv.put(`session:${sessionId}`, JSON.stringify(data), {
    expirationTtl: SESSION_TTL,
  });

  const cookie = `${SESSION_COOKIE}=${sessionId}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_TTL}`;
  return { sessionId, cookie };
}

/** Get session data from KV using the session cookie */
export async function getSession(
  kv: KVNamespace,
  cookieHeader: string | null,
): Promise<(SessionData & { id: string }) | null> {
  if (!cookieHeader) return null;

  const sessionId = parseCookie(cookieHeader, SESSION_COOKIE);
  if (!sessionId) return null;

  const raw = await kv.get(`session:${sessionId}`);
  if (!raw) return null;

  try {
    const data = JSON.parse(raw) as SessionData;
    return { ...data, id: sessionId };
  } catch {
    return null;
  }
}

/** Delete a session from KV and return a clear-cookie header */
export async function destroySession(
  kv: KVNamespace,
  cookieHeader: string | null,
): Promise<string> {
  if (cookieHeader) {
    const sessionId = parseCookie(cookieHeader, SESSION_COOKIE);
    if (sessionId) {
      await kv.delete(`session:${sessionId}`);
    }
  }
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

/** Store temporary auth state (code verifier, state) in KV */
export async function storeAuthState(
  kv: KVNamespace,
  state: string,
  data: { codeVerifier: string; returnTo?: string },
): Promise<void> {
  await kv.put(`auth_state:${state}`, JSON.stringify(data), {
    expirationTtl: 600, // 10 minutes
  });
}

/** Retrieve and delete temporary auth state */
export async function consumeAuthState(
  kv: KVNamespace,
  state: string,
): Promise<{ codeVerifier: string; returnTo?: string } | null> {
  const raw = await kv.get(`auth_state:${state}`);
  if (!raw) return null;
  await kv.delete(`auth_state:${state}`);
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function parseCookie(header: string, name: string): string | null {
  const match = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? match[1] : null;
}

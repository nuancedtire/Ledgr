import type { APIRoute } from 'astro';
import { json, getAuthUser, getEnv, getDb } from '../../lib/api-helpers';
import { eq } from 'drizzle-orm';
import * as schema from '../../lib/schema';
import { decrypt } from '../../lib/crypto';

export const GET: APIRoute = async (context) => {
  const session = await getAuthUser(context);
  if (!session?.user) return json({ error: 'Unauthorized' }, 401);

  const env = getEnv(context);
  const db = getDb(env);
  const userId = session.user.id;

  const uploads = await db
    .select()
    .from(schema.csvUpload)
    .where(eq(schema.csvUpload.userId, userId));

  if (uploads.length === 0) {
    return json({ error: 'No data to export' }, 404);
  }

  const latest = uploads[uploads.length - 1];
  const csvText = await decrypt(
    latest.encryptedData,
    latest.iv,
    userId,
    env.ENCRYPTION_SECRET,
  );

  return new Response(csvText, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="ledgr-export-${Date.now()}.csv"`,
    },
  });
};

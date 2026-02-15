import type { APIRoute } from 'astro';
import { json, getAuthUser, getEnv, getDb } from '../../lib/api-helpers';
import { eq } from 'drizzle-orm';
import * as schema from '../../lib/schema';

export const GET: APIRoute = async (context) => {
  const session = await getAuthUser(context);
  if (!session?.user) return json({ error: 'Unauthorized' }, 401);

  const env = getEnv(context);
  const db = getDb(env);

  const uploads = await db
    .select({
      id: schema.csvUpload.id,
      filename: schema.csvUpload.filename,
      rowCount: schema.csvUpload.rowCount,
      uploadedAt: schema.csvUpload.uploadedAt,
    })
    .from(schema.csvUpload)
    .where(eq(schema.csvUpload.userId, session.user.id));

  return json({ uploads });
};

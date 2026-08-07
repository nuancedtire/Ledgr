import type { APIRoute } from 'astro';
import { eq, and } from 'drizzle-orm';
import { getDb } from '../../db';
import { uploads, transactions } from '../../db/schema';

export const DELETE: APIRoute = async ({ request, locals }) => {
  const session = locals.session;
  if (!session) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const env = locals.runtime.env;
  const db = getDb(env.DB);

  try {
    const body = (await request.json()) as { uploadId?: string };
    const uploadId = body.uploadId;

    if (!uploadId) {
      return new Response(JSON.stringify({ error: 'No upload ID provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Delete associated transactions first
    await db
      .delete(transactions)
      .where(
        and(eq(transactions.uploadId, uploadId), eq(transactions.userId, session.userId)),
      );

    // Delete the upload record
    await db
      .delete(uploads)
      .where(and(eq(uploads.id, uploadId), eq(uploads.userId, session.userId)));

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Delete upload error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Delete failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
};

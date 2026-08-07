import type { APIRoute } from 'astro';
import { getDb } from '../../lib/db/client';
import { validateRevolutCSV } from '../../lib/csv/parser';
import { ingestCSV } from '../../lib/services/transactions';

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const env = locals.runtime.env;

  try {
    const csvText = await request.text();

    // Validate CSV format
    const validation = validateRevolutCSV(csvText);
    if (!validation.valid) {
      return Response.json({ error: validation.error }, { status: 400 });
    }

    const db = getDb(env.DB);
    const result = await ingestCSV(
      db,
      env.ENCRYPTION_KEY,
      user.id,
      csvText,
      `upload-${Date.now()}.csv`,
    );

    return Response.json({
      success: true,
      totalRows: result.totalRows,
      newRows: result.newRows,
      duplicateRows: result.duplicateRows,
      uploadId: result.uploadId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ error: message }, { status: 500 });
  }
};

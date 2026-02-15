import type { APIRoute } from 'astro';
import { json, getAuthUser, getEnv, getDb } from '../../lib/api-helpers';
import { eq } from 'drizzle-orm';
import * as schema from '../../lib/schema';
import { encrypt } from '../../lib/crypto';
import { parseCSV } from '../../lib/process-csv';

export const POST: APIRoute = async (context) => {
  const session = await getAuthUser(context);
  if (!session?.user) return json({ error: 'Unauthorized' }, 401);

  const env = getEnv(context);
  const db = getDb(env);
  const userId = session.user.id;

  try {
    const csvText = await context.request.text();
    const parsed = parseCSV(csvText);
    if (parsed.length === 0) {
      return json({ error: 'No valid transactions found in CSV' }, 400);
    }

    // Encrypt the raw CSV
    const { encrypted, iv } = await encrypt(csvText, userId, env.ENCRYPTION_SECRET);

    // Store encrypted upload
    const uploadId = crypto.randomUUID();
    await db.insert(schema.csvUpload).values({
      id: uploadId,
      userId,
      filename: `upload-${Date.now()}.csv`,
      encryptedData: encrypted,
      iv,
      rowCount: parsed.length,
      uploadedAt: new Date(),
    });

    // Upsert transactions (deduplicate by fingerprint)
    const existing = await db
      .select({ fingerprint: schema.transaction.fingerprint })
      .from(schema.transaction)
      .where(eq(schema.transaction.userId, userId));

    const existingFPs = new Set(existing.map((e) => e.fingerprint));
    const newTxns = parsed.filter((t) => !existingFPs.has(t.fingerprint));

    if (newTxns.length > 0) {
      for (let i = 0; i < newTxns.length; i += 50) {
        const batch = newTxns.slice(i, i + 50);
        await db.insert(schema.transaction).values(
          batch.map((t) => ({
            id: t.id,
            userId,
            type: t.type,
            product: t.product,
            startedDate: t.startedDate,
            completedDate: t.completedDate,
            description: t.description,
            amount: t.amount,
            fee: t.fee,
            currency: t.currency,
            state: t.state,
            balance: t.balance,
            category: t.category,
            fingerprint: t.fingerprint,
          })),
        );
      }
    }

    // Invalidate insight cache
    await db.delete(schema.insightCache).where(eq(schema.insightCache.userId, userId));

    return json({
      uploaded: parsed.length,
      newTransactions: newTxns.length,
      duplicatesSkipped: parsed.length - newTxns.length,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return json({ error: message }, 500);
  }
};

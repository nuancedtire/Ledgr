import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { getDb } from '../../db';
import { users, transactions, uploads, categories } from '../../db/schema';
import { encrypt, encryptNumber } from '../../lib/crypto';
import { categorize, CATEGORY_COLORS } from '../../lib/categories';

interface ParsedRow {
  type: string;
  product: string;
  startedDate: string;
  completedDate: string;
  description: string;
  amount: number;
  fee: number;
  currency: string;
  state: string;
  balance: number | null;
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (const ch of line) {
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

function parseCSV(text: string): ParsedRow[] {
  const lines = text.trim().split('\n');
  const rows: ParsedRow[] = [];

  // Validate header
  const header = lines[0];
  if (!header.includes('Type') || !header.includes('Amount') || !header.includes('Started Date')) {
    throw new Error('Invalid CSV format. Expected Revolut statement with Type, Amount, Started Date columns.');
  }

  for (let i = 1; i < lines.length; i++) {
    const fields = parseCsvLine(lines[i]);
    if (fields.length < 10) continue;

    rows.push({
      type: fields[0],
      product: fields[1],
      startedDate: fields[2],
      completedDate: fields[3],
      description: fields[4],
      amount: parseFloat(fields[5]) || 0,
      fee: parseFloat(fields[6]) || 0,
      currency: fields[7],
      state: fields[8],
      balance: fields[9] ? parseFloat(fields[9]) : null,
    });
  }

  return rows;
}

export const POST: APIRoute = async ({ request, locals }) => {
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
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const overwrite = formData.get('overwrite') === 'true';

    if (!file || !file.name.endsWith('.csv')) {
      return new Response(JSON.stringify({ error: 'Please upload a CSV file' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const csvText = await file.text();
    const rows = parseCSV(csvText);

    if (rows.length === 0) {
      return new Response(JSON.stringify({ error: 'CSV contains no data rows' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get user's encryption salt
    const user = await db.select().from(users).where(eq(users.id, session.userId)).get();
    if (!user) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const masterSecret = env.ENCRYPTION_KEY_SECRET;
    const userSalt = user.encryptionSalt;

    // If overwrite, delete existing transactions
    if (overwrite) {
      await db.delete(transactions).where(eq(transactions.userId, session.userId));
      await db.delete(uploads).where(eq(uploads.userId, session.userId));
    }

    // Ensure categories exist for this user
    const existingCats = await db
      .select()
      .from(categories)
      .where(eq(categories.userId, session.userId))
      .all();
    const catNameToId = new Map(existingCats.map((c) => [c.name, c.id]));

    // Create missing categories
    const neededCats = new Set(rows.map((r) => categorize(r.description, r.type)));
    for (const catName of neededCats) {
      if (!catNameToId.has(catName)) {
        const catId = crypto.randomUUID();
        await db.insert(categories).values({
          id: catId,
          userId: session.userId,
          name: catName,
          color: CATEGORY_COLORS[catName] || '#9ca3af',
        });
        catNameToId.set(catName, catId);
      }
    }

    // Create upload record
    const uploadId = crypto.randomUUID();
    await db.insert(uploads).values({
      id: uploadId,
      userId: session.userId,
      filename: file.name,
      rowCount: rows.length,
      uploadedAt: new Date(),
    });

    // Encrypt and insert transactions in batches
    const BATCH_SIZE = 50;
    let inserted = 0;

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const values = await Promise.all(
        batch.map(async (row) => {
          const catName = categorize(row.description, row.type);
          const [encDescription, encAmount, encFee, encBalance] = await Promise.all([
            encrypt(row.description, masterSecret, userSalt),
            encryptNumber(row.amount, masterSecret, userSalt),
            encryptNumber(row.fee, masterSecret, userSalt),
            row.balance !== null
              ? encryptNumber(row.balance, masterSecret, userSalt)
              : null,
          ]);

          return {
            id: crypto.randomUUID(),
            userId: session.userId,
            uploadId,
            encDescription,
            encAmount,
            encFee,
            encBalance,
            type: row.type,
            product: row.product,
            currency: row.currency,
            state: row.state,
            categoryId: catNameToId.get(catName) ?? null,
            startedAt: new Date(row.startedDate),
            completedAt: row.completedDate ? new Date(row.completedDate) : null,
            amountSign: row.amount >= 0 ? 1 : -1,
            amountAbsCents: Math.round(Math.abs(row.amount) * 100),
            createdAt: new Date(),
          };
        }),
      );

      for (const val of values) {
        await db.insert(transactions).values(val);
        inserted++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        uploadId,
        rowCount: inserted,
        filename: file.name,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  } catch (err) {
    console.error('Upload error:', err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : 'Upload failed',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
};

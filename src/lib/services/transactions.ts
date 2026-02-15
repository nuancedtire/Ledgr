/**
 * Transaction service: handles CRUD operations with encryption.
 * Encrypts sensitive data before storing, decrypts on read.
 */

import { eq, and, desc, sql } from 'drizzle-orm';
import { transactions, uploads } from '../db/schema';
import type { AppDatabase } from '../db/client';
import { encrypt, decrypt, fingerprint } from '../crypto';
import { parseRevolutCSV, categorize, type RawTransaction } from '../csv/parser';

// ─── Types ───────────────────────────────────────────────────────

export interface DecryptedTransaction {
  id: string;
  userId: string;
  type: string;
  product: string;
  category: string;
  currency: string;
  state: string;
  startedDate: Date;
  completedDate: Date | null;
  // Decrypted fields
  description: string;
  amount: number;
  fee: number;
  balance: number | null;
}

interface EncryptedFields {
  description: string;
  amount: number;
  fee: number;
  balance: number | null;
}

// ─── Category colors ─────────────────────────────────────────────

export const CATEGORY_COLORS: Record<string, string> = {
  'Food Delivery': '#ef4444',
  'Transport': '#f97316',
  'Healthcare': '#ec4899',
  'Dining Out': '#f59e0b',
  'Groceries': '#22c55e',
  'Shopping': '#8b5cf6',
  'Travel': '#06b6d4',
  'Housing': '#6366f1',
  'Subscriptions': '#14b8a6',
  'Transfers Out': '#64748b',
  'Utilities': '#a855f7',
  'Cash': '#78716c',
  'Fees': '#94a3b8',
  'Currency Exchange': '#71717a',
  'Other': '#9ca3af',
};

// ─── Ingest CSV ──────────────────────────────────────────────────

export interface IngestResult {
  totalRows: number;
  newRows: number;
  duplicateRows: number;
  uploadId: string;
}

export async function ingestCSV(
  db: AppDatabase,
  encryptionKey: string,
  userId: string,
  csvText: string,
  filename: string,
): Promise<IngestResult> {
  const rawTxns = parseRevolutCSV(csvText);

  // Create upload record
  const uploadId = crypto.randomUUID();
  await db.insert(uploads).values({
    id: uploadId,
    userId,
    filename,
    rowCount: rawTxns.length,
    status: 'processing',
  }).run();

  let newRows = 0;
  let duplicateRows = 0;

  // Process in batches
  const BATCH_SIZE = 50;
  for (let i = 0; i < rawTxns.length; i += BATCH_SIZE) {
    const batch = rawTxns.slice(i, i + BATCH_SIZE);
    const insertValues = [];

    for (const raw of batch) {
      const fp = await fingerprint([raw.type, raw.startedDate, raw.description, String(raw.amount)]);

      // Check for duplicates
      const existing = await db.select({ id: transactions.id })
        .from(transactions)
        .where(and(
          eq(transactions.userId, userId),
          eq(transactions.fingerprint, fp),
        ))
        .get();

      if (existing) {
        duplicateRows++;
        continue;
      }

      // Encrypt sensitive fields
      const sensitiveData: EncryptedFields = {
        description: raw.description,
        amount: raw.amount,
        fee: raw.fee,
        balance: raw.balance,
      };

      const encrypted = await encrypt(sensitiveData as unknown as Record<string, unknown>, encryptionKey, userId);
      const category = categorize(raw.description, raw.type);

      insertValues.push({
        id: crypto.randomUUID(),
        userId,
        uploadId,
        encryptedData: encrypted.ciphertext,
        iv: encrypted.iv,
        type: raw.type,
        product: raw.product,
        category,
        currency: raw.currency,
        state: raw.state,
        startedDate: new Date(raw.startedDate),
        completedDate: raw.completedDate ? new Date(raw.completedDate) : null,
        fingerprint: fp,
      });
      newRows++;
    }

    // Batch insert
    if (insertValues.length > 0) {
      for (const val of insertValues) {
        await db.insert(transactions).values(val).run();
      }
    }
  }

  // Update upload status
  await db.update(uploads)
    .set({ status: 'completed' })
    .where(eq(uploads.id, uploadId))
    .run();

  return {
    totalRows: rawTxns.length,
    newRows,
    duplicateRows,
    uploadId,
  };
}

// ─── Read transactions ───────────────────────────────────────────

export async function getUserTransactions(
  db: AppDatabase,
  encryptionKey: string,
  userId: string,
  options?: {
    limit?: number;
    offset?: number;
    category?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
  },
): Promise<{ transactions: DecryptedTransaction[]; total: number }> {
  // Build conditions
  const conditions = [eq(transactions.userId, userId)];

  if (options?.category) {
    conditions.push(eq(transactions.category, options.category));
  }

  // Get total count
  const countResult = await db.select({ count: sql<number>`count(*)` })
    .from(transactions)
    .where(and(...conditions))
    .get();
  const total = countResult?.count ?? 0;

  // Get paginated results
  let query = db.select()
    .from(transactions)
    .where(and(...conditions))
    .orderBy(desc(transactions.startedDate));

  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;

  const rows = await query.limit(limit).offset(offset).all();

  // Decrypt each transaction
  const decrypted: DecryptedTransaction[] = [];
  for (const row of rows) {
    try {
      const data = await decrypt<EncryptedFields>(
        { ciphertext: row.encryptedData, iv: row.iv },
        encryptionKey,
        userId,
      );

      // Apply search filter on decrypted data
      if (options?.search) {
        const searchLower = options.search.toLowerCase();
        if (!data.description.toLowerCase().includes(searchLower)) {
          continue;
        }
      }

      decrypted.push({
        id: row.id,
        userId: row.userId,
        type: row.type,
        product: row.product,
        category: row.category,
        currency: row.currency,
        state: row.state,
        startedDate: row.startedDate,
        completedDate: row.completedDate ?? null,
        description: data.description,
        amount: data.amount,
        fee: data.fee,
        balance: data.balance,
      });
    } catch {
      // Skip transactions that fail to decrypt
      continue;
    }
  }

  return { transactions: decrypted, total };
}

// ─── Delete operations ───────────────────────────────────────────

export async function deleteUpload(
  db: AppDatabase,
  userId: string,
  uploadId: string,
): Promise<{ deleted: number }> {
  // Delete transactions for this upload
  const result = await db.delete(transactions)
    .where(and(
      eq(transactions.userId, userId),
      eq(transactions.uploadId, uploadId),
    ))
    .run();

  // Delete the upload record
  await db.delete(uploads)
    .where(and(
      eq(uploads.userId, userId),
      eq(uploads.id, uploadId),
    ))
    .run();

  return { deleted: result.meta?.changes ?? 0 };
}

export async function deleteTransaction(
  db: AppDatabase,
  userId: string,
  transactionId: string,
): Promise<boolean> {
  const result = await db.delete(transactions)
    .where(and(
      eq(transactions.userId, userId),
      eq(transactions.id, transactionId),
    ))
    .run();

  return (result.meta?.changes ?? 0) > 0;
}

// ─── Get uploads ─────────────────────────────────────────────────

export async function getUserUploads(
  db: AppDatabase,
  userId: string,
) {
  return db.select()
    .from(uploads)
    .where(eq(uploads.userId, userId))
    .orderBy(desc(uploads.createdAt))
    .all();
}

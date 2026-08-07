import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

// ─── Users ───────────────────────────────────────────────────────
export const users = sqliteTable('users', {
  id: text('id').primaryKey(), // UUID
  entraId: text('entra_id').notNull().unique(),
  email: text('email').notNull(),
  displayName: text('display_name').notNull(),
  encryptionSalt: text('encryption_salt').notNull(), // Per-user salt for key derivation
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

// ─── Uploads ─────────────────────────────────────────────────────
export const uploads = sqliteTable('uploads', {
  id: text('id').primaryKey(), // UUID
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  filename: text('filename').notNull(),
  rowCount: integer('row_count').notNull(),
  uploadedAt: integer('uploaded_at', { mode: 'timestamp' }).notNull(),
});

// ─── Categories ──────────────────────────────────────────────────
export const categories = sqliteTable('categories', {
  id: text('id').primaryKey(), // UUID
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  color: text('color').notNull(),
});

// ─── Transactions ────────────────────────────────────────────────
// Financial data is AES-GCM encrypted at rest.
// Encrypted fields store base64-encoded ciphertext (iv:ciphertext).
export const transactions = sqliteTable('transactions', {
  id: text('id').primaryKey(), // UUID
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  uploadId: text('upload_id').references(() => uploads.id, { onDelete: 'set null' }),
  // Encrypted fields (AES-GCM, base64-encoded iv:ciphertext)
  encDescription: text('enc_description').notNull(),
  encAmount: text('enc_amount').notNull(),
  encFee: text('enc_fee').notNull(),
  encBalance: text('enc_balance'), // nullable
  // Plaintext metadata (needed for queries/sorting)
  type: text('type').notNull(), // Card Payment, Transfer, Topup, etc.
  product: text('product').notNull(), // Current, Savings
  currency: text('currency').notNull(),
  state: text('state').notNull(), // COMPLETED, PENDING, REVERTED
  categoryId: text('category_id').references(() => categories.id),
  startedAt: integer('started_at', { mode: 'timestamp' }).notNull(),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
  // Encrypted amount sign for query filtering (1 = positive, -1 = negative)
  amountSign: integer('amount_sign').notNull(),
  // Absolute amount for sorting/aggregation (rounded to cents)
  amountAbsCents: integer('amount_abs_cents').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

// ─── Type exports ────────────────────────────────────────────────
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Upload = typeof uploads.$inferSelect;
export type NewUpload = typeof uploads.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;

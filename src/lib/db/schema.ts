import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

// ─── Users ───────────────────────────────────────────────────────
export const users = sqliteTable('users', {
  id: text('id').primaryKey(), // UUID
  entraId: text('entra_id').notNull().unique(),
  email: text('email').notNull(),
  displayName: text('display_name').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// ─── Uploads ─────────────────────────────────────────────────────
export const uploads = sqliteTable('uploads', {
  id: text('id').primaryKey(), // UUID
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  filename: text('filename').notNull(),
  rowCount: integer('row_count').notNull(),
  status: text('status', { enum: ['processing', 'completed', 'failed'] }).notNull().default('processing'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// ─── Categories ──────────────────────────────────────────────────
export const categories = sqliteTable('categories', {
  id: text('id').primaryKey(), // UUID
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  color: text('color').notNull(),
});

// ─── Transactions ────────────────────────────────────────────────
// Sensitive fields (description, amount, balance) are encrypted at rest
export const transactions = sqliteTable('transactions', {
  id: text('id').primaryKey(), // UUID
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  uploadId: text('upload_id').references(() => uploads.id, { onDelete: 'set null' }),
  // Encrypted fields stored as base64 strings
  encryptedData: text('encrypted_data').notNull(), // JSON blob: {description, amount, fee, balance}
  iv: text('iv').notNull(), // Initialization vector for AES-GCM
  // Non-sensitive indexed fields (stored in plaintext for querying)
  type: text('type').notNull(), // Card Payment, Transfer, Topup, etc.
  product: text('product').notNull(), // Current, Savings
  category: text('category').notNull(),
  currency: text('currency').notNull().default('GBP'),
  state: text('state').notNull(), // COMPLETED, PENDING, REVERTED
  startedDate: integer('started_date', { mode: 'timestamp' }).notNull(),
  completedDate: integer('completed_date', { mode: 'timestamp' }),
  // Fingerprint for deduplication (hash of type+date+desc+amount)
  fingerprint: text('fingerprint').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// ─── Type exports ────────────────────────────────────────────────
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Upload = typeof uploads.$inferSelect;
export type NewUpload = typeof uploads.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;

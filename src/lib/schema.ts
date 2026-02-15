import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

// ── Better Auth tables ──
export const user = sqliteTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
  image: text('image'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const session = sqliteTable('session', {
  id: text('id').primaryKey(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  token: text('token').notNull().unique(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id').notNull().references(() => user.id),
});

export const account = sqliteTable('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id').notNull().references(() => user.id),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: integer('access_token_expires_at', { mode: 'timestamp' }),
  refreshTokenExpiresAt: integer('refresh_token_expires_at', { mode: 'timestamp' }),
  scope: text('scope'),
  password: text('password'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const verification = sqliteTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
});

// ── App tables ──
export const csvUpload = sqliteTable('csv_upload', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id),
  filename: text('filename').notNull(),
  encryptedData: text('encrypted_data').notNull(), // base64-encoded encrypted CSV
  iv: text('iv').notNull(), // base64-encoded IV for AES-GCM
  rowCount: integer('row_count').notNull(),
  uploadedAt: integer('uploaded_at', { mode: 'timestamp' }).notNull(),
});

export const transaction = sqliteTable('transaction', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id),
  type: text('type').notNull(),
  product: text('product').notNull(),
  startedDate: text('started_date').notNull(),
  completedDate: text('completed_date'),
  description: text('description').notNull(),
  amount: real('amount').notNull(),
  fee: real('fee').notNull().default(0),
  currency: text('currency').notNull().default('GBP'),
  state: text('state').notNull(),
  balance: real('balance'),
  category: text('category').notNull().default('Other'),
  fingerprint: text('fingerprint').notNull(), // type|date|desc|amount for dedup
});

// ── AI Insights cache ──
export const insightCache = sqliteTable('insight_cache', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id),
  insights: text('insights').notNull(), // JSON string of AIInsight[]
  generatedAt: integer('generated_at', { mode: 'timestamp' }).notNull(),
  dataHash: text('data_hash').notNull(), // hash of transaction data to invalidate cache
});

# Ledgr — Personal Financial Dashboard

A privacy-first financial dashboard built with **Astro SSR** on **Cloudflare Workers**. Upload your Revolut CSV statements and get encrypted, personalised financial insights.

## Architecture

| Layer | Technology |
|-------|-----------|
| **Framework** | Astro 5 (SSR mode) |
| **Hosting** | Cloudflare Workers + Pages |
| **Database** | Cloudflare D1 (SQLite) + Drizzle ORM |
| **Auth** | Microsoft Entra ID OAuth 2.0 + PKCE |
| **Sessions** | Cloudflare KV |
| **Encryption** | AES-256-GCM via Web Crypto API |
| **Interactive UI** | React Islands (`client:load` / `client:visible`) |
| **Charts** | Chart.js |

## Key Features

- **End-to-end encryption**: All financial data (descriptions, amounts, balances) encrypted at rest with AES-256-GCM. Each user gets a unique encryption key derived from a master secret + per-user salt via PBKDF2.
- **Microsoft SSO**: Sign in with your Microsoft account via Entra ID with PKCE flow.
- **CSV Upload**: Upload Revolut CSV exports with drag-and-drop. Data is parsed, categorised, encrypted, and stored in D1.
- **Real Insights**: Spending analysis, category breakdowns, merchant rankings, and actionable financial tips — all computed from your actual data.
- **Data Management**: Search, filter, and delete transactions. Manage uploads with overwrite support.

## Project Structure

```
src/
├── components/          # React Islands (interactive UI)
│   ├── CsvUpload.tsx    # CSV upload with drag-and-drop
│   └── DataManager.tsx  # Transaction/upload management
├── db/
│   ├── schema.ts        # Drizzle ORM schema (users, transactions, etc.)
│   └── index.ts         # Database connection helper
├── lib/
│   ├── auth.ts          # Entra ID OAuth + PKCE + KV sessions
│   ├── crypto.ts        # AES-GCM encryption/decryption
│   ├── categories.ts    # Transaction categorisation rules
│   └── data-service.ts  # D1 queries + dashboard aggregations
├── pages/
│   ├── index.astro      # Main dashboard (SSR)
│   ├── login.astro      # Login page
│   └── api/
│       ├── auth/        # OAuth routes (login, callback, logout)
│       ├── upload.ts    # CSV upload endpoint
│       ├── transactions.ts  # Transaction CRUD
│       └── uploads.ts   # Upload management
├── middleware.ts         # Auth middleware (session validation)
├── scripts/             # Client-side vanilla TS (charts, tabs)
├── styles/global.css    # Design system
└── env.d.ts             # Cloudflare runtime types
```

## Setup

### Prerequisites

- Node.js 20+
- pnpm 10+
- Cloudflare account with Workers, D1, and KV enabled
- Microsoft Entra ID (Azure AD) app registration

### 1. Clone and install

```bash
git clone https://github.com/nuancedtire/Ledgr.git
cd Ledgr
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Fill in your values
```

### 3. Set up Cloudflare resources

```bash
# Create D1 database
wrangler d1 create ledgr-db
# Update wrangler.toml with the database_id

# Create KV namespace
wrangler kv namespace create SESSIONS
# Update wrangler.toml with the KV namespace id

# Set secrets
wrangler secret put ENCRYPTION_KEY_SECRET
```

### 4. Set up Microsoft Entra ID

1. Go to [Azure Portal](https://portal.azure.com) → App registrations → New registration
2. Set redirect URI to `{APP_URL}/api/auth/callback`
3. Under "Authentication", enable "ID tokens" and "Access tokens"
4. Copy the Application (client) ID and Directory (tenant) ID to your config

### 5. Run database migrations

```bash
pnpm db:generate
pnpm db:push
```

### 6. Development

```bash
pnpm dev          # Astro dev server
pnpm cf:dev       # Build + Wrangler dev (full Cloudflare emulation)
```

### 7. Deploy

```bash
pnpm ship         # Build + deploy to Cloudflare
```

## Security Model

- **Encryption at rest**: Transaction descriptions, amounts, fees, and balances are encrypted with AES-256-GCM before writing to D1. Only plaintext metadata (type, category, dates) needed for queries remains unencrypted.
- **Per-user keys**: Each user's encryption key is derived via PBKDF2 (100k iterations, SHA-256) from the master secret + a unique random salt stored in the user record.
- **Session security**: Sessions stored in Cloudflare KV with 7-day TTL. HttpOnly, SameSite=Lax cookies.
- **PKCE**: OAuth flow uses Proof Key for Code Exchange to prevent authorization code interception.

## License

ISC

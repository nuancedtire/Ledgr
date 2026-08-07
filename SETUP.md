# Ledgr Setup Guide

This guide walks you through setting up the Ledgr financial dashboard with Cloudflare D1, KV, and Microsoft Entra ID authentication.

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [pnpm](https://pnpm.io/) 10+
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) (`pnpm add -g wrangler`)
- A [Cloudflare account](https://dash.cloudflare.com/)
- A [Microsoft Azure account](https://portal.azure.com/) (for Entra ID)

## 1. Clone & Install

```bash
git clone https://github.com/nuancedtire/Ledgr.git
cd Ledgr
pnpm install
```

## 2. Cloudflare D1 Database

Create a D1 database:

```bash
wrangler d1 create ledgr-db
```

Copy the `database_id` from the output and update `wrangler.jsonc`:

```jsonc
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "ledgr-db",
    "database_id": "YOUR_D1_DATABASE_ID"  // ← paste here
  }
]
```

Run the migration to create tables:

```bash
# Remote (production)
pnpm db:migrate

# Local (development)
pnpm db:migrate:local
```

## 3. Cloudflare KV Namespace

Create a KV namespace for sessions:

```bash
wrangler kv namespace create SESSIONS
```

Copy the `id` from the output and update `wrangler.jsonc`:

```jsonc
"kv_namespaces": [
  {
    "binding": "SESSIONS",
    "id": "YOUR_KV_NAMESPACE_ID"  // ← paste here
  }
]
```

## 4. Microsoft Entra ID (Azure AD)

### Create App Registration

1. Go to [Azure Portal](https://portal.azure.com/) → **Microsoft Entra ID** → **App registrations** → **New registration**
2. Name: `Ledgr`
3. Supported account types: **Accounts in this organizational directory only** (or multi-tenant if needed)
4. Redirect URI: **Web** → `http://localhost:4321/api/auth/callback`
5. Click **Register**

### Configure the App

1. Note the **Application (client) ID** and **Directory (tenant) ID** from the Overview page
2. Go to **Certificates & secrets** → **New client secret** → copy the secret value
3. Go to **API permissions** → ensure `openid`, `profile`, `email` are granted
4. Go to **Authentication** → add production redirect URI: `https://your-domain.com/api/auth/callback`

### Set Environment Variables

Update `wrangler.jsonc` vars:

```jsonc
"vars": {
  "ENTRA_CLIENT_ID": "your-application-client-id",
  "ENTRA_TENANT_ID": "your-directory-tenant-id",
  "ENTRA_REDIRECT_URI": "http://localhost:4321/api/auth/callback",
  "APP_URL": "http://localhost:4321"
}
```

Set secrets via Wrangler:

```bash
wrangler secret put ENTRA_CLIENT_SECRET
wrangler secret put ENCRYPTION_KEY
```

For the `ENCRYPTION_KEY`, generate a random 32+ character string:

```bash
openssl rand -base64 32
```

## 5. Local Development

For local development, create a `.dev.vars` file (gitignored):

```bash
cp .env.example .dev.vars
# Edit .dev.vars with your actual values
```

Then run:

```bash
pnpm dev
```

Or to test with Wrangler (closer to production):

```bash
pnpm cf:dev
```

## 6. Deploy

```bash
pnpm ship
```

This builds the Astro site and deploys to Cloudflare Workers.

## Architecture Overview

```
┌─────────────────────────────────────────────┐
│                  Browser                     │
│  ┌─────────┐  ┌──────────┐  ┌────────────┐ │
│  │  Astro   │  │  React   │  │  Chart.js  │ │
│  │  Pages   │  │  Islands │  │  Charts    │ │
│  └─────────┘  └──────────┘  └────────────┘ │
└──────────────────┬──────────────────────────┘
                   │ HTTPS
┌──────────────────▼──────────────────────────┐
│           Cloudflare Workers                 │
│  ┌─────────────────────────────────────────┐│
│  │  Astro SSR (@astrojs/cloudflare)        ││
│  │  ┌──────────┐  ┌────────────────────┐   ││
│  │  │ Middleware│  │  API Routes        │   ││
│  │  │ (Auth)   │  │  /api/auth/*       │   ││
│  │  └──────────┘  │  /api/upload       │   ││
│  │                │  /api/dashboard     │   ││
│  │                │  /api/transactions  │   ││
│  │                │  /api/export        │   ││
│  │                └────────────────────┘   ││
│  └─────────────────────────────────────────┘│
│  ┌──────────┐  ┌──────────┐  ┌───────────┐ │
│  │ D1 (SQL) │  │ KV Store │  │ Web Crypto│ │
│  │ Drizzle  │  │ Sessions │  │ AES-GCM   │ │
│  └──────────┘  └──────────┘  └───────────┘ │
└─────────────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│        Microsoft Entra ID                    │
│        OAuth 2.0 + PKCE                      │
└─────────────────────────────────────────────┘
```

## File Structure

```
src/
├── components/          # React Island components
│   ├── CSVUpload.tsx    # CSV file upload UI
│   ├── Toast.tsx        # Toast notifications
│   └── UploadModal.tsx  # Upload modal wrapper
├── lib/
│   ├── auth/
│   │   ├── entra.ts     # Entra ID OAuth helpers
│   │   └── session.ts   # KV session management
│   ├── csv/
│   │   └── parser.ts    # Revolut CSV parser
│   ├── db/
│   │   ├── client.ts    # Drizzle D1 client
│   │   └── schema.ts    # Database schema
│   ├── services/
│   │   ├── insights.ts  # Dashboard data computation
│   │   └── transactions.ts  # Transaction CRUD + encryption
│   └── crypto.ts        # AES-GCM encryption utilities
├── middleware.ts         # Auth middleware
├── pages/
│   ├── api/
│   │   ├── auth/        # OAuth routes
│   │   ├── dashboard.ts # Dashboard data API
│   │   ├── export.ts    # CSV/JSON export
│   │   ├── transactions.ts  # Transaction CRUD
│   │   ├── upload.ts    # CSV upload endpoint
│   │   └── uploads.ts   # Upload management
│   ├── index.astro      # Main dashboard
│   └── login.astro      # Login page
├── scripts/             # Client-side tab renderers (existing)
├── styles/
│   └── global.css       # Global styles
└── env.d.ts             # TypeScript env types
```

## Security

- **Encryption at rest**: All sensitive financial data (descriptions, amounts, balances) is encrypted using AES-256-GCM before storing in D1
- **Per-user keys**: Encryption keys are derived from a master key + user ID using HKDF, so each user's data is isolated
- **Session security**: Sessions are stored in Cloudflare KV with HttpOnly, Secure, SameSite cookies
- **PKCE**: OAuth flow uses PKCE (Proof Key for Code Exchange) for additional security
- **No plaintext secrets**: Sensitive values are stored as Wrangler secrets, not in code

# Ledgr

A personal financial dashboard built with **Astro**, **React**, **TypeScript**, **Tailwind CSS**, and **Chart.js**. Sign in with Microsoft, upload your Revolut CSV statement, and get a beautiful dark-themed dashboard with AI-generated insights powered by Kimi K2.5.

![Astro](https://img.shields.io/badge/Astro-5.x-purple?logo=astro) ![React](https://img.shields.io/badge/React-19-blue?logo=react) ![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue?logo=typescript) ![Cloudflare](https://img.shields.io/badge/Cloudflare-Workers-orange?logo=cloudflare)

## Features

### Authentication
- **Microsoft OAuth** via Better Auth
- Session-based auth stored in Cloudflare D1
- Per-user data isolation

### Dashboard Tabs

| Tab | What it does |
|---|---|
| **Overview** | KPI strip, monthly cash flow chart, balance & savings history, category donut, weekday heatmap |
| **Transactions** | Search, filter by category/type/date/amount, sortable columns, pagination, expandable details, CSV export |
| **Categories** | Interactive donut chart, category cards, drill-down with monthly trend & top merchants |
| **Merchants** | Top 10 bar chart, searchable grid, drill-down with trends & transaction list |
| **Insights** | AI-generated personalised financial advice via Kimi K2.5 (Kilo AI) |
| **Manage Data** | Upload history, export decrypted CSV, delete all data |

### Security
- Uploaded CSV files are **encrypted with AES-256-GCM** using keys derived from user ID + server secret
- Transaction data stored in Cloudflare D1, isolated per user
- All API routes are authenticated

### AI Insights
- Powered by **Kimi K2.5** via [Kilo AI](https://kilo.ai) gateway
- Analyses spending patterns, categories, merchants, and trends
- Generates personalised warnings, tips, and wealth-building suggestions
- Results cached until new data is uploaded

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | [Astro](https://astro.build) (SSR mode) + [React](https://react.dev) |
| Styling | [Tailwind CSS](https://tailwindcss.com) v4 |
| Charts | [Chart.js](https://www.chartjs.org) |
| Auth | [Better Auth](https://www.better-auth.com) with Microsoft provider |
| Database | [Cloudflare D1](https://developers.cloudflare.com/d1/) via [Drizzle ORM](https://orm.drizzle.team) |
| AI | [Kilo AI Gateway](https://kilo.ai) → Kimi K2.5 (free) |
| Hosting | [Cloudflare Workers](https://workers.cloudflare.com) (via @astrojs/cloudflare) |
| Encryption | Web Crypto API (AES-256-GCM, PBKDF2) |

## Project Structure

```
ledgr/
├── wrangler.jsonc              # Cloudflare Workers + D1 config
├── drizzle.config.ts           # Drizzle Kit config
├── drizzle/                    # Generated D1 migrations
├── astro.config.mjs            # Astro + React + Tailwind + Cloudflare
├── src/
│   ├── lib/
│   │   ├── schema.ts           # Drizzle schema (auth + app tables)
│   │   ├── auth.ts             # Better Auth server config
│   │   ├── auth-client.ts      # Better Auth React client
│   │   ├── crypto.ts           # AES-256-GCM encrypt/decrypt
│   │   ├── process-csv.ts      # CSV parsing & data computation
│   │   ├── api-helpers.ts      # Shared API route utilities
│   │   └── get-runtime.ts      # Cloudflare runtime helper
│   ├── components/
│   │   ├── App.tsx             # Root component (AuthGuard + Dashboard)
│   │   ├── AuthGuard.tsx       # Login gate with Microsoft OAuth
│   │   ├── Dashboard.tsx       # Main dashboard with tab routing
│   │   └── dashboard/
│   │       ├── OverviewTab.tsx
│   │       ├── TransactionsTab.tsx
│   │       ├── CategoriesTab.tsx
│   │       ├── MerchantsTab.tsx
│   │       ├── InsightsTab.tsx
│   │       ├── DataManagement.tsx
│   │       ├── UploadModal.tsx
│   │       ├── ChartWrapper.tsx
│   │       └── utils.ts
│   ├── pages/
│   │   ├── index.astro         # Main page
│   │   └── api/
│   │       ├── auth/[...all].ts  # Better Auth handler
│   │       ├── data.ts           # GET data / DELETE all
│   │       ├── upload.ts         # POST CSV upload
│   │       ├── insights.ts       # POST generate AI insights
│   │       ├── uploads.ts        # GET upload history
│   │       ├── export.ts         # GET decrypted CSV export
│   │       └── me.ts             # GET current user
│   ├── layouts/
│   │   └── Layout.astro
│   ├── styles/
│   │   └── global.css          # Tailwind v4 + ambient effects
│   └── data/
│       └── statement.csv       # Sample data (not used at runtime)
└── dist/                       # Built output
```

## Setup

### 1. Prerequisites

- Node.js 20+
- pnpm
- Cloudflare account
- Microsoft Azure app registration (for OAuth)
- [Kilo AI](https://kilo.ai) API key

### 2. Install

```bash
pnpm install
```

### 3. Create D1 Database

```bash
npx wrangler d1 create ledgr-db
# Copy the database_id into wrangler.jsonc
```

### 4. Run Migrations

```bash
# Local development
pnpm db:migrate:local

# Production
pnpm db:migrate:remote
```

### 5. Configure Secrets

```bash
# Copy .dev.vars.example to .dev.vars for local dev
cp .dev.vars.example .dev.vars
# Edit with your values

# For production:
npx wrangler secret put MICROSOFT_CLIENT_ID
npx wrangler secret put MICROSOFT_CLIENT_SECRET
npx wrangler secret put ENCRYPTION_SECRET
npx wrangler secret put KILO_API_KEY
npx wrangler secret put BETTER_AUTH_SECRET
```

### 6. Microsoft Azure Setup

1. Go to [Azure Portal](https://portal.azure.com) → App Registrations → New Registration
2. Set redirect URI: `https://your-domain.com/api/auth/callback/microsoft`
3. Copy Application (client) ID → `MICROSOFT_CLIENT_ID`
4. Create a client secret → `MICROSOFT_CLIENT_SECRET`
5. Set tenant ID (or use `common` for multi-tenant)

### 7. Development

```bash
pnpm dev
```

### 8. Deploy

```bash
pnpm ship
```

## Data Flow

```
User signs in with Microsoft
        │
        ▼
  Dashboard loads (React SPA)
        │
        ▼
  GET /api/data → fetch user's transactions from D1
        │
        ▼
  User uploads CSV via drag-and-drop
        │
        ▼
  POST /api/upload:
    1. Parse CSV (validate Revolut format)
    2. Encrypt raw CSV with AES-256-GCM
    3. Store encrypted upload in D1
    4. Deduplicate transactions by fingerprint
    5. Insert new transactions into D1
        │
        ▼
  POST /api/insights:
    1. Load user's transactions from D1
    2. Build financial summary
    3. Send to Kimi K2.5 via Kilo AI
    4. Cache generated insights in D1
```

## License

MIT

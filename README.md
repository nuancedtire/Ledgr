# Ledgr

A personal financial dashboard built with **Astro**, **TypeScript**, and **Chart.js**. Upload your Revolut CSV statement and get a beautiful, interactive dark-themed dashboard with AI-generated insights and suggestions to improve savings and generate wealth.

![Overview](https://img.shields.io/badge/Astro-5.x-purple?logo=astro) ![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue?logo=typescript) ![Cloudflare](https://img.shields.io/badge/Cloudflare-Pages%20%2B%20Workflows-orange?logo=cloudflare)

## Features

### Dashboard Tabs

| Tab | What it does |
|---|---|
| **Overview** | KPI strip (balance, savings, income, spending, savings rate, transaction count), monthly cash flow bar chart, balance & savings line charts, category donut, weekday spending heatmap |
| **Transactions** | Full-text search, filter by category/type/date range/amount range, sortable columns (date, description, category, amount, balance), pagination (50/page), expandable row details (time, fee, product, state), CSV export of filtered results |
| **Categories** | Interactive donut chart (click to drill down), category cards showing total, count, average transaction, and % of spending. Drill-down view: monthly trend chart, top merchants within category, transaction list |
| **Merchants** | Top 10 horizontal bar chart, searchable merchant grid with total/count/average. Drill-down view: monthly spending trend, frequency analysis, transaction list |
| **Insights** | AI-generated personalised cards — spending warnings, savings tips, wealth-building suggestions. Colour-coded by type (warning/success/tip/info) with metric badges |

### Upload & Live Progress

- **Drag-and-drop CSV upload** modal right on the dashboard
- Cloudflare Workflow processes the upload in durable steps with **real-time progress tracking**:
  1. Upload & read CSV
  2. Validate format
  3. Fetch existing data from GitHub
  4. Deduplicate & merge (fingerprints on type + date + description + amount)
  5. Commit merged CSV back to GitHub
  6. Cloudflare Pages auto-rebuilds from the new commit

### Design

- **Dark theme** with editorial typography (Instrument Serif, DM Sans, JetBrains Mono)
- **Mobile-first** responsive CSS — card-style transactions on mobile, horizontal-scroll tabs, stacked filters
- Ambient gradient glows, noise overlay, smooth animations
- Colour-coded values: emerald (income), rose (spending), amber (warnings), sky (savings), violet (counts)

## Tech Stack

| Layer | Technology |
|---|---|
| Static site | [Astro](https://astro.build) — build-time data processing, zero JS overhead for static content |
| Client app | TypeScript — modular SPA with tab-based navigation, bundled by Vite |
| Charts | [Chart.js](https://www.chartjs.org) — imported as ES module, dark-themed |
| Hosting | [Cloudflare Pages](https://pages.cloudflare.com) — auto-deploys from GitHub |
| Data pipeline | [Cloudflare Workflows](https://developers.cloudflare.com/workflows/) — durable multi-step CSV ingestion |
| Storage | **Git repo itself** — no R2, no database. The CSV lives in the repo. |

## Project Structure

```
ledgr/
├── src/
│   ├── data/
│   │   ├── statement.csv              # Your Revolut CSV data
│   │   └── transactions.ts            # Build-time data processing & AI insights
│   ├── scripts/
│   │   ├── app.ts                     # Client-side entry point & tab routing
│   │   ├── types.ts                   # Shared TypeScript interfaces
│   │   ├── utils.ts                   # Formatting (£), DOM helpers
│   │   ├── charts.ts                  # Chart.js wrapper with dark theme defaults
│   │   ├── upload.ts                  # Upload modal, drag-and-drop, workflow polling
│   │   └── tabs/
│   │       ├── overview.ts            # KPIs + 5 charts
│   │       ├── transactions.ts        # Search, filter, sort, paginate, export
│   │       ├── categories.ts          # Donut + drill-down
│   │       ├── merchants.ts           # Bar chart + drill-down
│   │       └── insights.ts            # AI insight cards
│   ├── layouts/
│   │   └── Layout.astro               # HTML shell with ambient effects
│   ├── pages/
│   │   └── index.astro                # Main page: header, tabs, panels, upload modal
│   └── styles/
│       └── global.css                 # Mobile-first design system (~700 lines)
├── worker/                            # Cloudflare Worker + Workflow
│   ├── src/index.ts                   # HTTP handler + CSVIngestWorkflow (5 durable steps)
│   ├── wrangler.jsonc                 # Workflow binding config
│   └── package.json
├── astro.config.mjs
├── tsconfig.json
└── package.json
```

## AI Insights Generated

The build-time analysis produces personalised insights including:

- ⚠️ Food delivery spending alert (tracks Deliveroo, Just Eat, Uber Eats)
- ⚠️ Combined food-away-from-home vs grocery ratio
- ✓ Savings habit recognition (e.g. consistent £100/month)
- ⚠️ Savings rate vs recommended 20% target
- 💡 TfL travelcard suggestion (based on transport transaction count)
- 💡 Emergency fund target (3× monthly spending)
- 💡 ISA allowance maximisation advice
- ⚠️ Savings pocket withdrawal pattern warning
- ℹ️ Monthly spending volatility analysis
- 💡 Index fund compound growth projections

## Development

```bash
# Install dependencies
pnpm install

# Start dev server (http://localhost:4321)
pnpm dev

# Build static site to dist/
pnpm build

# Preview the build
pnpm preview
```

## Deployment

### 1. Cloudflare Pages (Dashboard)

1. Push this repo to GitHub
2. In Cloudflare dashboard → Pages → Create project → Connect to `nuancedtire/Ledgr`
3. Build settings:
   - **Build command:** `pnpm build`
   - **Build output directory:** `dist`
   - **Node.js version:** `18` or later
4. Deploy

### 2. Cloudflare Workflow (CSV Ingestion Worker)

```bash
cd worker
npm install

# Update wrangler.jsonc — set GITHUB_REPO to "nuancedtire/Ledgr"
# Then set your GitHub personal access token (needs repo write access):
npx wrangler secret put GITHUB_TOKEN

# Deploy the worker
npx wrangler deploy
```

### 3. Connect the Upload Button

Once the Worker is deployed, set the API URL so the upload modal knows where to send CSVs.

Add to your Cloudflare Pages environment variables or inject via a script:

```html
<script>window.LEDGR_API = 'https://ledgr-workflow.YOUR_SUBDOMAIN.workers.dev';</script>
```

Or set it in the Astro layout before the app script loads.

## How the Upload Flow Works

```
User drops CSV on dashboard
        │
        ▼
 POST /upload → Cloudflare Worker
        │
        ▼
  Creates Workflow Instance
        │
        ├─ Step 1: validate-csv
        │    Parse CSV, check header format
        │
        ├─ Step 2: fetch-existing
        │    GET statement.csv from GitHub API
        │
        ├─ Step 3: deduplicate-merge
        │    Fingerprint: type|date|description|amount
        │    Merge new rows, sort chronologically
        │
        ├─ Step 4: commit-to-github
        │    PUT merged CSV back via GitHub Contents API
        │
        └─ Step 5: trigger-rebuild
             Cloudflare Pages auto-rebuilds on push

Dashboard polls GET /status/:id → shows step-by-step progress
```

## Deduplication Logic

Each transaction is fingerprinted as `Type|Started Date|Description|Amount`. When uploading a new CSV:
- Existing transactions are loaded from the repo
- New transactions are compared against existing fingerprints
- Only genuinely new rows are appended
- The merged result is sorted chronologically and committed

This means you can safely upload overlapping date ranges without creating duplicates.

## Data Format

Expects Revolut CSV statement format with columns:

```
Type,Product,Started Date,Completed Date,Description,Amount,Fee,Currency,State,Balance
```

To export from Revolut: Account → Statement → CSV.

## License

MIT

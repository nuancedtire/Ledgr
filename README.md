# Ledgr

A personal financial dashboard built with Astro, TypeScript, and Chart.js. Upload your Revolut CSV statement and get a beautiful, interactive overview with AI-generated insights.

## Features

- **Overview** — KPI strip, monthly cash flow, balance & savings history, category donut, weekday heatmap
- **Transactions** — search, filter by category/type/date/amount, sortable columns, pagination, CSV export, expandable row details
- **Categories** — donut chart, click to drill down into monthly trends, top merchants, and transactions per category
- **Merchants** — top 10 chart, searchable list, drill into each merchant's spending trend
- **Insights** — AI-generated savings tips, spending warnings, and wealth-building suggestions
- **CSV Upload** — drag-and-drop upload with real-time Cloudflare Workflow progress tracking
- **Mobile-first** — fully responsive, card-style transaction display on small screens

## Tech Stack

- **Astro** — static site generation, build-time data processing
- **TypeScript** — end-to-end type safety
- **Chart.js** — interactive charts, imported as ES module
- **Cloudflare Pages** — hosting, auto-deploys from GitHub
- **Cloudflare Workflows** — durable CSV ingestion pipeline (validate → fetch → deduplicate → commit → rebuild)

## Project Structure

```
ledgr/
├── src/
│   ├── data/
│   │   ├── statement.csv          # Your Revolut CSV data
│   │   └── transactions.ts        # Build-time data processing & AI insights
│   ├── scripts/
│   │   ├── app.ts                 # Client-side entry point
│   │   ├── types.ts               # Shared TypeScript interfaces
│   │   ├── utils.ts               # Formatting & DOM helpers
│   │   ├── charts.ts              # Chart.js wrapper with dark theme
│   │   ├── upload.ts              # Upload modal & workflow polling
│   │   └── tabs/
│   │       ├── overview.ts        # Overview tab renderer
│   │       ├── transactions.ts    # Transactions tab with filters & pagination
│   │       ├── categories.ts      # Categories with drill-down
│   │       ├── merchants.ts       # Merchants with drill-down
│   │       └── insights.ts        # AI insights cards
│   ├── layouts/
│   │   └── Layout.astro
│   ├── pages/
│   │   └── index.astro
│   └── styles/
│       └── global.css
├── worker/                        # Cloudflare Worker + Workflow
│   ├── src/index.ts               # HTTP handler + CSVIngestWorkflow
│   ├── wrangler.jsonc
│   └── package.json
├── astro.config.mjs
├── tsconfig.json
└── package.json
```

## Development

```bash
pnpm install
pnpm dev          # Start dev server on :4321
pnpm build        # Build static site to dist/
```

## Deployment

### Cloudflare Pages (Dashboard)

1. Push to GitHub
2. Connect repo in Cloudflare Pages dashboard
3. Build command: `pnpm build`
4. Output directory: `dist`

### Cloudflare Workflow (CSV Ingestion)

```bash
cd worker
npm install

# Set your GitHub repo and token
# Edit wrangler.jsonc: set GITHUB_REPO to "your-username/ledgr"
npx wrangler secret put GITHUB_TOKEN

npx wrangler deploy
```

Then set `window.LEDGR_API = 'https://ledgr-workflow.your-subdomain.workers.dev'` in your deployment.

### How the upload flow works

1. User drops a CSV on the dashboard
2. Dashboard sends CSV to the Worker via `POST /upload`
3. Worker starts a Cloudflare Workflow instance
4. Workflow steps:
   - **validate-csv** — checks CSV format
   - **fetch-existing** — gets current `statement.csv` from GitHub API
   - **deduplicate-merge** — fingerprints transactions (type + date + description + amount), merges new rows
   - **commit-to-github** — pushes merged CSV back to repo
   - **trigger-rebuild** — Cloudflare Pages auto-rebuilds from the new commit
5. Dashboard polls `GET /status/:id` and shows step-by-step progress

## License

MIT

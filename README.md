# Scout Atlas

Scout Atlas is a Vercel-ready job-search intelligence platform built for curated public sources. It combines live scraping, dashboards, company mapping, outreach planning, and a grounded copilot so the product can answer from the latest visible market signals instead of hallucinating.

## What the MVP includes

- Curated source management for job boards, company directories, and mixed pages.
- Live HTML refresh with source snapshots that explicitly label `live` versus `fallback` mode.
- Job counts, location density, sector mix, and source-level visualizations.
- Company radar with map-based discovery for nearby firms.
- Outreach plan generation for selected companies.
- Grounded copilot answers that cite supporting job and company records.
- GitHub Actions CI plus a PR template aimed at fast, safe iteration.

## Stack

- Next.js 16 App Router
- React 19
- Tailwind CSS 4
- Recharts for visualization
- Leaflet for map rendering
- Cheerio for server-side HTML parsing
- Vercel-friendly API routes for scraping and orchestration
- Vitest for unit coverage

## Local development

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

## Environment variables

- `OPENAI_API_KEY`: optional. Enables OpenAI-backed refinement for grounded copilot answers. Without it, the app uses deterministic grounded responses.

## Validation

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

## Deploy to Vercel

1. Import the repository into Vercel.
2. Set `OPENAI_API_KEY` if you want model-backed copilot responses.
3. Deploy. The app runs as a normal Next.js project with Node.js API routes.

## Grounding model

The product never treats seeded fallback data as a live scrape. Each source snapshot exposes its mode so you can see whether a parser succeeded, partially succeeded, or fell back to a transparent seed. That keeps the workflow usable while still making parser quality obvious.

## Architecture notes

See `docs/architecture.md` for the current domain split and where to extend source connectors, analytics, or persistence.

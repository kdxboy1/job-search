# Herizon

Herizon is a Vercel-ready labor-market intelligence platform built for curated public sources. It combines structured source adapters, a researched country-source atlas, comparison-ready job facts, dashboards, company mapping, persistent CRM workflows, and a grounded copilot so the product can answer from the latest visible market signals instead of hallucinating.

## What the platform now includes

- Curated source management for job boards, company directories, and mixed pages.
- Structured adapters for Tyomarkkinatori, Greenhouse, Lever, SmartRecruiters, and Ashby, plus a conservative HTML fallback for unmodeled sources.
- Source snapshots that explicitly separate sampled detail rows from live market totals.
- Public workspace flow with temporary open access, optional Auth.js plumbing for later, and a public landing/research shell.
- Persistent saved searches, historical refresh snapshots, and company CRM notes.
- Dual workspace modes: a dense pro terminal and a simplified AI-first mode.
- A researched country catalog covering prominent portals and board patterns across Finland, France, Germany, Netherlands, Belgium, Poland, the UK, the US, Sweden, and Norway.
- Smart market search that understands technology, seniority, Finnish requirement, work mode, location, and years of experience.
- Comparison-ready dashboards for lenses like `AWS vs Azure`.
- Technology, seniority, language, department, company, and source-level visualizations.
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
- Structured public APIs plus Cheerio-backed HTML fallback parsing
- Auth.js wiring for optional sign-in flows when login is re-enabled
- Neon-ready or local-file workspace persistence
- Vercel-friendly API routes for scraping and orchestration
- Vitest for unit coverage

## Local development

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

## Beginner setup flow

1. Copy `.env.example` to `.env.local` for local work.
2. Add `DATABASE_URL` or `NEON_DATABASE_URL` to switch workspace persistence from the local JSON fallback to Neon.
3. In Vercel, open your project, go to `Settings -> Environment Variables`, add the same keys for Preview and Production, and redeploy.
4. If you want to re-enable login later, generate `AUTH_SECRET` with `openssl rand -base64 32`.
5. If you want account-based access later, add `AUTH_GOOGLE_ID` + `AUTH_GOOGLE_SECRET` or `AUTH_GITHUB_ID` + `AUTH_GITHUB_SECRET`.

If you want an in-app walkthrough, open `/setup`. The page shows the exact env names, current connection status, which items are optional in public-access mode, and supported source URL patterns you can paste directly into the workspace.

## Environment variables

- `OPENAI_API_KEY`: optional. Enables OpenAI-backed refinement for grounded copilot answers. Without it, the app uses deterministic grounded responses.
- `AUTH_SECRET`: optional while the app is in public-access mode. Required only if you re-enable Auth.js login.
- `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`: optional OAuth provider for Google sign-in if login is re-enabled.
- `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`: optional OAuth provider for GitHub sign-in if login is re-enabled.
- `DATABASE_URL` or `NEON_DATABASE_URL`: optional. Enables Neon-backed workspace persistence in production. Without it, Herizon falls back to a local JSON workspace store for development.

## Supported source quick starts

- `https://jobs.ashbyhq.com/{org}` for Ashby boards.
- `https://job-boards.greenhouse.io/{org}` for Greenhouse boards.
- `https://jobs.lever.co/{org}` for Lever boards.
- `https://jobs.smartrecruiters.com/{org}` for SmartRecruiters boards.
- `https://tyomarkkinatori.fi/en/personal-customers/vacancies` for Job Market Finland.

Paste these URLs directly into the workspace source form. Herizon infers the connector from the URL and will say in the snapshot notes if it had to fall back to the generic parser instead.

## Validation

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

## Deploy to Vercel

1. Import the repository into Vercel.
2. Set `DATABASE_URL` or `NEON_DATABASE_URL` if you want production-grade shared persistence instead of the local development file store.
3. Set `OPENAI_API_KEY` if you want model-backed copilot responses.
4. Optionally set `AUTH_SECRET` and an OAuth provider if you plan to turn login back on later.
5. Deploy. The app runs as a normal Next.js project with Node.js API routes.

## Grounding model

The product never treats seeded fallback data as a live scrape. Each source snapshot exposes its mode so you can see whether a parser succeeded, partially succeeded, or fell back to a transparent seed. That keeps the workflow usable while still making parser quality obvious.

The dashboard also separates `market total` from `detail sample`. For example, Tyomarkkinatori can expose a large live vacancy count while the UI only loads a smaller detail-enriched sample for fact extraction and comparison.

## Architecture notes

See `docs/architecture.md` for the current domain split and where to extend source connectors, authentication, analytics, or persistence.

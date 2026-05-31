# Architecture

## Product shape

Scout Atlas is a Vercel-ready Next.js application with one central idea: keep job-search automation grounded in a live or explicitly labeled fallback scrape.

The current MVP includes:

- A source registry for curated job boards, company directories, and mixed sources.
- Server-side refresh routines that fetch public HTML and extract jobs or companies with reusable heuristics.
- A dashboard that visualizes counts, location density, company sectors, and nearby companies on a map.
- API routes for refreshing intelligence, answering grounded copilot questions, and drafting outreach plans.
- A transparency layer that shows whether each source is live or fallback.

## Directory map

- `src/app`: App Router entrypoints and API routes.
- `src/components`: interactive dashboard surface, charts, and map UI.
- `src/lib/types.ts`: shared domain types and source validation schemas.
- `src/lib/scrapers.ts`: live HTML fetch and parser heuristics.
- `src/lib/platform.ts`: source refresh orchestration, analytics, and outreach generation.
- `src/lib/copilot.ts`: grounded answer selection plus optional OpenAI refinement.
- `src/lib/*.test.ts`: unit tests for parser and analytics behavior.

## Deployment model

- The app deploys directly to Vercel as a standard Next.js project.
- `src/app/page.tsx` is forced dynamic so the initial dashboard reflects the latest refresh attempt.
- API routes run in the Node.js runtime because scraping and HTML parsing use server-only packages.
- `OPENAI_API_KEY` is optional. Without it, the copilot falls back to deterministic grounded answers.

## Next extensions

If you want to push this toward a multi-user product, the next layer is a persistence adapter for saved sources, saved outreach notes, and historical refresh runs. The current architecture keeps that upgrade localized to the server-side domain layer.
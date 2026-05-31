# Architecture

## Product shape

Herizon is a Vercel-ready Next.js application with one central idea: keep labor-market automation grounded in structured live records or explicitly labeled fallback data.

The current platform includes:

- A source registry and country atlas for curated job boards, company directories, ATS families, and mixed sources.
- Server-side refresh routines that prefer source-specific adapters, currently Tyomarkkinatori, Greenhouse, Lever, SmartRecruiters, and Ashby, before falling back to conservative HTML parsing.
- A richer job fact model with technologies, seniority, work modes, employment types, years of experience, and Finnish/language requirement signals.
- An authenticated workspace that persists custom sources, saved searches, refresh history, company CRM notes, and preferred view mode.
- A dashboard that visualizes market totals, sampled fact rows, technology pressure, seniority mix, language requirements, company concentration, and nearby companies on a map.
- A smart query lens that turns natural search text into structured filters and technology comparisons.
- API routes for refreshing intelligence, persisting workspace state, answering grounded copilot questions, and drafting outreach plans.
- A public marketing, setup, and research layer that sits in front of the authenticated workspace.
- A transparency layer that shows whether each source is live or fallback.

## Directory map

- `src/app`: App Router entrypoints and API routes.
- `src/components`: interactive dashboard surface, charts, catalog UI, auth shell, and map UI.
- `src/lib/setup.ts`: beginner setup instructions, supported source URL examples, and parser labels used by the setup flow and workspace.
- `src/lib/query-intelligence.ts`: query interpretation and comparison helpers for the dashboard.
- `src/lib/source-catalog.ts`: researched country-source registry and parser-hint inference.
- `src/lib/persistence.ts`: multi-user workspace persistence with Neon or local-file fallback.
- `src/lib/types.ts`: shared domain types and source validation schemas.
- `src/lib/scrapers.ts`: source adapters, structured fetches, and conservative HTML fallback parsing.
- `src/lib/job-facts.ts`: fact extraction for technologies, seniority, experience, language, and work modes.
- `src/lib/platform.ts`: source refresh orchestration, analytics, and outreach generation.
- `src/lib/copilot.ts`: grounded answer selection plus optional OpenAI refinement.
- `src/lib/research.ts`: public research deck content for the Herizon surface.
- `src/lib/*.test.ts`: unit tests for parser and analytics behavior.

## Deployment model

- The app deploys directly to Vercel as a standard Next.js project.
- `src/app/workspace/page.tsx` is forced dynamic so the authenticated workspace reflects the latest refresh attempt.
- `src/app/setup/page.tsx` is dynamic so the setup guide can reflect which integrations are configured in the current environment.
- API routes run in the Node.js runtime because scraping and HTML parsing use server-only packages.
- Auth.js handles session cookies and OAuth provider integration.
- `OPENAI_API_KEY` is optional. Without it, the copilot falls back to deterministic grounded answers.
- `DATABASE_URL` or `NEON_DATABASE_URL` is optional. Without it, the persistence layer uses a local JSON file store in development.

## Next extensions

If you want to push this further, the next layer is deeper country-specific portal support, more ATS families, and richer AI orchestration on top of the now-persistent workspace state. The current architecture keeps those upgrades localized to the source-catalog, scraper, and persistence layers.
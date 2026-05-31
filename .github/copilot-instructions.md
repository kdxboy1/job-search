# Copilot Instructions

- Preserve the grounded-data contract: if a source is seeded fallback, label it explicitly instead of presenting it as a live scrape.
- Prefer extending the typed source connector flow in `src/lib/scrapers.ts` and `src/lib/platform.ts` over adding ad hoc scraping logic in components.
- Keep API handlers thin: validate input, call a domain function, return structured JSON.
- When adding AI behavior, require supporting records or say the evidence is insufficient.
- Before merging, run `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build`.
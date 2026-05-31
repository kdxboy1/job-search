# Latest Update

This file explains what was added recently, feature by feature, and what you need to do to deploy the app properly.

## What is already built

### 1. Temporary public workspace and persistent workspace flow

The app is no longer blocked behind login.

It now supports:

- A public workspace that opens without login
- Persistent shared workspace state for saved searches, notes, source lists, refresh history, and mode preferences
- Auth.js plumbing that can be turned back on later
- Google OAuth support ready for later re-enable
- GitHub OAuth support ready for later re-enable

In development, the app can still fall back to a local JSON file.

In production, it is designed to use Neon via `DATABASE_URL` or `NEON_DATABASE_URL` for durable shared state.

### 2. Beginner-friendly setup flow

A public setup page now exists at `/setup`.

It shows:

- Which environment variables are needed
- Which ones are already configured in the current environment
- Which items are required versus optional
- Supported source URL examples that can be pasted directly into the workspace

This was added so a new user does not need to guess how public access, database, and optional AI or auth wiring work.

### 3. Better source onboarding inside the workspace

The source form in the workspace is now easier to use.

It now includes:

- Quick-start source examples
- Autofill buttons for known supported job boards
- Connector detection from the pasted URL
- Clearer guidance on whether the URL will use a typed adapter or a generic fallback parser

This means a user can paste a public board URL and immediately understand how the app will ingest it.

### 4. Expanded ATS coverage with Ashby

Ashby is now supported as a typed source adapter.

That means the app can read public Ashby job boards such as:

- `https://jobs.ashbyhq.com/openai`

The adapter does more than collect titles.

It also follows detail pages and extracts structured facts such as:

- Role title
- Company name
- Location information
- Department
- Employment type
- Workplace style when detectable
- Description text
- Signals used for downstream fact extraction

This is materially better than treating Ashby as generic scraped HTML.

### 5. Existing supported source families remain in place

The platform already supports typed ingestion for:

- Tyomarkkinatori
- Greenhouse
- Lever
- SmartRecruiters
- Ashby

Other sources can still be added, but unsupported ones may use the generic fallback path until a dedicated adapter is built.

### 6. Public product shell is in place

The app now has a more complete business-facing surface, including:

- Public landing page
- Public setup page
- Public research page
- Public workspace page

This makes the app feel closer to a real product instead of a single internal dashboard view.

## What this means in practice

You now have:

- A full-stack Next.js app that builds successfully
- A Vercel-ready deployment target
- An open workspace anyone can access immediately
- A clearer onboarding path for auth, database, and source setup
- More reliable source ingestion through typed connectors
- A stronger foundation for turning this into a persistent multi-user product

## What you still need to do to deploy it

The code is ready, but production deployment still requires your real database value if you want persistent shared state in production.

I cannot create your database or optional OAuth credentials from inside this workspace, so these are the steps you need to take manually.

## Deploy checklist

### Step 1. Push the code to GitHub

Make sure the latest code is committed and pushed to the repository that Vercel will deploy from.

### Step 2. Import the project into Vercel

In Vercel:

1. Create a new project
2. Import the GitHub repository
3. Let Vercel detect it as a Next.js app

No unusual build setup should be needed.

### Step 3. Add required environment variables in Vercel

Open:

- `Project Settings -> Environment Variables`

Add these values.

Required for production shared persistence:

- `DATABASE_URL` or `NEON_DATABASE_URL`

Optional if you want to re-enable login later:

- `AUTH_SECRET`
- `AUTH_GOOGLE_ID`
- `AUTH_GOOGLE_SECRET`
- `AUTH_GITHUB_ID`
- `AUTH_GITHUB_SECRET`

Optional for model-backed AI behavior:

- `OPENAI_API_KEY`

### Step 4. Optionally generate `AUTH_SECRET`

Generate a secure random secret locally with:

```bash
openssl rand -base64 32
```

Paste the output into `AUTH_SECRET` in Vercel only if you want to turn account-based auth back on later.

### Step 5. Optionally create OAuth credentials

If you want Google and/or GitHub login later, create OAuth apps for your Vercel domain.

Then place the client ID and secret into:

- `AUTH_GOOGLE_ID`
- `AUTH_GOOGLE_SECRET`
- `AUTH_GITHUB_ID`
- `AUTH_GITHUB_SECRET`

If you skip this, the app will still be publicly accessible; it just will not have account-based login.

### Step 6. Create or connect a Neon database

Create a Neon project if you do not already have one.

Then copy the connection string into either:

- `DATABASE_URL`

or:

- `NEON_DATABASE_URL`

Once this is set, the app will stop relying on the local development fallback store and start using persistent database-backed shared workspace state.

### Step 7. Redeploy

After adding the environment variables, redeploy the Vercel project.

This is required so the production build picks up the new values.

### Step 8. Verify the deployment

After the deploy finishes, check these pages:

- `/`
- `/setup`
- `/research`
- `/workspace`

What to verify:

- The setup page loads
- The database item shows as connected when configured
- Workspace loads without auth errors
- Source examples can be added
- A refresh run completes successfully
- Visiting `/login` redirects into the workspace instead of showing a login wall

## Recommended minimum production configuration

If you want the fastest path to a real deployment, do this minimum set:

1. Add `DATABASE_URL` or `NEON_DATABASE_URL`
2. Deploy to Vercel
3. Test `/setup` and `/workspace`
4. Re-enable auth later only if you want separate user accounts

That is the point where the app stops behaving like a local prototype and starts behaving like a real hosted product with shared public access.

## Validation status

The current repository state was validated successfully with:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

All four passed.

## Suggested next build step

If you want the next platform expansion after this deployment, the most useful next connector is Workday.

Reason:

- It unlocks many larger international employers quickly
- It fits the typed-adapter strategy better than adding random one-off scrapers
- It improves global coverage more efficiently than chasing isolated company career pages
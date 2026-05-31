import Link from "next/link";

import { SiteHeader } from "@/components/site-header";
import {
  beginnerSetupSteps,
  formatParserHintLabel,
  productionConnections,
  sourceQuickstartExamples,
} from "@/lib/setup";

export const dynamic = "force-dynamic";

type SetupStatus = {
  authSecret: boolean;
  googleOAuth: boolean;
  githubOAuth: boolean;
  database: boolean;
  openai: boolean;
};

function getSetupStatus(): SetupStatus {
  return {
    authSecret: Boolean(process.env.AUTH_SECRET),
    googleOAuth: Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET),
    githubOAuth: Boolean(process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET),
    database: Boolean(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL),
    openai: Boolean(process.env.OPENAI_API_KEY),
  };
}

function isConnectionConfigured(id: (typeof productionConnections)[number]["id"], status: SetupStatus): boolean {
  switch (id) {
    case "auth-secret":
      return status.authSecret;
    case "google-oauth":
      return status.googleOAuth;
    case "github-oauth":
      return status.githubOAuth;
    case "database":
      return status.database;
    case "openai":
      return status.openai;
  }
}

function statusLabel(configured: boolean, required: boolean): string {
  if (configured) {
    return "Connected";
  }

  return required ? "Missing" : "Optional";
}

function statusClass(configured: boolean, required: boolean): string {
  if (configured) {
    return "status-pill border-[rgba(11,140,116,0.28)] bg-[rgba(229,255,248,0.72)] text-[var(--foreground)]";
  }

  if (required) {
    return "status-pill border-[rgba(202,107,44,0.22)] bg-[rgba(255,245,235,0.85)] text-[var(--foreground)]";
  }

  return "status-pill";
}

export default function SetupPage() {
  const status = getSetupStatus();

  return (
    <main className="pb-16">
      <SiteHeader />

      <section className="page-shell">
        <div className="page-grid">
          <section className="panel overflow-hidden p-8 sm:p-10">
            <div className="grid gap-8 xl:grid-cols-[1.02fr_0.98fr]">
              <div>
                <p className="eyebrow">Beginner setup guide</p>
                <h1 className="mt-4 max-w-4xl text-5xl font-semibold leading-[0.95] tracking-[-0.05em] text-[var(--foreground)] sm:text-6xl">
                  Connect persistence, source inputs, and optional auth without guessing.
                </h1>
                <p className="section-copy mt-5 max-w-3xl">
                  Public access is enabled right now, so anyone can open the workspace without login. Add DATABASE_URL or NEON_DATABASE_URL for persistent shared storage, and add AUTH_SECRET plus OAuth providers later if you want to turn account-based access back on.
                </p>

                <div className="mt-8 flex flex-wrap gap-3">
                  <Link className="action-button" href="/workspace#sources">
                    Open workspace setup
                  </Link>
                  <Link className="secondary-button" href="/research">
                    See the research shell
                  </Link>
                </div>

                <div className="mt-10 rounded-[1.5rem] border border-[rgba(19,38,31,0.08)] bg-white/60 p-5">
                  <p className="text-sm font-medium uppercase tracking-[0.18em] text-[var(--muted)]">
                    Vercel path
                  </p>
                  <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                    In Vercel, open your project, go to Settings, then Environment Variables. Add the keys below for Preview and Production, redeploy, and the app will automatically pick up persistent shared storage. Auth keys are optional until you decide to re-enable login.
                  </p>
                </div>
              </div>

              <div className="grid gap-4">
                {productionConnections.map((connection) => {
                  const configured = isConnectionConfigured(connection.id, status);

                  return (
                    <article
                      key={connection.id}
                      className="rounded-[1.5rem] border border-[rgba(19,38,31,0.08)] bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(248,243,235,0.8))] p-5"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-lg font-semibold text-[var(--foreground)]">{connection.label}</p>
                          <p className="mt-2 text-sm text-[var(--muted)]">{connection.summary}</p>
                        </div>
                        <span className={statusClass(configured, connection.required)}>
                          {statusLabel(configured, connection.required)}
                        </span>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {connection.envVars.map((envVar) => (
                          <span key={`${connection.id}-${envVar}`} className="chip">
                            {envVar}
                          </span>
                        ))}
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-[0.96fr_1.04fr]">
            <section className="panel p-6">
              <p className="eyebrow">Checklist</p>
              <h2 className="section-title">The shortest path to production</h2>
              <div className="mt-6 space-y-4">
                {beginnerSetupSteps.map((step, index) => (
                  <article
                    key={step.title}
                    className="rounded-[1.3rem] border border-[rgba(19,38,31,0.08)] bg-white/60 p-5"
                  >
                    <div className="flex items-start gap-4">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[rgba(19,38,31,0.08)] bg-[rgba(229,255,248,0.7)] text-sm font-semibold text-[var(--foreground)]">
                        {index + 1}
                      </span>
                      <div>
                        <p className="font-medium text-[var(--foreground)]">{step.title}</p>
                        <p className="mt-2 text-sm leading-7 text-[var(--muted)]">{step.detail}</p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="panel p-6">
              <p className="eyebrow">Supported inputs</p>
              <h2 className="section-title">Paste these source URLs directly into the workspace</h2>
              <p className="section-copy mt-3">
                You do not need to discover hidden APIs by hand. For the supported boards below, paste the public board URL and Herizon infers the right connector automatically.
              </p>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {sourceQuickstartExamples.map((example) => (
                  <article
                    key={example.url}
                    className="rounded-[1.3rem] border border-[rgba(19,38,31,0.08)] bg-white/60 p-5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-[var(--foreground)]">{example.label}</p>
                        <p className="mt-2 text-sm text-[var(--muted)]">{example.summary}</p>
                      </div>
                      <span className="status-pill">{formatParserHintLabel(example.parserHint)}</span>
                    </div>
                    <p className="mt-4 text-sm text-[var(--foreground)]">{example.name}</p>
                    <p className="mt-2 break-all text-sm text-[var(--muted)]">{example.url}</p>
                  </article>
                ))}
              </div>

              <div className="mt-6 rounded-[1.3rem] border border-[rgba(19,38,31,0.08)] bg-[rgba(255,255,255,0.72)] p-5 text-sm leading-7 text-[var(--muted)]">
                If you paste a different public board or company page, Herizon still accepts it. It will fall back to the generic parser until a typed adapter exists, and the snapshot notes will tell you which path was used.
              </div>
            </section>
          </section>
        </div>
      </section>
    </main>
  );
}
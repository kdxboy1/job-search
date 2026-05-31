import Link from "next/link";

import { auth } from "@/auth";
import { SiteHeader } from "@/components/site-header";
import { featuredReports, researchMetrics, researchPlatforms } from "@/lib/research";
import { countrySourceCatalog, getGlobalAtsCatalog } from "@/lib/source-catalog";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await auth();
  const supportedAts = getGlobalAtsCatalog().filter((platform) => platform.readiness === "supported");

  return (
    <main className="pb-16">
      <SiteHeader authenticated={Boolean(session?.user?.email)} userName={session?.user?.name} />

      <section className="page-shell">
        <div className="page-grid">
          <section className="panel overflow-hidden p-8 sm:p-10">
            <div className="grid gap-10 xl:grid-cols-[1.05fr_0.95fr]">
              <div>
                <p className="eyebrow">Holistic business shell</p>
                <h1 className="mt-4 max-w-4xl text-5xl font-semibold leading-[0.94] tracking-[-0.05em] text-[var(--foreground)] sm:text-6xl">
                  Herizon turns fragmented job boards into a professional labor-market terminal.
                </h1>
                <p className="section-copy mt-5 max-w-3xl">
                  The product now has a real authenticated workspace, persistent saved searches,
                  historical refresh memory, CRM notes for target companies, a researched
                  country-source atlas, and a public research layer inspired by employability intelligence products.
                </p>

                <div className="mt-8 flex flex-wrap gap-3">
                  <Link className="action-button" href={session?.user?.email ? "/workspace" : "/login"}>
                    {session?.user?.email ? "Open workspace" : "Log in to workspace"}
                  </Link>
                  <Link className="secondary-button" href="/setup">
                    Open setup guide
                  </Link>
                  <Link className="secondary-button" href="/research">
                    Explore research
                  </Link>
                </div>

                <div className="mt-10 grid gap-4 md:grid-cols-3">
                  {researchMetrics.map((metric) => (
                    <article key={metric.label} className="metric-tile">
                      <span className="metric-label">{metric.label}</span>
                      <strong className="metric-value">{metric.value}</strong>
                      <p className="text-sm text-[var(--muted)]">{metric.detail}</p>
                    </article>
                  ))}
                </div>
              </div>

              <div className="grid gap-4">
                <article className="rounded-[1.7rem] border border-[rgba(19,38,31,0.08)] bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(243,235,226,0.82))] p-6 shadow-[0_20px_60px_rgba(19,38,31,0.08)]">
                  <p className="eyebrow">Platform coverage</p>
                  <h2 className="mt-3 text-2xl font-semibold text-[var(--foreground)]">
                    {countrySourceCatalog.length} country lenses and {supportedAts.length} live ATS adapters.
                  </h2>
                  <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                    The source atlas distinguishes public portals, private boards, and reusable ATS families instead of pretending every site should be scraped the same way.
                  </p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {supportedAts.map((platform) => (
                      <span key={platform.id} className="chip">
                        {platform.name}
                      </span>
                    ))}
                  </div>
                </article>

                <article className="rounded-[1.7rem] border border-[rgba(19,38,31,0.08)] bg-white/70 p-6">
                  <p className="eyebrow">Research front door</p>
                  <h2 className="mt-3 text-2xl font-semibold text-[var(--foreground)]">
                    Reports, methodology, perspectives, and data platform access.
                  </h2>
                  <div className="mt-5 space-y-3">
                    {featuredReports.slice(0, 2).map((report) => (
                      <div
                        key={report.slug}
                        className="rounded-[1.2rem] border border-[rgba(19,38,31,0.08)] bg-[rgba(255,255,255,0.74)] p-4"
                      >
                        <p className="text-sm font-medium text-[var(--foreground)]">{report.title}</p>
                        <p className="mt-2 text-sm text-[var(--muted)]">{report.summary}</p>
                      </div>
                    ))}
                  </div>
                </article>
              </div>
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            {researchPlatforms.map((platform) => (
              <article key={platform.title} className="panel p-6">
                <p className="eyebrow">{platform.emphasis}</p>
                <h2 className="section-title">{platform.title}</h2>
                <p className="section-copy mt-3">{platform.summary}</p>
              </article>
            ))}
          </section>
        </div>
      </section>
    </main>
  );
}

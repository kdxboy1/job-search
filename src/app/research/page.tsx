import { SiteHeader } from "@/components/site-header";
import {
  featuredReports,
  researchMetrics,
  researchPerspectives,
  researchPlatforms,
} from "@/lib/research";

export const dynamic = "force-dynamic";

export default function ResearchPage() {
  return (
    <main className="pb-16">
      <SiteHeader />

      <section className="page-shell">
        <div className="page-grid">
          <section className="panel p-8 sm:p-10">
            <p className="eyebrow">Herizon Research</p>
            <h1 className="mt-4 max-w-4xl text-5xl font-semibold leading-[0.95] tracking-[-0.05em] text-[var(--foreground)] sm:text-6xl">
              Employability research, market structure analysis, and methodology in one public layer.
            </h1>
            <p className="section-copy mt-5 max-w-3xl">
              This surface is built to feel like the publishing arm of the platform: monthly reports, featured perspectives, a future-skills radar, methodology notes, and a clear bridge into the data workspace.
            </p>

            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {researchMetrics.map((metric) => (
                <article key={metric.label} className="metric-tile">
                  <span className="metric-label">{metric.label}</span>
                  <strong className="metric-value">{metric.value}</strong>
                  <p className="text-sm text-[var(--muted)]">{metric.detail}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
            <div className="panel p-6">
              <p className="eyebrow">Featured reports</p>
              <h2 className="section-title">This month on the desk</h2>
              <div className="mt-6 grid gap-4">
                {featuredReports.map((report) => (
                  <article
                    key={report.slug}
                    className="rounded-[1.5rem] border border-[rgba(19,38,31,0.08)] bg-white/65 p-5"
                  >
                    <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--muted)]">
                      <span className="status-pill">{report.category}</span>
                      <span>{report.publishedAt}</span>
                      <span>{report.readingTime}</span>
                    </div>
                    <h3 className="mt-4 text-2xl font-semibold text-[var(--foreground)]">
                      {report.title}
                    </h3>
                    <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{report.summary}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {report.highlights.map((highlight) => (
                        <span key={highlight} className="chip">
                          {highlight}
                        </span>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </div>

            <div className="grid gap-6">
              <section className="panel p-6">
                <p className="eyebrow">Perspectives</p>
                <h2 className="section-title">Who this research serves</h2>
                <div className="mt-5 space-y-4">
                  {researchPerspectives.map((perspective) => (
                    <article
                      key={perspective.title}
                      className="rounded-[1.3rem] border border-[rgba(19,38,31,0.08)] bg-white/65 p-4"
                    >
                      <p className="text-sm uppercase tracking-[0.18em] text-[var(--muted)]">
                        {perspective.audience}
                      </p>
                      <h3 className="mt-2 text-lg font-semibold text-[var(--foreground)]">
                        {perspective.title}
                      </h3>
                      <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
                        {perspective.summary}
                      </p>
                    </article>
                  ))}
                </div>
              </section>

              <section className="panel p-6">
                <p className="eyebrow">Platform stack</p>
                <h2 className="section-title">Data products around the reports</h2>
                <div className="mt-5 space-y-4">
                  {researchPlatforms.map((platform) => (
                    <article key={platform.title} className="rounded-[1.3rem] border border-[rgba(19,38,31,0.08)] bg-white/65 p-4">
                      <p className="text-sm uppercase tracking-[0.18em] text-[var(--muted)]">
                        {platform.emphasis}
                      </p>
                      <h3 className="mt-2 text-lg font-semibold text-[var(--foreground)]">
                        {platform.title}
                      </h3>
                      <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
                        {platform.summary}
                      </p>
                    </article>
                  ))}
                </div>
              </section>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
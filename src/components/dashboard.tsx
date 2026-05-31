"use client";

import { formatDistanceToNowStrict } from "date-fns";
import {
  ArrowUpRight,
  Bot,
  BriefcaseBusiness,
  Building2,
  Compass,
  LoaderCircle,
  MapPinned,
  RefreshCcw,
  Search,
  Send,
  Sparkles,
} from "lucide-react";
import dynamic from "next/dynamic";
import {
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useState,
  useTransition,
} from "react";

import { AnalyticsCharts } from "@/components/analytics-charts";
import { hydrateSourceConfig, SourceConfigSchema } from "@/lib/types";
import { slugify } from "@/lib/utils";
import type {
  GroundedAnswer,
  OutreachPlan,
  PlatformIntelligence,
  SourceConfig,
  SourceKind,
} from "@/lib/types";

const CompanyMap = dynamic(() => import("@/components/company-map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[360px] items-center justify-center rounded-[1.5rem] border border-[rgba(19,38,31,0.08)] bg-white/55 text-sm text-[var(--muted)]">
      Loading map...
    </div>
  ),
});

const STORAGE_KEY = "scout-atlas-custom-sources";

type DashboardProps = {
  initialData: PlatformIntelligence;
};

type SourceDraft = {
  name: string;
  url: string;
  kind: SourceKind;
};

const starterQuestions = [
  "Where should I focus my outreach this week?",
  "Which sources currently show the strongest hiring signals?",
  "What companies near Helsinki look worth researching next?",
];

function buildSourceFromDraft(draft: SourceDraft): SourceConfig {
  const idBase = slugify(draft.name || draft.url);

  return {
    id: `${idBase}-${draft.kind}`,
    name: draft.name,
    url: draft.url,
    kind: draft.kind,
    parserHint:
      draft.kind === "jobs"
        ? "generic-jobs"
        : draft.kind === "company-directory"
          ? "generic-companies"
          : "generic-mixed",
    description: "User-curated source.",
    tags: ["custom"],
  };
}

function dedupeSources(sources: SourceConfig[]): SourceConfig[] {
  const seen = new Set<string>();
  const result: SourceConfig[] = [];

  for (const source of sources) {
    const key = `${source.kind}:${source.url}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(source);
  }

  return result;
}

export function Dashboard({ initialData }: DashboardProps) {
  const [sources, setSources] = useState<SourceConfig[]>(() => {
    if (typeof window === "undefined") {
      return initialData.sources;
    }

    const raw = window.localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return initialData.sources;
    }

    try {
      const parsed = JSON.parse(raw) as unknown[];
      const customSources = parsed.map((value) =>
        hydrateSourceConfig(SourceConfigSchema.parse(value)),
      );

      return dedupeSources([...initialData.sources, ...customSources]);
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
      return initialData.sources;
    }
  });
  const [data, setData] = useState(initialData);
  const [draft, setDraft] = useState<SourceDraft>({ name: "", url: "", kind: "jobs" });
  const [jobsQuery, setJobsQuery] = useState("");
  const [selectedCompanyId, setSelectedCompanyId] = useState(
    initialData.companies[0]?.id ?? "",
  );
  const [outreachPlan, setOutreachPlan] = useState<OutreachPlan | null>(null);
  const [copilotQuestion, setCopilotQuestion] = useState(starterQuestions[0]);
  const [copilotAnswer, setCopilotAnswer] = useState<GroundedAnswer | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isGeneratingOutreach, setIsGeneratingOutreach] = useState(false);
  const [isAskingCopilot, setIsAskingCopilot] = useState(false);
  const [isPending, startTransition] = useTransition();

  const deferredJobsQuery = useDeferredValue(jobsQuery);

  const selectedCompany =
    data.companies.find((company) => company.id === selectedCompanyId) ?? data.companies[0];

  const query = deferredJobsQuery.trim().toLowerCase();
  const filteredJobs = !query
    ? data.jobs
    : data.jobs.filter((job) => {
        const haystack = `${job.title} ${job.company} ${job.location} ${job.tags.join(" ")}`.toLowerCase();
        return haystack.includes(query);
      });

  const persistCustomSources = useEffectEvent((nextSources: SourceConfig[]) => {
    if (typeof window === "undefined") {
      return;
    }

    const defaultIds = new Set(initialData.sources.map((source) => source.id));
    const customSources = nextSources.filter((source) => !defaultIds.has(source.id));
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(customSources));
  });

  useEffect(() => {
    persistCustomSources(sources);
  }, [sources]);

  async function refreshIntelligence(nextSources = sources) {
    setErrorMessage(null);
    setStatusMessage(null);
    setIsRefreshing(true);

    try {
      const response = await fetch("/api/intelligence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sources: nextSources }),
      });

      if (!response.ok) {
        throw new Error("Unable to refresh intelligence.");
      }

      const payload = (await response.json()) as PlatformIntelligence;

      startTransition(() => {
        setData(payload);
        setSelectedCompanyId((current) =>
          payload.companies.some((company) => company.id === current)
            ? current
            : (payload.companies[0]?.id ?? ""),
        );
        setStatusMessage("Live intelligence refreshed.");
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Refresh failed.");
    } finally {
      setIsRefreshing(false);
    }
  }

  async function handleSourceSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setErrorMessage(null);

    try {
      const nextSource = buildSourceFromDraft({
        name: draft.name.trim(),
        url: new URL(draft.url).toString(),
        kind: draft.kind,
      });
      const nextSources = dedupeSources([...sources, nextSource]);

      setSources(nextSources);
      setDraft({ name: "", url: "", kind: "jobs" });
      await refreshIntelligence(nextSources);
    } catch {
      setErrorMessage("Enter a valid source URL before adding it.");
    }
  }

  async function generateOutreachPlan(companyId: string) {
    setErrorMessage(null);
    setIsGeneratingOutreach(true);

    try {
      const response = await fetch("/api/outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, sources }),
      });

      if (!response.ok) {
        throw new Error("Unable to draft outreach plan.");
      }

      const payload = (await response.json()) as OutreachPlan;
      setOutreachPlan(payload);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Outreach request failed.");
    } finally {
      setIsGeneratingOutreach(false);
    }
  }

  async function askCopilot(question: string) {
    setErrorMessage(null);
    setIsAskingCopilot(true);

    try {
      const response = await fetch("/api/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, sources }),
      });

      if (!response.ok) {
        throw new Error("Unable to get a grounded answer.");
      }

      const payload = (await response.json()) as GroundedAnswer;
      setCopilotAnswer(payload);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Copilot request failed.");
    } finally {
      setIsAskingCopilot(false);
    }
  }

  return (
    <div className="page-shell">
      <div className="page-grid">
        <section className="panel relative overflow-hidden p-8 sm:p-10">
          <div className="absolute inset-y-0 right-0 hidden w-1/2 bg-[radial-gradient(circle_at_top_right,rgba(11,140,116,0.22),transparent_58%),radial-gradient(circle_at_bottom_right,rgba(202,107,44,0.18),transparent_50%)] lg:block" />

          <div className="relative max-w-4xl">
            <p className="eyebrow">Scout Atlas</p>
            <h1 className="mt-4 max-w-3xl text-5xl font-semibold leading-[0.95] tracking-[-0.04em] text-[var(--foreground)] sm:text-6xl">
              Live job intelligence, outreach CRM, and company mapping built around
              your own curated sources.
            </h1>
            <p className="section-copy mt-5 max-w-2xl">
              Add public boards, startup directories, or company pages. The app
              refreshes those URLs, counts visible signals, visualizes the market,
              drafts smarter outreach, and keeps the copilot grounded in the latest
              scrape instead of free-floating guesses.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <button
                className="action-button"
                onClick={() => void refreshIntelligence()}
                type="button"
              >
                {isRefreshing ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCcw className="h-4 w-4" />
                )}
                Refresh live signals
              </button>
              <a className="secondary-button" href="#sources">
                Curate another source
              </a>
            </div>

            <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="metric-tile">
                <span className="metric-label">Job signals</span>
                <strong className="metric-value">{data.analytics.totalJobs}</strong>
              </div>
              <div className="metric-tile">
                <span className="metric-label">Company radar</span>
                <strong className="metric-value">{data.analytics.totalCompanies}</strong>
              </div>
              <div className="metric-tile">
                <span className="metric-label">Live sources</span>
                <strong className="metric-value">{data.analytics.liveSources}</strong>
              </div>
              <div className="metric-tile">
                <span className="metric-label">Remote-friendly</span>
                <strong className="metric-value">{data.analytics.remoteFriendlyJobs}</strong>
              </div>
            </div>
          </div>
        </section>

        <aside className="panel p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="eyebrow">System truth</p>
              <h2 className="section-title">What this refresh knows</h2>
            </div>
            <span className="status-pill">
              {formatDistanceToNowStrict(new Date(data.generatedAt), { addSuffix: true })}
            </span>
          </div>

          <div className="mt-5 space-y-3">
            {data.brief.map((line) => (
              <div key={line} className="rounded-[1.2rem] border border-[rgba(19,38,31,0.08)] bg-white/55 p-4 text-sm text-[var(--muted)]">
                {line}
              </div>
            ))}
          </div>

          <div className="mt-6 space-y-3">
            {data.snapshots.map((snapshot) => (
              <article
                key={snapshot.source.id}
                className="rounded-[1.3rem] border border-[rgba(19,38,31,0.08)] bg-white/60 p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium text-[var(--foreground)]">{snapshot.source.name}</p>
                    <p className="mt-1 text-sm text-[var(--muted)]">{snapshot.source.description}</p>
                  </div>
                  <span className="status-pill">
                    {snapshot.mode} / {snapshot.status}
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap gap-2 text-sm text-[var(--muted)]">
                  <span>{snapshot.jobsFound} jobs</span>
                  <span>&middot;</span>
                  <span>{snapshot.companiesFound} companies</span>
                </div>

                {snapshot.notes.length ? (
                  <ul className="mt-3 space-y-2 text-sm text-[var(--muted)]">
                    {snapshot.notes.map((note) => (
                      <li key={note}>{note}</li>
                    ))}
                  </ul>
                ) : null}
              </article>
            ))}
          </div>
        </aside>

        <section id="sources" className="panel p-6">
          <div className="grid gap-8 xl:grid-cols-[0.92fr_1.08fr]">
            <div>
              <p className="eyebrow">Source cockpit</p>
              <h2 className="section-title">Bring your own market sources</h2>
              <p className="section-copy mt-3">
                The product is not tied to one site. Add public job boards, startup
                directories, or direct careers pages and refresh them as a single
                market view.
              </p>

              <form className="mt-6 grid gap-4" onSubmit={handleSourceSubmit}>
                <label className="field-label">
                  <span>Source name</span>
                  <input
                    className="input-shell"
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, name: event.target.value }))
                    }
                    placeholder="Finnish startup board"
                    value={draft.name}
                  />
                </label>

                <label className="field-label">
                  <span>Source URL</span>
                  <input
                    className="input-shell"
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, url: event.target.value }))
                    }
                    placeholder="https://example.com/jobs"
                    type="url"
                    value={draft.url}
                  />
                </label>

                <label className="field-label">
                  <span>Surface type</span>
                  <select
                    className="input-shell"
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        kind: event.target.value as SourceKind,
                      }))
                    }
                    value={draft.kind}
                  >
                    <option value="jobs">Jobs</option>
                    <option value="company-directory">Company directory</option>
                    <option value="mixed">Mixed</option>
                  </select>
                </label>

                <button className="action-button justify-center" type="submit">
                  <Compass className="h-4 w-4" />
                  Add source and refresh
                </button>
              </form>

              {(statusMessage || errorMessage) && (
                <div className="mt-4 rounded-[1.1rem] border border-[rgba(19,38,31,0.08)] bg-white/60 px-4 py-3 text-sm text-[var(--muted)]">
                  {errorMessage ?? statusMessage}
                </div>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {sources.map((source) => {
                const snapshot = data.snapshots.find((item) => item.source.id === source.id);

                return (
                  <article key={`${source.id}-${source.url}`} className="source-card">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-[var(--foreground)]">{source.name}</p>
                        <p className="mt-1 text-sm text-[var(--muted)]">{source.description}</p>
                      </div>
                      {snapshot ? <span className="status-pill">{snapshot.mode}</span> : null}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {source.tags.map((tag) => (
                        <span key={tag} className="chip">
                          {tag}
                        </span>
                      ))}
                    </div>

                    <div className="mt-4 space-y-2 text-sm text-[var(--muted)]">
                      <p>{source.url}</p>
                      <p>
                        {snapshot?.jobsFound ?? 0} jobs / {snapshot?.companiesFound ?? 0} companies
                      </p>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <AnalyticsCharts analytics={data.analytics} snapshots={data.snapshots} />

        <section className="panel p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="eyebrow">Job desk</p>
              <h2 className="section-title">Filter what the scraper actually found</h2>
            </div>

            <label className="relative block w-full max-w-md">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
              <input
                className="input-shell pl-11"
                onChange={(event) => setJobsQuery(event.target.value)}
                placeholder="Search by title, company, city, or tag"
                value={jobsQuery}
              />
            </label>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="data-table min-w-[760px]">
              <thead>
                <tr>
                  <th>Role</th>
                  <th>Company</th>
                  <th>Location</th>
                  <th>Signals</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {filteredJobs.length ? (
                  filteredJobs.map((job) => (
                    <tr key={job.id}>
                      <td>
                        <a
                          className="inline-flex items-center gap-2 font-medium text-[var(--foreground)] hover:text-[var(--accent)]"
                          href={job.url}
                          rel="noreferrer"
                          target="_blank"
                        >
                          {job.title}
                          <ArrowUpRight className="h-4 w-4" />
                        </a>
                        <p className="mt-1 text-sm text-[var(--muted)]">{job.summary}</p>
                      </td>
                      <td>{job.company}</td>
                      <td>{job.location}</td>
                      <td>
                        <div className="flex flex-wrap gap-2">
                          {job.tags.length ? (
                            job.tags.map((tag) => (
                              <span key={`${job.id}-${tag}`} className="chip">
                                {tag}
                              </span>
                            ))
                          ) : (
                            <span className="chip">parsed</span>
                          )}
                        </div>
                      </td>
                      <td>{job.sourceName}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="py-8 text-center text-sm text-[var(--muted)]" colSpan={5}>
                      No jobs match the current query or the live parser has not surfaced any
                      job cards yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
          <div className="panel p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="eyebrow">Company radar</p>
                <h2 className="section-title">Nearby companies and outreach targets</h2>
              </div>
              <MapPinned className="h-5 w-5 text-[var(--accent)]" />
            </div>

            <div className="mt-6">
              <CompanyMap companies={data.companies} />
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-2">
              {data.companies.slice(0, 8).map((company) => (
                <button
                  key={company.id}
                  className={`rounded-[1.3rem] border p-4 text-left transition ${
                    selectedCompany?.id === company.id
                      ? "border-[rgba(11,140,116,0.35)] bg-[rgba(229,255,248,0.7)]"
                      : "border-[rgba(19,38,31,0.08)] bg-white/60 hover:border-[rgba(19,38,31,0.16)]"
                  }`}
                  onClick={() => setSelectedCompanyId(company.id)}
                  type="button"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-[var(--foreground)]">{company.name}</p>
                      <p className="mt-1 text-sm text-[var(--muted)]">{company.location}</p>
                    </div>
                    <Building2 className="h-4 w-4 text-[var(--accent)]" />
                  </div>
                  <p className="mt-3 text-sm text-[var(--muted)]">{company.summary}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {company.sectors.map((sector) => (
                      <span key={`${company.id}-${sector}`} className="chip">
                        {sector}
                      </span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="panel p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="eyebrow">Outreach studio</p>
                <h2 className="section-title">Write smarter first messages</h2>
              </div>
              <BriefcaseBusiness className="h-5 w-5 text-[var(--accent)]" />
            </div>

            {selectedCompany ? (
              <>
                <div className="mt-5 rounded-[1.4rem] border border-[rgba(19,38,31,0.08)] bg-white/60 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-2xl font-semibold text-[var(--foreground)]">
                        {selectedCompany.name}
                      </h3>
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        {selectedCompany.location} · {selectedCompany.sourceName}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <a
                        className="secondary-button"
                        href={selectedCompany.url}
                        rel="noreferrer"
                        target="_blank"
                      >
                        Company profile
                      </a>
                      <a
                        className="secondary-button"
                        href={selectedCompany.jobsUrl}
                        rel="noreferrer"
                        target="_blank"
                      >
                        Jobs link
                      </a>
                    </div>
                  </div>

                  <p className="section-copy mt-4">{selectedCompany.whyNow}</p>
                  <p className="mt-4 text-sm text-[var(--muted)]">
                    Smart angle: {selectedCompany.contactPrompt}
                  </p>
                </div>

                <button
                  className="action-button mt-5"
                  onClick={() => void generateOutreachPlan(selectedCompany.id)}
                  type="button"
                >
                  {isGeneratingOutreach ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  Draft outreach plan
                </button>
              </>
            ) : (
              <p className="mt-5 text-sm text-[var(--muted)]">
                Add a company directory source to unlock outreach planning.
              </p>
            )}

            {outreachPlan ? (
              <div className="mt-6 space-y-4">
                <div className="rounded-[1.3rem] border border-[rgba(19,38,31,0.08)] bg-white/60 p-5">
                  <p className="text-sm font-medium uppercase tracking-[0.18em] text-[var(--muted)]">
                    Opening note
                  </p>
                  <p className="mt-3 text-base leading-7 text-[var(--foreground)]">
                    {outreachPlan.opening}
                  </p>
                </div>

                <div className="rounded-[1.3rem] border border-[rgba(19,38,31,0.08)] bg-white/60 p-5">
                  <p className="text-sm font-medium uppercase tracking-[0.18em] text-[var(--muted)]">
                    Value angles
                  </p>
                  <ul className="mt-3 space-y-3 text-sm leading-6 text-[var(--muted)]">
                    {outreachPlan.valueAngles.map((angle) => (
                      <li key={angle}>{angle}</li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-[1.3rem] border border-[rgba(19,38,31,0.08)] bg-white/60 p-5">
                  <p className="text-sm font-medium uppercase tracking-[0.18em] text-[var(--muted)]">
                    Suggested sequence
                  </p>
                  <ul className="mt-3 space-y-3 text-sm leading-6 text-[var(--muted)]">
                    {outreachPlan.sequence.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : null}
          </div>
        </section>

        <section className="panel p-6">
          <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
            <div>
              <p className="eyebrow">Grounded copilot</p>
              <h2 className="section-title">Ask questions against the latest refresh</h2>
              <p className="section-copy mt-3">
                The assistant answers from the current scrape, and each answer ships with
                supporting job and company records so you can verify what it used.
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                {starterQuestions.map((question) => (
                  <button
                    key={question}
                    className="chip cursor-pointer hover:border-[rgba(11,140,116,0.24)]"
                    onClick={() => setCopilotQuestion(question)}
                    type="button"
                  >
                    {question}
                  </button>
                ))}
              </div>

              <label className="field-label mt-5">
                <span>Your question</span>
                <textarea
                  className="input-shell min-h-[150px] resize-y"
                  onChange={(event) => setCopilotQuestion(event.target.value)}
                  value={copilotQuestion}
                />
              </label>

              <button
                className="action-button mt-4"
                onClick={() => void askCopilot(copilotQuestion)}
                type="button"
              >
                {isAskingCopilot ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Ask grounded copilot
              </button>
            </div>

            <div className="space-y-4">
              <div className="rounded-[1.4rem] border border-[rgba(19,38,31,0.08)] bg-white/60 p-5">
                <div className="flex items-center gap-3">
                  <Bot className="h-5 w-5 text-[var(--accent)]" />
                  <p className="text-sm font-medium uppercase tracking-[0.18em] text-[var(--muted)]">
                    Latest answer
                  </p>
                </div>

                <p className="mt-4 text-base leading-7 text-[var(--foreground)]">
                  {copilotAnswer?.answer ??
                    "Ask a question to get a grounded summary, outreach suggestion, or market signal readout."}
                </p>

                {copilotAnswer ? (
                  <p className="mt-3 text-sm text-[var(--muted)]">
                    Generated with {copilotAnswer.generatedWith}
                  </p>
                ) : null}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-[1.4rem] border border-[rgba(19,38,31,0.08)] bg-white/60 p-5">
                  <p className="text-sm font-medium uppercase tracking-[0.18em] text-[var(--muted)]">
                    Supporting jobs
                  </p>
                  <div className="mt-4 space-y-3">
                    {copilotAnswer?.supportingJobs.length ? (
                      copilotAnswer.supportingJobs.map((job) => (
                        <a
                          key={job.id}
                          className="block rounded-[1.1rem] border border-[rgba(19,38,31,0.08)] bg-white/70 p-4 hover:border-[rgba(11,140,116,0.24)]"
                          href={job.url}
                          rel="noreferrer"
                          target="_blank"
                        >
                          <p className="font-medium text-[var(--foreground)]">{job.title}</p>
                          <p className="mt-1 text-sm text-[var(--muted)]">
                            {job.company} · {job.location} · {job.sourceName}
                          </p>
                        </a>
                      ))
                    ) : (
                      <p className="text-sm text-[var(--muted)]">
                        Job citations will appear here after a question.
                      </p>
                    )}
                  </div>
                </div>

                <div className="rounded-[1.4rem] border border-[rgba(19,38,31,0.08)] bg-white/60 p-5">
                  <p className="text-sm font-medium uppercase tracking-[0.18em] text-[var(--muted)]">
                    Supporting companies
                  </p>
                  <div className="mt-4 space-y-3">
                    {copilotAnswer?.supportingCompanies.length ? (
                      copilotAnswer.supportingCompanies.map((company) => (
                        <a
                          key={company.id}
                          className="block rounded-[1.1rem] border border-[rgba(19,38,31,0.08)] bg-white/70 p-4 hover:border-[rgba(11,140,116,0.24)]"
                          href={company.url}
                          rel="noreferrer"
                          target="_blank"
                        >
                          <p className="font-medium text-[var(--foreground)]">{company.name}</p>
                          <p className="mt-1 text-sm text-[var(--muted)]">
                            {company.location} · {company.sourceName}
                          </p>
                        </a>
                      ))
                    ) : (
                      <p className="text-sm text-[var(--muted)]">
                        Company citations will appear here after a question.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      {(isPending || isRefreshing) && (
        <div className="pointer-events-none fixed bottom-6 right-6 rounded-full border border-[rgba(19,38,31,0.1)] bg-[rgba(255,251,245,0.92)] px-4 py-2 text-sm text-[var(--muted)] shadow-[0_18px_50px_rgba(19,38,31,0.12)] backdrop-blur">
          Syncing live intelligence...
        </div>
      )}
    </div>
  );
}
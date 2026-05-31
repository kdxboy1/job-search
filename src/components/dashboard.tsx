"use client";

import { formatDistanceToNowStrict } from "date-fns";
import {
  ArrowUpRight,
  Bot,
  BookmarkPlus,
  BriefcaseBusiness,
  Building2,
  Compass,
  GitCompareArrows,
  Languages,
  Layers3,
  LoaderCircle,
  MapPinned,
  NotebookText,
  RefreshCcw,
  Search,
  Send,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  UserRound,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useDeferredValue, useState, useTransition } from "react";

import { AnalyticsCharts } from "@/components/analytics-charts";
import { SourceCatalogPanel } from "@/components/source-catalog-panel";
import {
  buildTechnologyComparison,
  filterJobsByLens,
  parseQueryLens,
} from "@/lib/query-intelligence";
import { formatParserHintLabel, sourceQuickstartExamples } from "@/lib/setup";
import { inferSourceParserHint } from "@/lib/source-catalog";
import { slugify } from "@/lib/utils";
import type {
  CompanyNoteStatus,
  CountryCode,
  CountrySourceCatalog,
  CuratedSourceDescriptor,
  GroundedAnswer,
  LanguageRequirement,
  OutreachPlan,
  PlatformIntelligence,
  SourceConfig,
  SourceKind,
  WorkspaceEnvelope,
  WorkspaceMode,
} from "@/lib/types";

const CompanyMap = dynamic(() => import("@/components/company-map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[360px] items-center justify-center rounded-[1.5rem] border border-[rgba(19,38,31,0.08)] bg-white/55 text-sm text-[var(--muted)]">
      Loading map...
    </div>
  ),
});

type DashboardProps = {
  baseSources: SourceConfig[];
  currentUser?: { email?: string | null; name?: string | null };
  initialData: PlatformIntelligence;
  initialWorkspace: WorkspaceEnvelope;
  sourceCatalog: CountrySourceCatalog[];
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

const smartQueryExamples = [
  "Compare AWS vs Azure in Helsinki",
  "Senior English-friendly data roles",
  "Remote product jobs with 5+ years",
];

function formatFinnishRequirement(value: LanguageRequirement): string {
  switch (value) {
    case "required":
      return "Finnish required";
    case "preferred":
      return "Finnish preferred";
    case "helpful":
      return "Finnish helpful";
    case "english-friendly":
      return "English-friendly";
    default:
      return "Language not stated";
  }
}

function formatExperience(value: PlatformIntelligence["jobs"][number]["yearsExperience"]): string {
  if (!value) {
    return "Not stated";
  }

  if (typeof value.min === "number" && typeof value.max === "number") {
    return `${value.min}-${value.max} yrs`;
  }

  if (typeof value.min === "number") {
    return `${value.min}+ yrs`;
  }

  return value.raw ?? "Not stated";
}

function buildLensChips(lens: ReturnType<typeof parseQueryLens>): string[] {
  return [
    ...lens.technologies.map((item) => `Tech: ${item}`),
    ...lens.locations.map((item) => `Location: ${item}`),
    ...lens.companies.map((item) => `Company: ${item}`),
    ...lens.seniority.map((item) => `Level: ${item}`),
    ...lens.workModes.map((item) => `Mode: ${item}`),
    lens.minimumYearsExperience ? `YoE >= ${lens.minimumYearsExperience}` : null,
    lens.finnishRequirement ? `Language: ${formatFinnishRequirement(lens.finnishRequirement)}` : null,
  ].filter((item): item is string => Boolean(item));
}

function buildSourceFromDraft(draft: SourceDraft): SourceConfig {
  const idBase = slugify(draft.name || draft.url);

  return {
    id: `${idBase}-${draft.kind}`,
    name: draft.name,
    url: draft.url,
    kind: draft.kind,
    parserHint: inferSourceParserHint(draft.url, draft.kind),
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

function toWorkspaceSource(source: CuratedSourceDescriptor): SourceConfig {
  return {
    id: source.id,
    name: source.name,
    url: source.url,
    kind: source.kind,
    parserHint: source.parserHint,
    description: source.description,
    tags: source.tags.filter((tag) => tag !== "catalog"),
  };
}

function formatPersistenceDriver(driver: WorkspaceEnvelope["driver"]): string {
  return driver === "neon" ? "Neon persistence" : "Local file persistence";
}

export function Dashboard({
  baseSources,
  currentUser,
  initialData,
  initialWorkspace,
  sourceCatalog,
}: DashboardProps) {
  const [data, setData] = useState(initialData);
  const [customSources, setCustomSources] = useState(initialWorkspace.state.customSources);
  const [savedSearches, setSavedSearches] = useState(initialWorkspace.state.savedSearches);
  const [companyNotes, setCompanyNotes] = useState(initialWorkspace.state.companyNotes);
  const [snapshotHistory, setSnapshotHistory] = useState(initialWorkspace.state.snapshotHistory);
  const [persistenceDriver, setPersistenceDriver] = useState(initialWorkspace.driver);
  const [viewMode, setViewMode] = useState<WorkspaceMode>(initialWorkspace.state.preferences.mode);
  const [pinnedCountries, setPinnedCountries] = useState<CountryCode[]>(
    initialWorkspace.state.preferences.pinnedCountries,
  );
  const [draft, setDraft] = useState<SourceDraft>({ name: "", url: "", kind: "jobs" });
  const [jobsQuery, setJobsQuery] = useState("");
  const [selectedCompanyId, setSelectedCompanyId] = useState(
    initialData.companies[0]?.id ?? "",
  );
  const [outreachPlan, setOutreachPlan] = useState<OutreachPlan | null>(null);
  const [copilotQuestion, setCopilotQuestion] = useState(starterQuestions[0]);
  const [copilotAnswer, setCopilotAnswer] = useState<GroundedAnswer | null>(null);
  const [noteBody, setNoteBody] = useState("");
  const [noteNextAction, setNoteNextAction] = useState("");
  const [noteStatus, setNoteStatus] = useState<CompanyNoteStatus>("prospect");
  const [noteTags, setNoteTags] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPersisting, setIsPersisting] = useState(false);
  const [isGeneratingOutreach, setIsGeneratingOutreach] = useState(false);
  const [isAskingCopilot, setIsAskingCopilot] = useState(false);
  const [isPending, startTransition] = useTransition();

  const deferredJobsQuery = useDeferredValue(jobsQuery);
  const sources = dedupeSources([...baseSources, ...customSources]);
  const draftParserHint = draft.url.trim()
    ? inferSourceParserHint(draft.url.trim(), draft.kind)
    : undefined;
  const query = deferredJobsQuery.trim().toLowerCase();
  const queryLens = parseQueryLens(query, data.jobs);
  const filteredJobs = query ? filterJobsByLens(data.jobs, queryLens) : data.jobs;
  const comparison = buildTechnologyComparison(filteredJobs, queryLens.comparisonPair);
  const lensChips = buildLensChips(queryLens);
  const filteredCompanies = new Set(filteredJobs.map((job) => job.company)).size;
  const filteredLocations = new Set(
    filteredJobs
      .map((job) => job.normalizedLocation)
      .filter((location) => location && location !== "Unspecified"),
  ).size;
  const filteredRemoteJobs = filteredJobs.filter((job) => job.remote).length;
  const selectedCompany =
    data.companies.find((company) => company.id === selectedCompanyId) ?? data.companies[0];
  const selectedCompanyNotes = selectedCompany
    ? companyNotes.filter(
        (note) =>
          note.companyId === selectedCompany.id || note.companySlug === selectedCompany.slug,
      )
    : [];

  function applyWorkspaceEnvelope(workspace: WorkspaceEnvelope) {
    setCustomSources(workspace.state.customSources);
    setSavedSearches(workspace.state.savedSearches);
    setCompanyNotes(workspace.state.companyNotes);
    setSnapshotHistory(workspace.state.snapshotHistory);
    setViewMode(workspace.state.preferences.mode);
    setPinnedCountries(workspace.state.preferences.pinnedCountries);
    setPersistenceDriver(workspace.driver);
  }

  async function syncWorkspaceState() {
    const response = await fetch("/api/workspace/state", { method: "GET" });

    if (!response.ok) {
      return;
    }

    const workspace = (await response.json()) as WorkspaceEnvelope;
    applyWorkspaceEnvelope(workspace);
  }

  async function patchWorkspace(body: unknown) {
    setIsPersisting(true);

    try {
      const response = await fetch("/api/workspace/state", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error("Unable to persist workspace state.");
      }

      const workspace = (await response.json()) as WorkspaceEnvelope;
      applyWorkspaceEnvelope(workspace);
      return workspace;
    } finally {
      setIsPersisting(false);
    }
  }

  async function refreshIntelligence(nextCustomSources = customSources) {
    setErrorMessage(null);
    setStatusMessage(null);
    setIsRefreshing(true);

    try {
      const combinedSources = dedupeSources([...baseSources, ...nextCustomSources]);
      const response = await fetch("/api/intelligence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sources: combinedSources }),
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
      });

      await syncWorkspaceState();
      setStatusMessage("Live intelligence refreshed and snapshot history updated.");
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
      const nextCustomSources = dedupeSources([...customSources, nextSource]);

      await patchWorkspace({
        action: "set-custom-sources",
        customSources: nextCustomSources,
      });
      setDraft({ name: "", url: "", kind: "jobs" });
      await refreshIntelligence(nextCustomSources);
    } catch {
      setErrorMessage("Enter a valid source URL before adding it.");
    }
  }

  async function handleCatalogSourceAdd(source: CuratedSourceDescriptor) {
    const nextCustomSources = dedupeSources([...customSources, toWorkspaceSource(source)]);
    await patchWorkspace({
      action: "set-custom-sources",
      customSources: nextCustomSources,
    });
    await refreshIntelligence(nextCustomSources);
  }

  async function handleToggleCountry(country: CountryCode) {
    const nextPinnedCountries = pinnedCountries.includes(country)
      ? pinnedCountries.filter((item) => item !== country)
      : [...pinnedCountries, country];

    const safePinnedCountries = nextPinnedCountries.length ? nextPinnedCountries : pinnedCountries;

    await patchWorkspace({
      action: "set-preferences",
      preferences: { pinnedCountries: safePinnedCountries },
    });
  }

  async function handleModeChange(nextMode: WorkspaceMode) {
    if (nextMode === viewMode) {
      return;
    }

    const previousMode = viewMode;
    setViewMode(nextMode);

    try {
      await patchWorkspace({
        action: "set-preferences",
        preferences: { mode: nextMode },
      });
    } catch {
      setViewMode(previousMode);
    }
  }

  async function handleSaveSearch() {
    if (!jobsQuery.trim()) {
      return;
    }

    const label = queryLens.interpreted
      ? lensChips.slice(0, 2).join(" · ") || jobsQuery.trim()
      : jobsQuery.trim();

    try {
      await patchWorkspace({
        action: "save-search",
        query: jobsQuery.trim(),
        label,
        countryCodes: pinnedCountries,
        mode: viewMode,
      });
      setStatusMessage("Saved search persisted to the workspace.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to save search.");
    }
  }

  async function handleDeleteSearch(id: string) {
    try {
      await patchWorkspace({ action: "delete-search", id });
      setStatusMessage("Saved search removed.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to delete search.");
    }
  }

  async function handleSaveCompanyNote() {
    if (!selectedCompany || !noteBody.trim()) {
      return;
    }

    try {
      await patchWorkspace({
        action: "upsert-note",
        note: {
          companyId: selectedCompany.id,
          companySlug: selectedCompany.slug,
          companyName: selectedCompany.name,
          body: noteBody.trim(),
          nextAction: noteNextAction.trim() || undefined,
          status: noteStatus,
          tags: noteTags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
        },
      });
      setNoteBody("");
      setNoteNextAction("");
      setNoteStatus("prospect");
      setNoteTags("");
      setStatusMessage(`CRM note saved for ${selectedCompany.name}.`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to save note.");
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

  const workspaceHeader = (
    <section className="panel p-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="eyebrow">Authenticated workspace</p>
          <h1 className="section-title">Herizon command desk</h1>
          <p className="section-copy mt-3 max-w-3xl">
            Persistent sources, saved searches, refresh history, and company notes now live in the workspace rather than in browser-only state.
          </p>
        </div>

        <div className="flex flex-col items-start gap-3 xl:items-end">
          <div className="flex flex-wrap gap-2">
            <button
              className={`secondary-button ${viewMode === "pro" ? "border-[rgba(11,140,116,0.35)] bg-[rgba(229,255,248,0.7)]" : ""}`}
              onClick={() => void handleModeChange("pro")}
              type="button"
            >
              <Layers3 className="h-4 w-4" />
              Pro view
            </button>
            <button
              className={`secondary-button ${viewMode === "simple" ? "border-[rgba(11,140,116,0.35)] bg-[rgba(229,255,248,0.7)]" : ""}`}
              onClick={() => void handleModeChange("simple")}
              type="button"
            >
              <Sparkles className="h-4 w-4" />
              Simple view
            </button>
          </div>
          <span className="status-pill">{formatPersistenceDriver(persistenceDriver)}</span>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <span className="status-pill">
          <UserRound className="h-3.5 w-3.5" />
          {currentUser?.name ?? currentUser?.email ?? "Analyst"}
        </span>
        <span className="status-pill">{savedSearches.length} saved searches</span>
        <span className="status-pill">{snapshotHistory.length} refresh snapshots</span>
        <span className="status-pill">{companyNotes.length} CRM notes</span>
        <span className="status-pill">{pinnedCountries.length} pinned markets</span>
      </div>
    </section>
  );

  const workspaceMemory = (
    <section className="panel p-6">
      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div>
          <p className="eyebrow">Workspace memory</p>
          <h2 className="section-title">Saved searches and refresh history</h2>
          <p className="section-copy mt-3">
            Searches persist with the workspace mode and pinned countries, and every live refresh leaves behind a compact historical snapshot.
          </p>

          <div className="mt-6 rounded-[1.4rem] border border-[rgba(19,38,31,0.08)] bg-white/60 p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <BookmarkPlus className="h-4 w-4 text-[var(--accent)]" />
                <p className="text-sm font-medium uppercase tracking-[0.18em] text-[var(--muted)]">
                  Saved searches
                </p>
              </div>
              <button className="secondary-button" onClick={() => void handleSaveSearch()} type="button">
                Save current query
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {savedSearches.length ? (
                savedSearches.map((search) => (
                  <div
                    key={search.id}
                    className="rounded-[1.1rem] border border-[rgba(19,38,31,0.08)] bg-white/70 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <button
                        className="text-left"
                        onClick={() => setJobsQuery(search.query)}
                        type="button"
                      >
                        <p className="font-medium text-[var(--foreground)]">{search.label}</p>
                        <p className="mt-1 text-sm text-[var(--muted)]">{search.query}</p>
                      </button>
                      <button
                        className="chip cursor-pointer text-[var(--accent-2)]"
                        onClick={() => void handleDeleteSearch(search.id)}
                        type="button"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Remove
                      </button>
                    </div>
                    <p className="mt-3 text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                      {search.mode} view · {search.countryCodes.join(", ") || "Global"} · updated {formatDistanceToNowStrict(new Date(search.lastUsedAt), { addSuffix: true })}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-[var(--muted)]">
                  Save a query lens once you find a useful comparison or job-market slice.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-[1.4rem] border border-[rgba(19,38,31,0.08)] bg-white/60 p-5">
          <div className="flex items-center gap-3">
            <NotebookText className="h-4 w-4 text-[var(--accent)]" />
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-[var(--muted)]">
              Historical refreshes
            </p>
          </div>

          <div className="mt-4 space-y-3">
            {snapshotHistory.length ? (
              snapshotHistory.map((snapshot) => (
                <div
                  key={snapshot.id}
                  className="rounded-[1.1rem] border border-[rgba(19,38,31,0.08)] bg-white/70 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-[var(--foreground)]">{snapshot.summary}</p>
                      <p className="mt-2 text-sm text-[var(--muted)]">
                        {snapshot.totalJobs.toLocaleString()} market jobs · {snapshot.sampledJobs} sampled rows · {snapshot.totalCompanies.toLocaleString()} companies
                      </p>
                    </div>
                    <span className="status-pill">
                      {formatDistanceToNowStrict(new Date(snapshot.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-[var(--muted)]">
                Refresh the workspace to start building a historical view of market shifts.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );

  const comparisonSection = comparison ? (
    <section className="panel p-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="eyebrow">Technology comparison</p>
          <h2 className="section-title">Comparison slices from the structured fact base</h2>
        </div>
        <span className="status-pill">{comparison.left.label} vs {comparison.right.label}</span>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        {[comparison.left, comparison.right].map((slice) => (
          <article
            key={slice.label}
            className="rounded-[1.5rem] border border-[rgba(19,38,31,0.08)] bg-[linear-gradient(180deg,rgba(255,255,255,0.8),rgba(248,243,235,0.76))] p-5"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <GitCompareArrows className="h-4 w-4 text-[var(--accent)]" />
                  <p className="text-lg font-semibold text-[var(--foreground)]">{slice.label}</p>
                </div>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  {slice.totalJobs} sampled roles mention {slice.label} in the active lens.
                </p>
              </div>
              <span className="status-pill">compare</span>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-[1.1rem] border border-[rgba(19,38,31,0.08)] bg-white/70 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Top companies</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {slice.topCompanies.length ? (
                    slice.topCompanies.map((company) => (
                      <span key={`${slice.label}-${company.label}`} className="chip">
                        {company.label}
                        <strong className="ml-1">{company.value}</strong>
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-[var(--muted)]">No company signal yet.</span>
                  )}
                </div>
              </div>

              <div className="rounded-[1.1rem] border border-[rgba(19,38,31,0.08)] bg-white/70 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Seniority mix</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {slice.seniority.length ? (
                    slice.seniority.map((bucket) => (
                      <span key={`${slice.label}-${bucket.label}`} className="chip">
                        {bucket.label}
                        <strong className="ml-1">{bucket.value}</strong>
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-[var(--muted)]">No seniority signal yet.</span>
                  )}
                </div>
              </div>

              <div className="rounded-[1.1rem] border border-[rgba(19,38,31,0.08)] bg-white/70 p-4">
                <div className="flex items-center gap-2">
                  <Languages className="h-4 w-4 text-[var(--accent)]" />
                  <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Finnish requirement</p>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {slice.finnishRequirement.length ? (
                    slice.finnishRequirement.map((bucket) => (
                      <span key={`${slice.label}-${bucket.label}`} className="chip">
                        {formatFinnishRequirement(bucket.label as LanguageRequirement)}
                        <strong className="ml-1">{bucket.value}</strong>
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-[var(--muted)]">No language signal yet.</span>
                  )}
                </div>
              </div>

              <div className="rounded-[1.1rem] border border-[rgba(19,38,31,0.08)] bg-white/70 p-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-[var(--accent)]" />
                  <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Experience ask</p>
                </div>
                <p className="mt-3 text-sm text-[var(--muted)]">
                  {typeof slice.experienceAverage === "number"
                    ? `${slice.experienceAverage} yrs average across ${slice.knownExperienceCount} roles.`
                    : "Years-of-experience not stated in the current sample."}
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {slice.sampleJobs.map((job) => (
                <a
                  key={job.id}
                  className="block rounded-[1.1rem] border border-[rgba(19,38,31,0.08)] bg-white/75 p-4 hover:border-[rgba(11,140,116,0.24)]"
                  href={job.url}
                  rel="noreferrer"
                  target="_blank"
                >
                  <p className="font-medium text-[var(--foreground)]">{job.title}</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    {job.company} · {job.location} · {job.seniority} · {formatExperience(job.yearsExperience)}
                  </p>
                </a>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  ) : null;

  const companyNotesSection = (
    <div className="rounded-[1.3rem] border border-[rgba(19,38,31,0.08)] bg-white/60 p-5">
      <div className="flex items-center gap-3">
        <NotebookText className="h-4 w-4 text-[var(--accent)]" />
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-[var(--muted)]">
          Company CRM notes
        </p>
      </div>

      {selectedCompany ? (
        <>
          <div className="mt-4 grid gap-3">
            <textarea
              className="input-shell min-h-[120px] resize-y"
              onChange={(event) => setNoteBody(event.target.value)}
              placeholder={`What have you learned about ${selectedCompany.name}?`}
              value={noteBody}
            />
            <input
              className="input-shell"
              onChange={(event) => setNoteNextAction(event.target.value)}
              placeholder="Next action or follow-up"
              value={noteNextAction}
            />
            <div className="grid gap-3 md:grid-cols-2">
              <select
                className="input-shell"
                onChange={(event) => setNoteStatus(event.target.value as CompanyNoteStatus)}
                value={noteStatus}
              >
                <option value="prospect">Prospect</option>
                <option value="contacted">Contacted</option>
                <option value="responded">Responded</option>
                <option value="paused">Paused</option>
              </select>
              <input
                className="input-shell"
                onChange={(event) => setNoteTags(event.target.value)}
                placeholder="Tags, comma separated"
                value={noteTags}
              />
            </div>
            <button className="secondary-button justify-center" onClick={() => void handleSaveCompanyNote()} type="button">
              Save CRM note
            </button>
          </div>

          <div className="mt-5 space-y-3">
            {selectedCompanyNotes.length ? (
              selectedCompanyNotes.map((note) => (
                <article
                  key={note.id}
                  className="rounded-[1.1rem] border border-[rgba(19,38,31,0.08)] bg-white/70 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-wrap gap-2">
                      <span className="chip">{note.status}</span>
                      {note.tags.map((tag) => (
                        <span key={`${note.id}-${tag}`} className="chip">
                          {tag}
                        </span>
                      ))}
                    </div>
                    <span className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
                      {formatDistanceToNowStrict(new Date(note.updatedAt), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-[var(--foreground)]">{note.body}</p>
                  {note.nextAction ? (
                    <p className="mt-3 text-sm text-[var(--muted)]">Next: {note.nextAction}</p>
                  ) : null}
                </article>
              ))
            ) : (
              <p className="text-sm text-[var(--muted)]">
                No CRM notes yet for this company. Save interview prep, outreach context, or a follow-up plan here.
              </p>
            )}
          </div>
        </>
      ) : (
        <p className="mt-4 text-sm text-[var(--muted)]">
          Select a company to start writing CRM notes.
        </p>
      )}
    </div>
  );

  const copilotSection = (
    <section className="panel p-6">
      <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <div>
          <p className="eyebrow">Grounded copilot</p>
          <h2 className="section-title">Ask questions against the latest refresh</h2>
          <p className="section-copy mt-3">
            The assistant answers from the current scrape, and each answer ships with supporting job and company records so you can verify what it used.
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
  );

  const simpleView = (
    <div className="page-grid">
      {workspaceHeader}

      <section className="panel overflow-hidden p-8 sm:p-10">
        <div className="grid gap-8 xl:grid-cols-[1.05fr_0.95fr]">
          <div>
            <p className="eyebrow">Simple mode</p>
            <h2 className="mt-4 max-w-3xl text-5xl font-semibold leading-[0.95] tracking-[-0.05em] text-[var(--foreground)] sm:text-6xl">
              Ask the market one clear question and let the workspace simplify the rest.
            </h2>
            <p className="section-copy mt-5 max-w-2xl">
              This mode keeps the signal dense behind the scenes but reduces the surface area: one search box, a small set of key metrics, direct comparison cards, and a shortlist of roles worth opening next.
            </p>

            <label className="relative mt-6 block">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
              <input
                className="input-shell pl-11"
                onChange={(event) => setJobsQuery(event.target.value)}
                placeholder="Compare AWS vs Azure in Helsinki senior roles with English-friendly teams"
                value={jobsQuery}
              />
            </label>

            <div className="mt-4 flex flex-wrap gap-2">
              {(lensChips.length ? lensChips : smartQueryExamples).map((chip) => (
                <button
                  key={chip}
                  className="chip cursor-pointer hover:border-[rgba(11,140,116,0.24)]"
                  onClick={() => {
                    if (smartQueryExamples.includes(chip)) {
                      setJobsQuery(chip);
                    }
                  }}
                  type="button"
                >
                  {chip}
                </button>
              ))}
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button className="action-button" onClick={() => void handleSaveSearch()} type="button">
                <BookmarkPlus className="h-4 w-4" />
                Save this search
              </button>
              <button className="secondary-button" onClick={() => void refreshIntelligence()} type="button">
                {isRefreshing ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCcw className="h-4 w-4" />
                )}
                Refresh signals
              </button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="metric-tile">
              <span className="metric-label">Matched sample rows</span>
              <strong className="metric-value">{filteredJobs.length}</strong>
            </div>
            <div className="metric-tile">
              <span className="metric-label">Matched companies</span>
              <strong className="metric-value">{filteredCompanies}</strong>
            </div>
            <div className="metric-tile">
              <span className="metric-label">Matched locations</span>
              <strong className="metric-value">{filteredLocations}</strong>
            </div>
            <div className="metric-tile">
              <span className="metric-label">Remote-friendly</span>
              <strong className="metric-value">{filteredRemoteJobs}</strong>
            </div>
          </div>
        </div>
      </section>

      {workspaceMemory}
      {comparisonSection}

      <section className="panel p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="eyebrow">Shortlist</p>
            <h2 className="section-title">The next roles to inspect</h2>
            <p className="section-copy mt-3">
              A condensed list of fact-rich openings that match the active lens.
            </p>
          </div>
          {jobsQuery ? (
            <button className="secondary-button" onClick={() => setJobsQuery("")} type="button">
              Clear query lens
            </button>
          ) : null}
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredJobs.slice(0, 9).map((job) => (
            <a
              key={job.id}
              className="rounded-[1.4rem] border border-[rgba(19,38,31,0.08)] bg-white/65 p-5 hover:border-[rgba(11,140,116,0.24)]"
              href={job.url}
              rel="noreferrer"
              target="_blank"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-[var(--foreground)]">{job.title}</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">{job.company} · {job.location}</p>
                </div>
                <ArrowUpRight className="h-4 w-4 text-[var(--accent)]" />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="chip">{job.seniority}</span>
                <span className="chip">{formatExperience(job.yearsExperience)}</span>
                <span className="chip">{formatFinnishRequirement(job.finnishRequirement)}</span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {job.technologies.slice(0, 3).map((technology) => (
                  <span key={`${job.id}-${technology}`} className="chip">
                    {technology}
                  </span>
                ))}
              </div>
            </a>
          ))}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.02fr_0.98fr]">
        <div className="panel p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="eyebrow">Company focus</p>
              <h2 className="section-title">Keep one target company in view</h2>
            </div>
            <MapPinned className="h-5 w-5 text-[var(--accent)]" />
          </div>

          <div className="mt-6">
            <CompanyMap companies={data.companies} />
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {data.companies.slice(0, 6).map((company) => (
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
                <p className="font-medium text-[var(--foreground)]">{company.name}</p>
                <p className="mt-1 text-sm text-[var(--muted)]">{company.location}</p>
                <p className="mt-3 text-sm text-[var(--muted)]">{company.summary}</p>
              </button>
            ))}
          </div>
        </div>

        <section className="panel p-6">{companyNotesSection}</section>
      </section>

      <SourceCatalogPanel
        activeSources={sources}
        catalog={sourceCatalog}
        onAddSource={handleCatalogSourceAdd}
        onToggleCountry={handleToggleCountry}
        pinnedCountries={pinnedCountries}
      />

      {copilotSection}
    </div>
  );

  const proView = (
    <div className="page-grid">
      {workspaceHeader}

      <section className="panel relative overflow-hidden p-8 sm:p-10">
        <div className="absolute inset-y-0 right-0 hidden w-1/2 bg-[radial-gradient(circle_at_top_right,rgba(11,140,116,0.22),transparent_58%),radial-gradient(circle_at_bottom_right,rgba(202,107,44,0.18),transparent_50%)] lg:block" />

        <div className="relative max-w-4xl">
          <p className="eyebrow">Herizon workspace</p>
          <h1 className="mt-4 max-w-3xl text-5xl font-semibold leading-[0.95] tracking-[-0.04em] text-[var(--foreground)] sm:text-6xl">
            A fact database for the job market, with smart comparison, company mapping, and persistent search workflows.
          </h1>
          <p className="section-copy mt-5 max-w-2xl">
            The workspace now separates live market totals from detail-enriched rows, keeps your search and CRM context across sessions, and exposes a researched source atlas for expanding beyond the initial Finnish footprint.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <button className="action-button" onClick={() => void refreshIntelligence()} type="button">
              {isRefreshing ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCcw className="h-4 w-4" />
              )}
              Refresh live signals
            </button>
            <button className="secondary-button" onClick={() => void handleSaveSearch()} type="button">
              <BookmarkPlus className="h-4 w-4" />
              Save current query
            </button>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="metric-tile">
              <span className="metric-label">Market openings</span>
              <strong className="metric-value">{data.analytics.totalJobs.toLocaleString()}</strong>
            </div>
            <div className="metric-tile">
              <span className="metric-label">Detail sample</span>
              <strong className="metric-value">{data.analytics.sampledJobs}</strong>
            </div>
            <div className="metric-tile">
              <span className="metric-label">Company radar</span>
              <strong className="metric-value">{data.analytics.totalCompanies}</strong>
            </div>
            <div className="metric-tile">
              <span className="metric-label">Live sources</span>
              <strong className="metric-value">{data.analytics.liveSources}</strong>
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
                <span>
                  {snapshot.totalAvailableJobs
                    ? `${snapshot.jobsFound} sampled / ${snapshot.totalAvailableJobs.toLocaleString()} live jobs`
                    : `${snapshot.jobsFound} jobs`}
                </span>
                <span>&middot;</span>
                <span>
                  {snapshot.totalAvailableCompanies
                    ? `${snapshot.totalAvailableCompanies} companies`
                    : `${snapshot.companiesFound} companies`}
                </span>
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

      <section className="panel p-6">
        <div className="grid gap-6 xl:grid-cols-[1.02fr_0.98fr]">
          <div>
            <p className="eyebrow">Signal workbench</p>
            <h2 className="section-title">Ask the market in plain English</h2>
            <p className="section-copy mt-3 max-w-2xl">
              The search bar interprets technologies, location, seniority, Finnish requirement, remote mode, and years of experience. Comparison queries like AWS vs Azure use the structured fact columns instead of raw text.
            </p>

            <label className="relative mt-5 block">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
              <input
                className="input-shell pl-11"
                onChange={(event) => setJobsQuery(event.target.value)}
                placeholder="Compare AWS vs Azure in Helsinki senior roles with English-friendly teams"
                value={jobsQuery}
              />
            </label>

            <div className="mt-4 flex flex-wrap gap-2">
              {(lensChips.length ? lensChips : smartQueryExamples).map((chip) => (
                <button
                  key={chip}
                  className="chip cursor-pointer hover:border-[rgba(11,140,116,0.24)]"
                  onClick={() => {
                    if (smartQueryExamples.includes(chip)) {
                      setJobsQuery(chip);
                    }
                  }}
                  type="button"
                >
                  {chip}
                </button>
              ))}
            </div>

            <div className="mt-6 rounded-[1.4rem] border border-[rgba(19,38,31,0.08)] bg-white/60 p-5">
              <div className="flex items-center gap-3">
                <Target className="h-5 w-5 text-[var(--accent)]" />
                <p className="text-sm font-medium uppercase tracking-[0.18em] text-[var(--muted)]">
                  Query understanding
                </p>
              </div>

              <p className="mt-4 text-sm leading-7 text-[var(--muted)]">
                {queryLens.interpreted
                  ? `Matching ${filteredJobs.length} sample records across ${filteredCompanies} companies and ${filteredLocations} locations.`
                  : "No structured lens is active yet. Use the examples above or type a natural query."}
              </p>

              {query && !filteredJobs.length ? (
                <p className="mt-3 text-sm text-[var(--accent-2)]">
                  No sampled jobs match the current structured lens. Broaden the query or refresh sources.
                </p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="metric-tile">
              <span className="metric-label">Matched sample rows</span>
              <strong className="metric-value">{filteredJobs.length}</strong>
            </div>
            <div className="metric-tile">
              <span className="metric-label">Matched companies</span>
              <strong className="metric-value">{filteredCompanies}</strong>
            </div>
            <div className="metric-tile">
              <span className="metric-label">Matched locations</span>
              <strong className="metric-value">{filteredLocations}</strong>
            </div>
            <div className="metric-tile">
              <span className="metric-label">Remote-friendly in lens</span>
              <strong className="metric-value">{filteredRemoteJobs}</strong>
            </div>
          </div>
        </div>
      </section>

      {workspaceMemory}
      {comparisonSection}

      <section id="sources" className="panel p-6">
        <div className="grid gap-8 xl:grid-cols-[0.92fr_1.08fr]">
          <div>
            <p className="eyebrow">Source cockpit</p>
            <h2 className="section-title">Bring your own market sources</h2>
            <p className="section-copy mt-3">
              The product is not tied to one site. Add public job boards, startup directories, or direct careers pages and refresh them as a single market view. If you are new, start with the setup guide and paste one of the supported board URLs below.
            </p>

            <div className="mt-6 rounded-[1.3rem] border border-[rgba(19,38,31,0.08)] bg-white/60 p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-medium uppercase tracking-[0.18em] text-[var(--muted)]">
                    Quick start examples
                  </p>
                  <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
                    Tap one of these to prefill a working board URL. Herizon will infer the connector automatically.
                  </p>
                </div>
                <Link className="secondary-button" href="/setup">
                  Open setup guide
                </Link>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {sourceQuickstartExamples.map((example) => (
                  <button
                    key={example.url}
                    className="chip cursor-pointer hover:border-[rgba(11,140,116,0.24)]"
                    onClick={() =>
                      setDraft({ name: example.name, url: example.url, kind: example.kind })
                    }
                    type="button"
                  >
                    {example.label}
                  </button>
                ))}
              </div>
            </div>

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
                <span className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                  {draftParserHint
                    ? `Detected connector: ${formatParserHintLabel(draftParserHint)}`
                    : "Paste a supported source URL to preview the connector"}
                </span>
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
                      {snapshot?.totalAvailableJobs
                        ? `${snapshot.jobsFound} sampled / ${snapshot.totalAvailableJobs.toLocaleString()} live jobs`
                        : `${snapshot?.jobsFound ?? 0} jobs`} / {snapshot?.totalAvailableCompanies ?? snapshot?.companiesFound ?? 0} companies
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <SourceCatalogPanel
        activeSources={sources}
        catalog={sourceCatalog}
        onAddSource={handleCatalogSourceAdd}
        onToggleCountry={handleToggleCountry}
        pinnedCountries={pinnedCountries}
      />

      <AnalyticsCharts analytics={data.analytics} snapshots={data.snapshots} />

      <section className="panel p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="eyebrow">Job desk</p>
            <h2 className="section-title">Structured roles, not scraped noise</h2>
            <p className="section-copy mt-3 max-w-3xl">
              Showing {filteredJobs.length} of {data.jobs.length} sampled roles with technologies, seniority, years of experience, Finnish requirement, and work mode surfaced as first-class facts.
            </p>
          </div>

          {jobsQuery ? (
            <button className="secondary-button" onClick={() => setJobsQuery("")} type="button">
              Clear query lens
            </button>
          ) : null}
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="data-table min-w-[1080px]">
            <thead>
              <tr>
                <th>Role</th>
                <th>Company</th>
                <th>Location</th>
                <th>Technology</th>
                <th>Seniority / YoE</th>
                <th>Language / mode</th>
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
                      {job.employmentTypes.length ? (
                        <p className="mt-2 text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
                          {job.employmentTypes.join(" · ")}
                        </p>
                      ) : null}
                    </td>
                    <td>{job.company}</td>
                    <td>{job.location}</td>
                    <td>
                      <div className="flex flex-wrap gap-2">
                        {job.technologies.length ? (
                          job.technologies.slice(0, 4).map((tag) => (
                            <span key={`${job.id}-${tag}`} className="chip">
                              {tag}
                            </span>
                          ))
                        ) : (
                          <span className="chip">Not stated</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-2">
                        <span className="chip">{job.seniority}</span>
                        <span className="chip">{formatExperience(job.yearsExperience)}</span>
                      </div>
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-2">
                        <span className="chip">{formatFinnishRequirement(job.finnishRequirement)}</span>
                        {job.workModes.map((mode) => (
                          <span key={`${job.id}-${mode}`} className="chip">
                            {mode}
                          </span>
                        ))}
                        {job.languageRequirements.map((language) => (
                          <span key={`${job.id}-${language}`} className="chip">
                            {language}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>{job.sourceName}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="py-8 text-center text-sm text-[var(--muted)]" colSpan={7}>
                    No jobs match the current query or the live parser has not surfaced any job cards yet.
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

          <div className="mt-6">{companyNotesSection}</div>
        </div>
      </section>

      {copilotSection}
    </div>
  );

  return (
    <div className="page-shell">
      {viewMode === "simple" ? simpleView : proView}

      {(isPending || isRefreshing || isPersisting) && (
        <div className="pointer-events-none fixed bottom-6 right-6 rounded-full border border-[rgba(19,38,31,0.1)] bg-[rgba(255,251,245,0.92)] px-4 py-2 text-sm text-[var(--muted)] shadow-[0_18px_50px_rgba(19,38,31,0.12)] backdrop-blur">
          Syncing live intelligence...
        </div>
      )}
    </div>
  );
}
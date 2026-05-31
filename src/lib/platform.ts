import { fallbackCompaniesForSource } from "./seed";
import { extractCompaniesFromHtml, extractJobsFromHtml, fetchHtml } from "./scrapers";
import { dedupeBy, takeTopBuckets } from "./utils";
import type {
  CompanyProfile,
  JobListing,
  OutreachPlan,
  PlatformAnalytics,
  PlatformIntelligence,
  SourceConfig,
  SourceSnapshot,
} from "./types";

function createSnapshot(
  source: SourceConfig,
  snapshot: Omit<SourceSnapshot, "source">,
): SourceSnapshot {
  return {
    source,
    ...snapshot,
  };
}

function fallbackSnapshot(
  source: SourceConfig,
  refreshedAt: string,
  reason: string,
): SourceSnapshot {
  const companies = fallbackCompaniesForSource(source.id);

  return createSnapshot(source, {
    status: companies.length ? "partial" : "error",
    mode: "fallback",
    refreshedAt,
    jobsFound: 0,
    companiesFound: companies.length,
    notes: companies.length
      ? [reason, "Showing seeded company radar so the workspace stays usable."]
      : [reason, "No fallback data is configured for this source."],
    jobs: [],
    companies,
  });
}

export async function refreshSource(source: SourceConfig): Promise<SourceSnapshot> {
  const refreshedAt = new Date().toISOString();

  try {
    const html = await fetchHtml(source.url);

    let jobs: JobListing[] = [];
    let companies: CompanyProfile[] = [];

    if (source.kind !== "company-directory") {
      jobs = extractJobsFromHtml(html, source);
    }

    if (source.kind !== "jobs") {
      companies = extractCompaniesFromHtml(html, source);
    }

    if (!jobs.length && !companies.length) {
      const seededFallback = fallbackCompaniesForSource(source.id);

      if (seededFallback.length) {
        return createSnapshot(source, {
          status: "partial",
          mode: "fallback",
          refreshedAt,
          jobsFound: 0,
          companiesFound: seededFallback.length,
          notes: [
            "Live HTML was reachable, but the parser did not find structured cards on this refresh.",
            "Showing seeded company radar until you tighten the source-specific parser.",
          ],
          jobs: [],
          companies: seededFallback,
        });
      }
    }

    const notes: string[] = [];

    if (!jobs.length && source.kind !== "company-directory") {
      notes.push("No job cards were parsed from the latest HTML refresh.");
    }

    if (!companies.length && source.kind !== "jobs") {
      notes.push("No company cards were parsed from the latest HTML refresh.");
    }

    return createSnapshot(source, {
      status: jobs.length || companies.length ? "ok" : "partial",
      mode: "live",
      refreshedAt,
      jobsFound: jobs.length,
      companiesFound: companies.length,
      notes,
      jobs,
      companies,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown fetch failure";
    return fallbackSnapshot(source, refreshedAt, `Live fetch failed: ${message}.`);
  }
}

export function buildAnalytics(
  snapshots: SourceSnapshot[],
  jobs: JobListing[],
  companies: CompanyProfile[],
): PlatformAnalytics {
  const sourceCounts = new Map<string, number>();
  const locationCounts = new Map<string, number>();
  const sectorCounts = new Map<string, number>();

  for (const snapshot of snapshots) {
    sourceCounts.set(
      snapshot.source.name,
      (snapshot.jobsFound || 0) + (snapshot.companiesFound || 0),
    );
  }

  for (const job of jobs) {
    locationCounts.set(
      job.normalizedLocation,
      (locationCounts.get(job.normalizedLocation) ?? 0) + 1,
    );
  }

  for (const company of companies) {
    locationCounts.set(
      company.normalizedLocation,
      (locationCounts.get(company.normalizedLocation) ?? 0) + 1,
    );

    for (const sector of company.sectors) {
      sectorCounts.set(sector, (sectorCounts.get(sector) ?? 0) + 1);
    }
  }

  return {
    totalJobs: jobs.length,
    totalCompanies: companies.length,
    liveSources: snapshots.filter((snapshot) => snapshot.mode === "live").length,
    fallbackSources: snapshots.filter((snapshot) => snapshot.mode === "fallback").length,
    remoteFriendlyJobs: jobs.filter((job) => job.remote).length,
    bySource: takeTopBuckets(sourceCounts),
    byLocation: takeTopBuckets(locationCounts),
    bySector: takeTopBuckets(sectorCounts),
  };
}

function buildBrief(
  analytics: PlatformAnalytics,
  snapshots: SourceSnapshot[],
  companies: CompanyProfile[],
): string[] {
  const topLocation = analytics.byLocation[0]?.label;
  const topSource = analytics.bySource[0]?.label;
  const liveCount = snapshots.filter((snapshot) => snapshot.mode === "live").length;
  const fallbackCount = snapshots.length - liveCount;

  return [
    liveCount
      ? `${liveCount} source${liveCount === 1 ? "" : "s"} refreshed live in the current run.`
      : "No source returned live records in the current run.",
    topLocation
      ? `${topLocation} is the densest location signal across jobs and companies right now.`
      : "Location density will appear once the parsers find geographic signals.",
    topSource
      ? `${topSource} is producing the most visible records in this refresh.`
      : "Add more direct company boards if you want stronger source-level coverage.",
    companies.length
      ? `${companies.length} companies are ready for research, outreach, or map-based triage.`
      : "Company discovery is empty; a company directory source will unlock outreach radar and map views.",
    fallbackCount
      ? `${fallbackCount} source${fallbackCount === 1 ? " is" : "s are"} running on transparent fallback data.`
      : "Everything shown is grounded in the latest live scrape.",
  ].slice(0, 4);
}

export async function collectPlatformIntelligence(
  sources: SourceConfig[],
): Promise<PlatformIntelligence> {
  const snapshots = await Promise.all(sources.map((source) => refreshSource(source)));

  const jobs = dedupeBy(
    snapshots.flatMap((snapshot) => snapshot.jobs),
    (job) => job.url,
  ).sort((left, right) => right.confidence - left.confidence);

  const companies = dedupeBy(
    snapshots.flatMap((snapshot) => snapshot.companies),
    (company) => company.slug,
  ).sort((left, right) => right.confidence - left.confidence);

  const analytics = buildAnalytics(snapshots, jobs, companies);

  return {
    generatedAt: new Date().toISOString(),
    sources,
    snapshots,
    jobs,
    companies,
    analytics,
    brief: buildBrief(analytics, snapshots, companies),
  };
}

export function buildOutreachPlan(
  company: CompanyProfile,
  intelligence: PlatformIntelligence,
): OutreachPlan {
  const adjacentJobs = intelligence.jobs.filter(
    (job) =>
      job.company.toLowerCase().includes(company.name.toLowerCase()) ||
      job.normalizedLocation === company.normalizedLocation,
  );
  const sector = company.sectors[0] ?? "technology";

  return {
    companyId: company.id,
    companyName: company.name,
    opening: `Hi ${company.name} team, I have been tracking the ${sector.toLowerCase()} momentum around ${company.normalizedLocation}. ${company.outreachHook}`,
    valueAngles: [
      `Lead with why ${company.name} is on your radar right now: ${company.whyNow}`,
      adjacentJobs.length
        ? `Mention the live hiring signal nearby: ${adjacentJobs[0]?.title} in ${adjacentJobs[0]?.location}.`
        : `Anchor the note in a concrete market observation instead of asking for a generic referral.`,
      `Offer one small, relevant proof of work tied to ${sector.toLowerCase()} or a similar operating problem.`,
    ],
    sequence: [
      "Day 0: send a short opener that references one specific company, product, or market signal.",
      "Day 3: follow up with a sharper question about team priorities or current bottlenecks.",
      "Day 8: share a tailored proof of work, portfolio slice, or concise idea worth reacting to.",
    ],
    cautions: [
      "Do not open with a referral request before establishing context.",
      "Avoid sounding as if you scraped a list and blasted the same note to every company.",
      `Keep the ask light: a learning conversation, feedback on fit, or one relevant introduction is enough.`,
    ],
  };
}

export function findCompanyById(
  intelligence: PlatformIntelligence,
  companyId: string,
): CompanyProfile | undefined {
  return intelligence.companies.find((company) => company.id === companyId);
}
import { load } from "cheerio";

import {
  buildJobTags,
  classifyFinnishRequirement,
  compactText,
  detectExperienceRange,
  detectSeniority,
  detectWorkModes,
  extractRequirementSignalsFromHtml,
  extractTechnologies,
  formatPrimaryLocation,
  normalizeLanguageLabel,
  pickFirstSentence,
  stripHtml,
} from "./job-facts";
import { coordinatesForLocation, normalizeLocation } from "./location";
import { dedupeBy, slugify } from "./utils";
import type {
  CompanyProfile,
  JobListing,
  SourceConfig,
  SourceSnapshot,
} from "./types";

type LocalizedText = string | { en?: string; fi?: string; sv?: string } | null | undefined;

type ScrapeSourceResult = {
  jobs: JobListing[];
  companies: CompanyProfile[];
  notes: string[];
  totalAvailableJobs?: number;
  totalAvailableCompanies?: number;
};

type TyomarkkinatoriSearchResponse = {
  content?: TyomarkkinatoriListing[];
  totalElements?: number;
  pageSize?: number;
};

type TyomarkkinatoriListing = {
  id: string;
  title?: LocalizedText;
  employer?: {
    ownerName?: LocalizedText;
    ownerOfficeName?: string;
    businessId?: string[];
  };
  location?: {
    municipalities?: Array<{ value: string; label?: LocalizedText }>;
    countries?: Array<{ value: string; label?: LocalizedText }>;
    address?: {
      postOffice?: string;
      streetAddress?: string;
      postalCode?: string;
    };
  };
  applicationPeriodEndDate?: string;
  applicationUrl?: string;
  publishDate?: string;
  employmentRelationships?: string | string[];
  continuityOfWork?: string | string[];
  workTime?: string;
};

type TyomarkkinatoriDetail = {
  position?: {
    title?: LocalizedText;
    jobDescription?: LocalizedText;
    marketingDescription?: LocalizedText;
    workLanguages?: string[];
    workTime?: string;
    continuityOfWork?: string[];
    wagePrincipleInfo?: LocalizedText;
  };
  owner?: {
    company?: LocalizedText;
  };
  application?: {
    openPositions?: number;
    expires?: string;
    published?: string;
    helpText?: LocalizedText;
    url?: LocalizedText;
  };
  location?: {
    workplacePostOffice?: string;
  };
};

type GreenhouseJobsResponse = {
  jobs?: GreenhouseJob[];
};

type GreenhouseJob = {
  id: number;
  title: string;
  updated_at?: string;
  absolute_url: string;
  content?: string;
  location?: { name?: string };
  departments?: Array<{ name?: string }>;
};

type LeverJob = {
  id: string;
  text: string;
  categories?: {
    location?: string;
    commitment?: string;
    team?: string;
    department?: string;
    allLocations?: string[];
  };
  openingPlain?: string;
  descriptionPlain?: string;
  additionalPlain?: string;
  lists?: Array<{ text?: string; content?: string }>;
  hostedUrl: string;
  applyUrl?: string;
  workplaceType?: "unspecified" | "on-site" | "remote" | "hybrid";
};

type SmartRecruitersListResponse = {
  totalFound?: number;
  content?: SmartRecruitersPosting[];
};

type SmartRecruitersPosting = {
  id: string;
  name: string;
  company?: {
    identifier?: string;
    name?: string;
  };
  releasedDate?: string;
  location?: {
    country?: string;
    region?: string;
    city?: string;
    remote?: boolean;
  };
  department?: { label?: string };
  function?: { label?: string };
  typeOfEmployment?: { label?: string };
  experienceLevel?: { label?: string };
  ref?: string;
};

type SmartRecruitersPostingDetail = SmartRecruitersPosting & {
  applyUrl?: string;
  jobAd?: {
    sections?: Record<string, { title?: string; text?: string }>;
  };
};

type AshbyLocation = {
  locationName?: string | null;
};

type AshbyJobPosting = {
  id: string;
  title: string;
  departmentName?: string | null;
  teamName?: string | null;
  locationName?: string | null;
  workplaceType?: string | null;
  employmentType?: string | null;
  publishedDate?: string | null;
  applicationDeadline?: string | null;
  compensationTierSummary?: string | null;
  isListed?: boolean;
  secondaryLocations?: AshbyLocation[];
};

type AshbyJobDetail = {
  description: string;
  applyUrl?: string;
  requirementSignals: string[];
};

const JOB_TEXT_HINT =
  /(job|career|position|vacanc|opening|hiring|rekry|developer|engineer|designer|manager|analyst|lead|specialist|scientist)/i;
const JOB_LINK_HINT = /(job|career|position|vacanc|opening|greenhouse|lever|workable|apply)/i;
const COMPANY_LINK_HINT = /(company|companies|startup|portfolio|venture|team)/i;
const NAVIGATION_BLOCKLIST = new Set([
  "about",
  "blog",
  "careers",
  "contact",
  "cookies",
  "events",
  "finland",
  "home",
  "jobs",
  "learn more",
  "login",
  "menu",
  "more",
  "news",
  "open",
  "open positions",
  "open roles",
  "pricing",
  "privacy",
  "read more",
  "search",
  "see all",
  "sign in",
  "sign up",
  "terms",
]);
const SECTOR_PATTERNS = [
  { label: "AI", regex: /(ai|machine learning|automation)/i },
  { label: "Data", regex: /(data|analytics|warehouse|platform)/i },
  { label: "Health tech", regex: /(health|wellness|medical|care)/i },
  { label: "Climate", regex: /(climate|energy|sustainability)/i },
  { label: "Fintech", regex: /(fintech|payments|finance|banking)/i },
  { label: "Marketplace", regex: /(marketplace|delivery|commerce)/i },
  { label: "Enterprise software", regex: /(saas|enterprise|workflow|supply chain)/i },
  { label: "Space tech", regex: /(space|satellite|geospatial)/i },
];
const MAX_ASHBY_SAMPLE = 40;

const tyomarkkinatoriCodeCache = new Map<string, Promise<Map<string, string>>>();

function pickLocalizedText(value: LocalizedText): string {
  if (!value) {
    return "";
  }

  if (typeof value === "string") {
    return compactText(value);
  }

  return compactText(value.en ?? value.fi ?? value.sv ?? "");
}

function resolveUrl(baseUrl: string, rawHref: string): string {
  try {
    return new URL(rawHref, baseUrl).toString();
  } catch {
    return baseUrl;
  }
}

function inferSectors(context: string): string[] {
  const sectors = SECTOR_PATTERNS.filter((pattern) => pattern.regex.test(context)).map(
    (pattern) => pattern.label,
  );

  return sectors.length ? sectors : ["General tech"];
}

function summarizeContext(context: string, fallback: string): string {
  const summary = compactText(context).slice(0, 180);
  return summary || fallback;
}

function scoreGenericJob(title: string, href: string, context: string): number {
  let score = 0;

  if (JOB_TEXT_HINT.test(title)) {
    score += 3;
  }

  if (JOB_LINK_HINT.test(href)) {
    score += 2;
  }

  if (/published|application|location|remote|hybrid|full[- ]time|part[- ]time|department/i.test(context)) {
    score += 2;
  }

  return score;
}

function scoreCompany(name: string, href: string, context: string): number {
  let score = 0;

  if (COMPANY_LINK_HINT.test(href)) {
    score += 2;
  }

  if (/^[A-Z][A-Za-z0-9&' .-]{1,60}$/.test(name)) {
    score += 1;
  }

  if (/startup|scaleup|software|platform|fintech|helsinki|finland/i.test(context)) {
    score += 1;
  }

  return score;
}

function sourceHostLabel(url: string): string {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    return hostname.split(".")[0]?.replace(/[-_]+/g, " ") ?? hostname;
  } catch {
    return "source";
  }
}

function buildGenericJob(title: string, href: string, context: string, source: SourceConfig): JobListing {
  const text = compactText(context.replace(title, ""));
  const locations = [normalizeLocation(text)];
  const technologies = extractTechnologies(title, text);
  const workModes = detectWorkModes(text, locations);
  const languageRequirements = /english/i.test(text) ? ["English"] : [];
  const finnishRequirement = classifyFinnishRequirement(text, languageRequirements);
  const seniority = detectSeniority(title, text);

  return {
    id: `${source.id}-${slugify(`${title}-${href}`)}`,
    title,
    company: sourceHostLabel(source.url),
    companySlug: slugify(sourceHostLabel(source.url)),
    location: formatPrimaryLocation(locations),
    locations,
    normalizedLocation: normalizeLocation(locations[0] ?? "Unspecified"),
    url: href,
    sourceId: source.id,
    sourceName: source.name,
    department: undefined,
    tags: buildJobTags({
      department: undefined,
      seniority,
      technologies,
      finnishRequirement,
      workModes,
    }),
    technologies,
    languageRequirements,
    finnishRequirement,
    workModes,
    employmentTypes: [],
    seniority,
    yearsExperience: detectExperienceRange(text),
    requirementSignals: [],
    postedAt: undefined,
    deadlineAt: undefined,
    postedLabel: undefined,
    remote: workModes.some((mode) => mode === "remote" || mode === "hybrid"),
    confidence: 0.62,
    sourceQuality: "html",
    description: text,
    summary: summarizeContext(text, `Parsed from ${source.name}.`),
  };
}

export async function fetchHtml(url: string): Promise<string> {
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    },
    signal: AbortSignal.timeout(20000),
  });

  if (!response.ok) {
    throw new Error(`Request failed with ${response.status}`);
  }

  return response.text();
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      accept: "application/json, text/plain, */*",
      "content-type": "application/json",
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      ...(init?.headers ?? {}),
    },
    signal: AbortSignal.timeout(20000),
    ...init,
  });

  if (!response.ok) {
    throw new Error(`Request failed with ${response.status}`);
  }

  return (await response.json()) as T;
}

async function getTyomarkkinatoriCodeMap(codeSet: string): Promise<Map<string, string>> {
  const existing = tyomarkkinatoriCodeCache.get(codeSet);

  if (existing) {
    return existing;
  }

  const promise = fetchJson<
    Array<{
      tunnus: string;
      selite?: Array<{ kielikoodi?: string; teksti?: string }>;
    }>
  >(
    `https://tyomarkkinatori.fi/api/codes/v1/kopa/${encodeURIComponent(codeSet)}/koodit?voimassa=${new Date().toISOString().slice(0, 10)}`,
    {
      headers: { accept: "application/json" },
    },
  ).then((items) => {
    const map = new Map<string, string>();

    for (const item of items) {
      const english = item.selite?.find((entry) => entry.kielikoodi === "en")?.teksti;
      const fallback = item.selite?.[0]?.teksti;
      map.set(item.tunnus, english ?? fallback ?? item.tunnus);
    }

    return map;
  });

  tyomarkkinatoriCodeCache.set(codeSet, promise);
  return promise;
}

async function getTyomarkkinatoriCodeLabel(codeSet: string, code: string | undefined): Promise<string | undefined> {
  if (!code) {
    return undefined;
  }

  const codeMap = await getTyomarkkinatoriCodeMap(codeSet);
  return codeMap.get(code) ?? code;
}

function toTyomarkkinatoriJobUrl(listingId: string): string {
  return `https://tyomarkkinatori.fi/en/personal-customers/vacancies/${listingId}/en`;
}

async function buildTyomarkkinatoriJob(
  source: SourceConfig,
  listing: TyomarkkinatoriListing,
  detail: TyomarkkinatoriDetail | null,
): Promise<JobListing> {
  const title = pickLocalizedText(detail?.position?.title) || pickLocalizedText(listing.title);
  const company =
    pickLocalizedText(detail?.owner?.company) ||
    pickLocalizedText(listing.employer?.ownerName) ||
    source.name;
  const locations = dedupeBy(
    [
      ...(listing.location?.municipalities?.map((item) => pickLocalizedText(item.label)) ?? []),
      listing.location?.address?.postOffice,
      detail?.location?.workplacePostOffice,
    ].filter((value): value is string => Boolean(value && value.trim())),
    (value) => value.toLowerCase(),
  );
  const description = [
    pickLocalizedText(detail?.position?.jobDescription),
    pickLocalizedText(detail?.position?.marketingDescription),
    pickLocalizedText(detail?.application?.helpText),
    pickLocalizedText(detail?.position?.wagePrincipleInfo),
  ]
    .filter(Boolean)
    .join("\n\n");
  const workLanguageCodes = detail?.position?.workLanguages ?? [];
  const languageRequirements = dedupeBy(
    await Promise.all(
      workLanguageCodes.map(async (code) => {
        const label = await getTyomarkkinatoriCodeLabel("KIELI", code);
        return normalizeLanguageLabel(label ?? code);
      }),
    ),
    (value) => value.toLowerCase(),
  );
  const employmentTypes = dedupeBy(
    (
      await Promise.all([
        ...(Array.isArray(listing.employmentRelationships)
          ? listing.employmentRelationships
          : [listing.employmentRelationships]).map((code) =>
          getTyomarkkinatoriCodeLabel("PALVELUSSUHDE", code),
        ),
        ...(detail?.position?.continuityOfWork ?? []).map((code) =>
          getTyomarkkinatoriCodeLabel("TYÖN_JATKUVUUS", code),
        ),
        getTyomarkkinatoriCodeLabel("TYÖAIKA", detail?.position?.workTime ?? listing.workTime),
      ])
    ).filter((value): value is string => Boolean(value)),
    (value) => value.toLowerCase(),
  );
  const technologies = extractTechnologies(title, description);
  const workModes = detectWorkModes(description, locations);
  const seniority = detectSeniority(title, description);
  const finnishRequirement = classifyFinnishRequirement(description, languageRequirements);
  const requirementSignals = extractRequirementSignalsFromHtml(description);

  return {
    id: `${source.id}-${listing.id}`,
    title,
    company,
    companySlug: slugify(company),
    location: formatPrimaryLocation(locations),
    locations,
    normalizedLocation: normalizeLocation(locations[0] ?? "Unspecified"),
    url: toTyomarkkinatoriJobUrl(listing.id),
    applyUrl: pickLocalizedText(detail?.application?.url) || listing.applicationUrl,
    sourceId: source.id,
    sourceName: source.name,
    department: undefined,
    tags: buildJobTags({
      department: undefined,
      seniority,
      technologies,
      finnishRequirement,
      workModes,
    }),
    technologies,
    languageRequirements,
    finnishRequirement,
    workModes,
    employmentTypes,
    seniority,
    yearsExperience: detectExperienceRange(description),
    requirementSignals,
    postedAt: detail?.application?.published ?? listing.publishDate,
    deadlineAt: detail?.application?.expires ?? listing.applicationPeriodEndDate,
    postedLabel: undefined,
    remote: workModes.some((mode) => mode === "remote" || mode === "hybrid"),
    confidence: detail ? 0.99 : 0.91,
    sourceQuality: "api",
    description,
    summary:
      pickFirstSentence(description, 180) ||
      `Structured vacancy extracted from ${source.name}.`,
  };
}

async function scrapeTyomarkkinatori(source: SourceConfig): Promise<ScrapeSourceResult> {
  const searchResponse = await fetchJson<TyomarkkinatoriSearchResponse>(
    "https://tyomarkkinatori.fi/api/jobpostingfulltext/search/v2/search",
    {
      method: "POST",
      body: JSON.stringify({
        query: "",
        filters: {},
        paging: {
          pageNumber: 0,
          pageSize: 30,
        },
        sorting: "LATEST",
      }),
    },
  );
  const listings = searchResponse.content ?? [];
  const detailResults = await Promise.all(
    listings.map(async (listing) => {
      try {
        return await fetchJson<TyomarkkinatoriDetail>(
          `https://tyomarkkinatori.fi/api/jobposting-new/v1/public/jobpostings/${listing.id}`,
          {
            headers: { accept: "application/json" },
          },
        );
      } catch {
        return null;
      }
    }),
  );
  const jobs = await Promise.all(
    listings.map((listing, index) => buildTyomarkkinatoriJob(source, listing, detailResults[index] ?? null)),
  );
  const totalAvailableJobs = searchResponse.totalElements ?? jobs.length;
  const notes = [
    `Using the official vacancies search API and enriching the latest ${jobs.length} listings with vacancy detail records.`,
  ];

  if (totalAvailableJobs > jobs.length) {
    notes.push(`Showing ${jobs.length} detail-enriched vacancies from a live market of ${totalAvailableJobs}.`);
  }

  return {
    jobs,
    companies: [],
    notes,
    totalAvailableJobs,
  };
}

function extractGreenhouseBoardToken(url: string): string | null {
  try {
    const pathname = new URL(url).pathname.split("/").filter(Boolean);
    return pathname[0] ?? null;
  } catch {
    return null;
  }
}

function extractLeverSiteName(url: string): { site: string; eu: boolean } | null {
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split("/").filter(Boolean);

    if (/api(\.eu)?\.lever\.co/.test(parsed.hostname)) {
      const postingsIndex = segments.findIndex((segment) => segment === "postings");
      const site = segments[postingsIndex + 1];

      if (!site) {
        return null;
      }

      return { site, eu: /api\.eu\.lever\.co/.test(parsed.hostname) };
    }

    const site = segments[0];

    if (!site) {
      return null;
    }

    return { site, eu: /jobs\.eu\.lever\.co/.test(parsed.hostname) };
  } catch {
    return null;
  }
}

function buildLeverDescription(job: LeverJob): string {
  return [
    compactText(job.openingPlain ?? ""),
    compactText(job.descriptionPlain ?? ""),
    ...((job.lists ?? []).map((item) => `${compactText(item.text ?? "")}: ${stripHtml(item.content ?? "")}`)),
    compactText(job.additionalPlain ?? ""),
  ]
    .filter(Boolean)
    .join("\n\n");
}

function buildLeverJob(source: SourceConfig, job: LeverJob): JobListing {
  const company = source.name.replace(/\s+careers?$/i, "");
  const description = buildLeverDescription(job);
  const department = [job.categories?.department, job.categories?.team].filter(Boolean).join(" / ") || undefined;
  const locations = dedupeBy(
    [job.categories?.location, ...(job.categories?.allLocations ?? [])]
      .map((location) => compactText(location ?? ""))
      .filter(Boolean),
    (location) => location.toLowerCase(),
  );
  const languageRequirements = dedupeBy(
    [
      /\benglish\b/i.test(description) ? "English" : undefined,
      /\bfinnish\b|\bsuomi\b/i.test(description) ? "Finnish" : undefined,
      /\bswedish\b/i.test(description) ? "Swedish" : undefined,
    ].filter((value): value is string => Boolean(value)),
    (value) => value.toLowerCase(),
  );
  const workModes = dedupeBy(
    [
      job.workplaceType === "remote"
        ? "remote"
        : job.workplaceType === "hybrid"
          ? "hybrid"
          : job.workplaceType === "on-site"
            ? "onsite"
            : undefined,
      ...detectWorkModes(description, locations),
    ].filter((value): value is JobListing["workModes"][number] => Boolean(value)),
    (value) => value,
  );
  const technologies = extractTechnologies(job.text, description);
  const seniority = detectSeniority(job.text, description);
  const finnishRequirement = classifyFinnishRequirement(description, languageRequirements);
  const employmentTypes = dedupeBy(
    [job.categories?.commitment, /contract/i.test(description) ? "Contract" : undefined].filter(
      (value): value is string => Boolean(value),
    ),
    (value) => value.toLowerCase(),
  );

  return {
    id: `${source.id}-${job.id}`,
    title: compactText(job.text),
    company,
    companySlug: slugify(company),
    location: formatPrimaryLocation(locations),
    locations,
    normalizedLocation: normalizeLocation(locations[0] ?? "Unspecified"),
    url: job.hostedUrl,
    applyUrl: job.applyUrl ?? job.hostedUrl,
    sourceId: source.id,
    sourceName: source.name,
    department,
    tags: buildJobTags({
      department,
      seniority,
      technologies,
      finnishRequirement,
      workModes,
    }),
    technologies,
    languageRequirements,
    finnishRequirement,
    workModes,
    employmentTypes,
    seniority,
    yearsExperience: detectExperienceRange(description),
    requirementSignals: [],
    postedAt: undefined,
    deadlineAt: undefined,
    postedLabel: undefined,
    remote: workModes.some((mode) => mode === "remote" || mode === "hybrid"),
    confidence: 0.97,
    sourceQuality: "api",
    description,
    summary: pickFirstSentence(description, 180) || `Structured opening extracted from ${source.name}.`,
  };
}

async function scrapeLever(source: SourceConfig): Promise<ScrapeSourceResult> {
  const siteInfo = extractLeverSiteName(source.url);

  if (!siteInfo) {
    throw new Error("Lever site name not found.");
  }

  const baseUrl = siteInfo.eu ? "https://api.eu.lever.co/v0/postings" : "https://api.lever.co/v0/postings";
  const jobs = (
    await fetchJson<LeverJob[]>(`${baseUrl}/${siteInfo.site}?mode=json`, {
      headers: { accept: "application/json" },
    })
  ).map((job) => buildLeverJob(source, job));

  return {
    jobs,
    companies: [],
    notes: [`Using the Lever postings API for ${jobs.length} structured openings.`],
    totalAvailableJobs: jobs.length,
  };
}

function extractSmartRecruitersCompanyIdentifier(url: string): string | null {
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split("/").filter(Boolean);

    if (/api\.smartrecruiters\.com/.test(parsed.hostname)) {
      const companyIndex = segments.findIndex((segment) => segment === "companies");
      return segments[companyIndex + 1] ?? null;
    }

    return segments[0] ?? null;
  } catch {
    return null;
  }
}

function buildSmartRecruitersDescription(detail: SmartRecruitersPostingDetail): string {
  return Object.values(detail.jobAd?.sections ?? {})
    .map((section) => compactText(stripHtml(section.text ?? "")))
    .filter(Boolean)
    .join("\n\n");
}

function buildSmartRecruitersLocation(
  location: SmartRecruitersPosting["location"] | undefined,
): string[] {
  if (!location) {
    return [];
  }

  const parts = [location.city, location.region, location.country].filter(
    (value): value is string => Boolean(value && value.trim()),
  );

  return parts.length ? [parts.join(", ")] : [];
}

function buildSmartRecruitersJob(
  source: SourceConfig,
  listing: SmartRecruitersPosting,
  detail: SmartRecruitersPostingDetail | null,
): JobListing {
  const payload = detail ?? listing;
  const company = payload.company?.name ?? source.name.replace(/\s+careers?$/i, "");
  const description = buildSmartRecruitersDescription(payload as SmartRecruitersPostingDetail);
  const locations = dedupeBy(buildSmartRecruitersLocation(payload.location), (location) => location.toLowerCase());
  const department = [payload.department?.label, payload.function?.label].filter(Boolean).join(" / ") || undefined;
  const languageRequirements = dedupeBy(
    [
      /\benglish\b/i.test(description) ? "English" : undefined,
      /\bfinnish\b|\bsuomi\b/i.test(description) ? "Finnish" : undefined,
      /\bswedish\b/i.test(description) ? "Swedish" : undefined,
    ].filter((value): value is string => Boolean(value)),
    (value) => value.toLowerCase(),
  );
  const workModes = dedupeBy(
    [
      payload.location?.remote ? "remote" : undefined,
      ...detectWorkModes(description, locations),
    ].filter((value): value is JobListing["workModes"][number] => Boolean(value)),
    (value) => value,
  );
  const technologies = extractTechnologies(payload.name, description);
  const experienceLabel = payload.experienceLevel?.label ?? "";
  const seniority = detectSeniority(payload.name, `${experienceLabel} ${description}`);
  const finnishRequirement = classifyFinnishRequirement(description, languageRequirements);
  const employmentTypes = dedupeBy(
    [payload.typeOfEmployment?.label].filter((value): value is string => Boolean(value)),
    (value) => value.toLowerCase(),
  );

  return {
    id: `${source.id}-${payload.id}`,
    title: compactText(payload.name),
    company,
    companySlug: slugify(company),
    location: formatPrimaryLocation(locations),
    locations,
    normalizedLocation: normalizeLocation(locations[0] ?? "Unspecified"),
    url: detail?.applyUrl ?? listing.ref ?? source.url,
    applyUrl: detail?.applyUrl,
    sourceId: source.id,
    sourceName: source.name,
    department,
    tags: buildJobTags({
      department,
      seniority,
      technologies,
      finnishRequirement,
      workModes,
    }),
    technologies,
    languageRequirements,
    finnishRequirement,
    workModes,
    employmentTypes,
    seniority,
    yearsExperience: detectExperienceRange(`${experienceLabel} ${description}`),
    requirementSignals: extractRequirementSignalsFromHtml(description),
    postedAt: payload.releasedDate,
    deadlineAt: undefined,
    postedLabel: undefined,
    remote: workModes.some((mode) => mode === "remote" || mode === "hybrid"),
    confidence: detail ? 0.97 : 0.9,
    sourceQuality: "api",
    description,
    summary: pickFirstSentence(description, 180) || `Structured opening extracted from ${source.name}.`,
  };
}

async function scrapeSmartRecruiters(source: SourceConfig): Promise<ScrapeSourceResult> {
  const companyIdentifier = extractSmartRecruitersCompanyIdentifier(source.url);

  if (!companyIdentifier) {
    throw new Error("SmartRecruiters company identifier not found.");
  }

  const listResponse = await fetchJson<SmartRecruitersListResponse>(
    `https://api.smartrecruiters.com/v1/companies/${companyIdentifier}/postings?limit=30`,
    {
      headers: { accept: "application/json" },
    },
  );
  const listings = listResponse.content ?? [];
  const details = await Promise.all(
    listings.map(async (listing) => {
      try {
        return await fetchJson<SmartRecruitersPostingDetail>(
          `https://api.smartrecruiters.com/v1/companies/${companyIdentifier}/postings/${listing.id}`,
          {
            headers: { accept: "application/json" },
          },
        );
      } catch {
        return null;
      }
    }),
  );
  const jobs = listings.map((listing, index) => buildSmartRecruitersJob(source, listing, details[index] ?? null));

  return {
    jobs,
    companies: [],
    notes: [
      `Using the SmartRecruiters company postings endpoints for ${jobs.length} structured openings.`,
    ],
    totalAvailableJobs: listResponse.totalFound ?? jobs.length,
  };
}

function extractAshbyOrganizationSlug(url: string): string | null {
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split("/").filter(Boolean);
    return segments[0] ?? null;
  } catch {
    return null;
  }
}

function stripBoardSuffix(value: string): string {
  return compactText(value).replace(/\s+(jobs?|careers?)$/i, "").trim();
}

function extractAshbyCompanyName(html: string, source: SourceConfig): string {
  const $ = load(html);
  const title = stripBoardSuffix($("title").text());
  return title || stripBoardSuffix(source.name) || sourceHostLabel(source.url);
}

function findAshbyJobPostings(value: unknown): AshbyJobPosting[] {
  if (!value || typeof value !== "object") {
    return [];
  }

  if (
    "jobPostings" in value &&
    Array.isArray((value as { jobPostings?: unknown[] }).jobPostings)
  ) {
    return (value as { jobPostings: AshbyJobPosting[] }).jobPostings;
  }

  for (const child of Object.values(value as Record<string, unknown>)) {
    const postings = findAshbyJobPostings(child);

    if (postings.length) {
      return postings;
    }
  }

  return [];
}

function parseAshbyJobPostingsPayload(payload: string): AshbyJobPosting[] {
  const start = payload.indexOf("{");
  const end = payload.lastIndexOf("};");
  const statementEnd = payload.lastIndexOf(";");

  if (start === -1) {
    return [];
  }

  try {
    const parsed = JSON.parse(
      payload.slice(
        start,
        end === -1 ? (statementEnd === -1 ? payload.length : statementEnd) : end + 1,
      ),
    );

    return findAshbyJobPostings(parsed).filter(
      (posting) => Boolean(posting?.id && posting?.title) && posting.isListed !== false,
    );
  } catch {
    return [];
  }
}

function extractAshbyJobPostings(html: string): AshbyJobPosting[] {
  const $ = load(html);

  let postings: AshbyJobPosting[] = [];

  $("script").each((_, element) => {
    if (postings.length) {
      return;
    }

    const script = $(element).text() || $(element).html() || "";

    if (!script.includes('"jobPostings"') || !script.includes("routerPrefix")) {
      return;
    }

    postings = parseAshbyJobPostingsPayload(script);
  });

  if (!postings.length && html.includes('"jobPostings"') && html.includes("routerPrefix")) {
    postings = parseAshbyJobPostingsPayload(html);
  }

  return postings;
}

function normalizeAshbyWorkplaceType(
  workplaceType: string | null | undefined,
): JobListing["workModes"][number] | undefined {
  const normalized = compactText(workplaceType ?? "").toLowerCase();

  if (normalized === "remote") {
    return "remote";
  }

  if (normalized === "hybrid") {
    return "hybrid";
  }

  if (normalized === "onsite" || normalized === "on site" || normalized === "on-site") {
    return "onsite";
  }

  return undefined;
}

function formatAshbyEmploymentType(value: string | null | undefined): string | undefined {
  const normalized = compactText(value ?? "");

  if (!normalized) {
    return undefined;
  }

  const spaced = normalized.replace(/([a-z])([A-Z])/g, "$1 $2");

  return spaced === "Intern" ? "Internship" : spaced;
}

function buildAshbyLocations(posting: AshbyJobPosting): string[] {
  return dedupeBy(
    [
      posting.locationName,
      ...(posting.secondaryLocations ?? []).map((location) => location.locationName ?? undefined),
    ]
      .map((location) => compactText(location ?? ""))
      .filter(Boolean),
    (location) => location.toLowerCase(),
  );
}

function buildAshbyJobUrl(source: SourceConfig, organizationSlug: string, postingId: string): string {
  return resolveUrl(source.url, `/${organizationSlug}/${postingId}`);
}

function buildAshbyDescription(detailHtml: string): string {
  const $ = load(detailHtml);
  const metaDescription = compactText($("meta[name='description']").attr("content") ?? "");

  if (metaDescription) {
    return metaDescription;
  }

  return compactText($("main, article, [role='tabpanel']").text());
}

async function fetchAshbyDetail(jobUrl: string): Promise<AshbyJobDetail> {
  const html = await fetchHtml(jobUrl);
  const $ = load(html);
  const applyHref = $("a[href$='/application']").first().attr("href");

  return {
    description: buildAshbyDescription(html),
    applyUrl: applyHref ? resolveUrl(jobUrl, applyHref) : `${jobUrl}/application`,
    requirementSignals: extractRequirementSignalsFromHtml(html),
  };
}

function buildAshbyJob(
  source: SourceConfig,
  company: string,
  organizationSlug: string,
  posting: AshbyJobPosting,
  detail: AshbyJobDetail | null,
): JobListing {
  const jobUrl = buildAshbyJobUrl(source, organizationSlug, posting.id);
  const compensationSummary = compactText(posting.compensationTierSummary ?? "");
  const description = [
    detail?.description,
    compensationSummary ? `Compensation: ${compensationSummary}.` : undefined,
  ]
    .filter(Boolean)
    .join("\n\n");
  const locations = buildAshbyLocations(posting);
  const department = dedupeBy(
    [posting.departmentName, posting.teamName]
      .map((value) => compactText(value ?? ""))
      .filter(Boolean),
    (value) => value.toLowerCase(),
  ).join(" / ") || undefined;
  const languageRequirements = dedupeBy(
    [
      /\benglish\b/i.test(description) ? "English" : undefined,
      /\bfinnish\b|\bsuomi\b/i.test(description) ? "Finnish" : undefined,
      /\bswedish\b/i.test(description) ? "Swedish" : undefined,
    ].filter((value): value is string => Boolean(value)),
    (value) => value.toLowerCase(),
  );
  const workModes = dedupeBy(
    [normalizeAshbyWorkplaceType(posting.workplaceType), ...detectWorkModes(description, locations)].filter(
      (value): value is JobListing["workModes"][number] => Boolean(value),
    ),
    (value) => value,
  );
  const technologies = extractTechnologies(posting.title, description);
  const seniority = detectSeniority(posting.title, description);
  const finnishRequirement = classifyFinnishRequirement(description, languageRequirements);
  const employmentTypes = dedupeBy(
    [formatAshbyEmploymentType(posting.employmentType)].filter(
      (value): value is string => Boolean(value),
    ),
    (value) => value.toLowerCase(),
  );

  return {
    id: `${source.id}-${posting.id}`,
    title: compactText(posting.title),
    company,
    companySlug: slugify(company),
    location: formatPrimaryLocation(locations),
    locations,
    normalizedLocation: normalizeLocation(locations[0] ?? "Unspecified"),
    url: jobUrl,
    applyUrl: detail?.applyUrl ?? `${jobUrl}/application`,
    sourceId: source.id,
    sourceName: source.name,
    department,
    tags: buildJobTags({
      department,
      seniority,
      technologies,
      finnishRequirement,
      workModes,
    }),
    technologies,
    languageRequirements,
    finnishRequirement,
    workModes,
    employmentTypes,
    seniority,
    yearsExperience: detectExperienceRange(description),
    requirementSignals: detail?.requirementSignals ?? [],
    postedAt: posting.publishedDate ?? undefined,
    deadlineAt: posting.applicationDeadline ?? undefined,
    postedLabel: undefined,
    remote: workModes.some((mode) => mode === "remote" || mode === "hybrid"),
    confidence: detail ? 0.94 : 0.88,
    sourceQuality: "html",
    description,
    summary: pickFirstSentence(description, 180) || `Structured opening extracted from ${source.name}.`,
  };
}

async function scrapeAshby(source: SourceConfig): Promise<ScrapeSourceResult> {
  const organizationSlug = extractAshbyOrganizationSlug(source.url);

  if (!organizationSlug) {
    throw new Error("Ashby organization slug not found.");
  }

  const boardHtml = await fetchHtml(source.url);
  const company = extractAshbyCompanyName(boardHtml, source);
  const postings = extractAshbyJobPostings(boardHtml);

  if (!postings.length) {
    throw new Error("Ashby job postings not found.");
  }

  const sampledPostings = postings.slice(0, MAX_ASHBY_SAMPLE);
  const details = await Promise.all(
    sampledPostings.map(async (posting) => {
      try {
        return await fetchAshbyDetail(buildAshbyJobUrl(source, organizationSlug, posting.id));
      } catch {
        return null;
      }
    }),
  );
  const jobs = sampledPostings.map((posting, index) =>
    buildAshbyJob(source, company, organizationSlug, posting, details[index] ?? null),
  );
  const noteSuffix =
    postings.length > sampledPostings.length
      ? ` Sampled ${sampledPostings.length} detail pages from ${postings.length} listed roles.`
      : ` Parsed ${jobs.length} listed roles.`;

  return {
    jobs,
    companies: [],
    notes: [
      `Using Ashby's public board state and detail pages for structured job extraction.${noteSuffix}`,
    ],
    totalAvailableJobs: postings.length,
  };
}

function buildGreenhouseJob(source: SourceConfig, job: GreenhouseJob): JobListing {
  const company = source.name.replace(/\s+careers$/i, "");
  const description = stripHtml(job.content ?? "");
  const requirementSignals = extractRequirementSignalsFromHtml(job.content ?? "");
  const locations = dedupeBy(
    compactText(job.location?.name ?? "")
      .split(/\s*;\s*/)
      .map((location) => compactText(location))
      .filter(Boolean),
    (location) => location.toLowerCase(),
  );
  const technologies = extractTechnologies(job.title, description);
  const languageRequirements = dedupeBy(
    [
      /\benglish\b/i.test(description) ? "English" : undefined,
      /\bfinnish\b|\bsuomi\b/i.test(description) ? "Finnish" : undefined,
      /\bswedish\b/i.test(description) ? "Swedish" : undefined,
    ].filter((value): value is string => Boolean(value)),
    (value) => value.toLowerCase(),
  );
  const workModes = detectWorkModes(description, locations);
  const seniority = detectSeniority(job.title, description);
  const department = job.departments?.map((item) => item.name).filter(Boolean).join(" / ") || undefined;
  const employmentTypes = dedupeBy(
    [
      /intern/i.test(job.title) || /internship/i.test(department ?? "") ? "Internship" : undefined,
      /full[- ]time/i.test(description) ? "Full-time" : undefined,
      /part[- ]time/i.test(description) ? "Part-time" : undefined,
      /contract/i.test(description) ? "Contract" : undefined,
    ].filter((value): value is string => Boolean(value)),
    (value) => value.toLowerCase(),
  );
  const finnishRequirement = classifyFinnishRequirement(description, languageRequirements);

  return {
    id: `${source.id}-${job.id}`,
    title: compactText(job.title),
    company,
    companySlug: slugify(company),
    location: formatPrimaryLocation(locations),
    locations,
    normalizedLocation: normalizeLocation(locations[0] ?? "Unspecified"),
    url: job.absolute_url,
    applyUrl: job.absolute_url,
    sourceId: source.id,
    sourceName: source.name,
    department,
    tags: buildJobTags({
      department,
      seniority,
      technologies,
      finnishRequirement,
      workModes,
    }),
    technologies,
    languageRequirements,
    finnishRequirement,
    workModes,
    employmentTypes,
    seniority,
    yearsExperience: detectExperienceRange(description),
    requirementSignals,
    postedAt: job.updated_at,
    deadlineAt: undefined,
    postedLabel: undefined,
    remote: workModes.some((mode) => mode === "remote" || mode === "hybrid"),
    confidence: 0.98,
    sourceQuality: "api",
    description,
    summary:
      pickFirstSentence(description, 180) || `Structured opening extracted from ${source.name}.`,
  };
}

async function scrapeGreenhouse(source: SourceConfig): Promise<ScrapeSourceResult> {
  const boardToken = extractGreenhouseBoardToken(source.url);

  if (!boardToken) {
    throw new Error("Greenhouse board token not found.");
  }

  const response = await fetchJson<GreenhouseJobsResponse>(
    `https://boards-api.greenhouse.io/v1/boards/${boardToken}/jobs?content=true`,
    {
      headers: { accept: "application/json" },
    },
  );
  const jobs = (response.jobs ?? []).map((job) => buildGreenhouseJob(source, job));

  return {
    jobs,
    companies: [],
    notes: [
      `Using the Greenhouse board API with full job content for ${jobs.length} structured openings.`,
    ],
    totalAvailableJobs: jobs.length,
  };
}

export function extractJobsFromHtml(html: string, source: SourceConfig): JobListing[] {
  const $ = load(html);
  const jobs: JobListing[] = [];

  $(
    'a[href*="job"], a[href*="career"], a[href*="position"], a[href*="vacanc"], a[href*="openings"], a[href*="greenhouse"], a[href*="lever"]',
  ).each((_, element) => {
    const title = compactText($(element).text());
    const href = resolveUrl(source.url, $(element).attr("href") ?? "");

    if (!title || title.length < 8 || title.length > 120 || NAVIGATION_BLOCKLIST.has(title.toLowerCase())) {
      return;
    }

    const container = $(element).closest("article, li, div, section, tr");
    const context = compactText(container.text());

    if (scoreGenericJob(title, href, context) < 4) {
      return;
    }

    jobs.push(buildGenericJob(title, href, context, source));
  });

  return dedupeBy(jobs, (job) => job.url).slice(0, 40);
}

export function extractCompaniesFromHtml(
  html: string,
  source: SourceConfig,
): CompanyProfile[] {
  const $ = load(html);
  const companies: CompanyProfile[] = [];

  $("a[href]").each((_, element) => {
    const name = compactText($(element).text());
    const href = resolveUrl(source.url, $(element).attr("href") ?? "");

    if (!name || name.length < 2 || name.length > 64) {
      return;
    }

    if (JOB_TEXT_HINT.test(name) || NAVIGATION_BLOCKLIST.has(name.toLowerCase())) {
      return;
    }

    const container = $(element).closest("article, li, div, section, tr");
    const context = compactText(container.text());

    if (scoreCompany(name, href, context) < 2) {
      return;
    }

    const location = normalizeLocation(context);

    companies.push({
      id: `${source.id}-${slugify(name)}`,
      slug: slugify(name),
      name,
      location,
      normalizedLocation: location,
      url: href,
      jobsUrl: `https://www.google.com/search?q=${encodeURIComponent(`${name} careers`)}`,
      sourceId: source.id,
      sourceName: source.name,
      sectors: inferSectors(context),
      summary: summarizeContext(context.replace(name, ""), `Discovered in ${source.name}.`),
      whyNow:
        "Use this company as a research starting point, then verify current openings and team context before outreach.",
      outreachHook:
        "Reference a concrete market reason for reaching out instead of sending a generic networking note.",
      contactPrompt:
        "Ask what the team is trying to learn or build next, not just whether they are hiring.",
      confidence: Number(Math.min(0.93, 0.34 + scoreCompany(name, href, context) * 0.12).toFixed(2)),
      coordinates: coordinatesForLocation(location),
    });
  });

  return dedupeBy(companies, (company) => company.slug).slice(0, 30);
}

async function scrapeGenericSource(source: SourceConfig): Promise<ScrapeSourceResult> {
  const html = await fetchHtml(source.url);
  const jobs = source.kind !== "company-directory" ? extractJobsFromHtml(html, source) : [];
  const companies = source.kind !== "jobs" ? extractCompaniesFromHtml(html, source) : [];

  return {
    jobs,
    companies,
    notes:
      jobs.length || companies.length
        ? [
            "Falling back to a conservative HTML parser because no source-specific adapter exists yet.",
          ]
        : ["The generic HTML parser did not find stable structured cards on this source."],
    totalAvailableJobs: jobs.length,
    totalAvailableCompanies: companies.length,
  };
}

export async function scrapeSource(source: SourceConfig): Promise<ScrapeSourceResult> {
  if (source.parserHint === "tyomarkkinatori" || /tyomarkkinatori\.fi/.test(source.url)) {
    return scrapeTyomarkkinatori(source);
  }

  if (source.parserHint === "ashby" || /ashbyhq\.com/.test(source.url)) {
    return scrapeAshby(source);
  }

  if (
    source.parserHint === "greenhouse" ||
    /job-boards\.greenhouse\.io/.test(source.url) ||
    /boards-api\.greenhouse\.io/.test(source.url)
  ) {
    return scrapeGreenhouse(source);
  }

  if (
    source.parserHint === "lever" ||
    /jobs(\.eu)?\.lever\.co/.test(source.url) ||
    /api(\.eu)?\.lever\.co\/v0\/postings/.test(source.url)
  ) {
    return scrapeLever(source);
  }

  if (
    source.parserHint === "smartrecruiters" ||
    /smartrecruiters/.test(source.url)
  ) {
    return scrapeSmartRecruiters(source);
  }

  return scrapeGenericSource(source);
}

export function mergeScrapeResultIntoSnapshot(
  source: SourceConfig,
  result: ScrapeSourceResult,
  refreshedAt: string,
): SourceSnapshot {
  return {
    source,
    status: result.jobs.length || result.companies.length ? "ok" : "partial",
    mode: "live",
    refreshedAt,
    jobsFound: result.jobs.length,
    companiesFound: result.companies.length,
    totalAvailableJobs: result.totalAvailableJobs,
    totalAvailableCompanies: result.totalAvailableCompanies,
    notes: result.notes,
    jobs: result.jobs,
    companies: result.companies,
  };
}
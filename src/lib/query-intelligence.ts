import type {
  AnalyticsBucket,
  JobListing,
  LanguageRequirement,
  SeniorityLevel,
  WorkMode,
} from "./types";
import { takeTopBuckets } from "./utils";

type QueryTechnologyMatch = {
  label: string;
  index: number;
};

export type QueryLens = {
  raw: string;
  normalized: string;
  keywords: string[];
  technologies: string[];
  companies: string[];
  locations: string[];
  seniority: SeniorityLevel[];
  workModes: WorkMode[];
  finnishRequirement?: LanguageRequirement;
  minimumYearsExperience?: number;
  comparisonPair?: [string, string];
  interpreted: boolean;
};

export type TechnologyComparisonSlice = {
  label: string;
  totalJobs: number;
  topCompanies: AnalyticsBucket[];
  seniority: AnalyticsBucket[];
  finnishRequirement: AnalyticsBucket[];
  experienceAverage?: number;
  knownExperienceCount: number;
  sampleJobs: JobListing[];
};

export type TechnologyComparison = {
  left: TechnologyComparisonSlice;
  right: TechnologyComparisonSlice;
};

const TECHNOLOGY_ALIASES: Record<string, RegExp[]> = {
  AWS: [/\baws\b/i, /amazon web services/i],
  Azure: [/\bazure\b/i, /microsoft azure/i],
  GCP: [/\bgcp\b/i, /google cloud/i],
  Kubernetes: [/\bkubernetes\b/i, /\bk8s\b/i],
  Docker: [/\bdocker\b/i],
  Terraform: [/\bterraform\b/i],
  Python: [/\bpython\b/i],
  TypeScript: [/\btypescript\b/i, /\bts\b/i],
  JavaScript: [/\bjavascript\b/i],
  React: [/\breact\b/i],
  "Next.js": [/\bnext\.js\b/i, /\bnextjs\b/i],
  "Node.js": [/\bnode(?:\.js)?\b/i],
  SQL: [/\bsql\b/i, /postgres/i, /mysql/i],
  Databricks: [/\bdatabricks\b/i],
  Snowflake: [/\bsnowflake\b/i],
  Kafka: [/\bkafka\b/i],
  Spark: [/\bspark\b/i, /pyspark/i],
};

const STOPWORDS = new Set([
  "a",
  "all",
  "and",
  "are",
  "around",
  "at",
  "compare",
  "for",
  "in",
  "jobs",
  "market",
  "me",
  "of",
  "openings",
  "roles",
  "show",
  "the",
  "to",
  "versus",
  "vs",
  "with",
]);

const SENIORITY_PATTERNS: Array<{ level: SeniorityLevel; regex: RegExp }> = [
  { level: "intern", regex: /intern|internship|trainee|graduate/i },
  { level: "junior", regex: /junior|entry level|associate/i },
  { level: "senior", regex: /senior|\bsr\b/i },
  { level: "lead", regex: /lead|principal|staff/i },
  { level: "manager", regex: /manager/i },
  { level: "director", regex: /director/i },
  { level: "executive", regex: /vp|vice president|chief|head of/i },
];

const WORK_MODE_PATTERNS: Array<{ mode: WorkMode; regex: RegExp }> = [
  { mode: "remote", regex: /remote/i },
  { mode: "hybrid", regex: /hybrid/i },
  { mode: "onsite", regex: /onsite|on-site|on site/i },
];

function normalizeToken(value: string): string {
  return value.trim().toLowerCase();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function getTechnologyCandidates(jobs: JobListing[]): string[] {
  const fromJobs = jobs.flatMap((job) => job.technologies);
  return uniqueSorted([...Object.keys(TECHNOLOGY_ALIASES), ...fromJobs]);
}

function detectTechnologies(query: string, jobs: JobListing[]): string[] {
  const matches: QueryTechnologyMatch[] = [];

  for (const label of getTechnologyCandidates(jobs)) {
    const aliasPatterns = TECHNOLOGY_ALIASES[label] ?? [new RegExp(`\\b${escapeRegExp(label)}\\b`, "i")];

    for (const pattern of aliasPatterns) {
      const match = query.match(pattern);

      if (!match || typeof match.index !== "number") {
        continue;
      }

      matches.push({ label, index: match.index });
      break;
    }
  }

  return matches
    .sort((left, right) => left.index - right.index)
    .map((match) => match.label)
    .filter((label, index, list) => list.indexOf(label) === index);
}

function detectCompanies(query: string, jobs: JobListing[]): string[] {
  const companies = uniqueSorted(jobs.map((job) => job.company));
  return companies.filter((company) => query.includes(company.toLowerCase()));
}

function detectLocations(query: string, jobs: JobListing[]): string[] {
  const locations = uniqueSorted(
    jobs.flatMap((job) => [job.normalizedLocation, ...job.locations]).filter(Boolean),
  ).filter((location) => location !== "Unspecified");

  return locations.filter((location) => query.includes(location.toLowerCase()));
}

function detectSeniority(query: string): SeniorityLevel[] {
  return SENIORITY_PATTERNS.filter((item) => item.regex.test(query)).map((item) => item.level);
}

function detectWorkModes(query: string): WorkMode[] {
  return WORK_MODE_PATTERNS.filter((item) => item.regex.test(query)).map((item) => item.mode);
}

function detectFinnishRequirement(query: string): LanguageRequirement | undefined {
  if (/english[- ]only|english[- ]friendly|english[- ]speaking/i.test(query)) {
    return "english-friendly";
  }

  if (/finnish required|requires finnish|finnish[- ]speaking|suomi required/i.test(query)) {
    return "required";
  }

  if (/finnish preferred|finnish bonus|finnish plus|suomi bonus/i.test(query)) {
    return "preferred";
  }

  return undefined;
}

function detectMinimumYearsExperience(query: string): number | undefined {
  const match = query.match(/(\d+)\+?\s*(?:years?|yrs?)/i);
  return match?.[1] ? Number.parseInt(match[1], 10) : undefined;
}

function detectKeywords(
  query: string,
  technologies: string[],
  companies: string[],
  locations: string[],
): string[] {
  const ignored = new Set<string>([
    ...technologies.flatMap((value) => normalizeToken(value).split(/\s+/)),
    ...companies.flatMap((value) => normalizeToken(value).split(/\s+/)),
    ...locations.flatMap((value) => normalizeToken(value).split(/\s+/)),
  ]);

  return query
    .split(/[^a-z0-9+#.]+/i)
    .map((token) => normalizeToken(token))
    .filter((token) => token.length > 2)
    .filter((token) => !STOPWORDS.has(token))
    .filter((token) => !ignored.has(token))
    .filter((token, index, list) => list.indexOf(token) === index);
}

export function parseQueryLens(query: string, jobs: JobListing[]): QueryLens {
  const normalized = query.trim().toLowerCase();

  if (!normalized) {
    return {
      raw: query,
      normalized,
      keywords: [],
      technologies: [],
      companies: [],
      locations: [],
      seniority: [],
      workModes: [],
      interpreted: false,
    };
  }

  const technologies = detectTechnologies(normalized, jobs);
  const companies = detectCompanies(normalized, jobs);
  const locations = detectLocations(normalized, jobs);
  const seniority = detectSeniority(normalized);
  const workModes = detectWorkModes(normalized);
  const finnishRequirement = detectFinnishRequirement(normalized);
  const minimumYearsExperience = detectMinimumYearsExperience(normalized);
  const keywords = detectKeywords(normalized, technologies, companies, locations);
  const comparisonPair =
    technologies.length >= 2 && /(compare|versus|vs|against)/i.test(normalized)
      ? ([technologies[0], technologies[1]] as [string, string])
      : undefined;

  return {
    raw: query,
    normalized,
    keywords,
    technologies,
    companies,
    locations,
    seniority,
    workModes,
    finnishRequirement,
    minimumYearsExperience,
    comparisonPair,
    interpreted:
      Boolean(technologies.length) ||
      Boolean(companies.length) ||
      Boolean(locations.length) ||
      Boolean(seniority.length) ||
      Boolean(workModes.length) ||
      Boolean(finnishRequirement) ||
      Boolean(minimumYearsExperience) ||
      Boolean(keywords.length),
  };
}

export function filterJobsByLens(jobs: JobListing[], lens: QueryLens): JobListing[] {
  if (!lens.normalized) {
    return jobs;
  }

  return jobs.filter((job) => {
    const haystack = [
      job.title,
      job.company,
      job.location,
      job.summary,
      job.department,
      job.sourceName,
      job.seniority,
      job.finnishRequirement,
      ...job.tags,
      ...job.technologies,
      ...job.languageRequirements,
      ...job.workModes,
      ...job.locations,
      ...job.requirementSignals,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    const technologyMatch = lens.technologies.length
      ? lens.comparisonPair
        ? lens.technologies.some((technology) => job.technologies.includes(technology))
        : lens.technologies.every((technology) => job.technologies.includes(technology))
      : true;
    const companyMatch = lens.companies.length
      ? lens.companies.some((company) => job.company === company)
      : true;
    const locationMatch = lens.locations.length
      ? lens.locations.some(
          (location) =>
            job.normalizedLocation === location ||
            job.locations.some((jobLocation) => jobLocation === location),
        )
      : true;
    const seniorityMatch = lens.seniority.length
      ? lens.seniority.includes(job.seniority)
      : true;
    const workModeMatch = lens.workModes.length
      ? lens.workModes.some((mode) => job.workModes.includes(mode))
      : true;
    const finnishMatch = lens.finnishRequirement
      ? job.finnishRequirement === lens.finnishRequirement
      : true;
    const yearsMatch = lens.minimumYearsExperience
      ? (job.yearsExperience?.min ?? job.yearsExperience?.max ?? 0) >=
        lens.minimumYearsExperience
      : true;
    const keywordMatch = lens.keywords.length
      ? lens.keywords.every((keyword) => haystack.includes(keyword))
      : lens.interpreted
        ? true
        : haystack.includes(lens.normalized);

    return (
      technologyMatch &&
      companyMatch &&
      locationMatch &&
      seniorityMatch &&
      workModeMatch &&
      finnishMatch &&
      yearsMatch &&
      keywordMatch
    );
  });
}

function buildSlice(label: string, jobs: JobListing[]): TechnologyComparisonSlice {
  const companyCounts = new Map<string, number>();
  const seniorityCounts = new Map<string, number>();
  const finnishCounts = new Map<string, number>();

  for (const job of jobs) {
    companyCounts.set(job.company, (companyCounts.get(job.company) ?? 0) + 1);
    seniorityCounts.set(job.seniority, (seniorityCounts.get(job.seniority) ?? 0) + 1);
    finnishCounts.set(
      job.finnishRequirement,
      (finnishCounts.get(job.finnishRequirement) ?? 0) + 1,
    );
  }

  const knownExperience = jobs
    .map((job) => job.yearsExperience?.min)
    .filter((value): value is number => typeof value === "number");

  return {
    label,
    totalJobs: jobs.length,
    topCompanies: takeTopBuckets(companyCounts, 4),
    seniority: takeTopBuckets(seniorityCounts, 4),
    finnishRequirement: takeTopBuckets(finnishCounts, 4),
    experienceAverage: knownExperience.length
      ? Math.round(
          (knownExperience.reduce((sum, value) => sum + value, 0) / knownExperience.length) *
            10,
        ) / 10
      : undefined,
    knownExperienceCount: knownExperience.length,
    sampleJobs: jobs.slice(0, 3),
  };
}

export function buildTechnologyComparison(
  jobs: JobListing[],
  pair?: [string, string],
): TechnologyComparison | null {
  if (!pair) {
    return null;
  }

  const [leftLabel, rightLabel] = pair;
  const leftJobs = jobs.filter((job) => job.technologies.includes(leftLabel));
  const rightJobs = jobs.filter((job) => job.technologies.includes(rightLabel));

  if (!leftJobs.length && !rightJobs.length) {
    return null;
  }

  return {
    left: buildSlice(leftLabel, leftJobs),
    right: buildSlice(rightLabel, rightJobs),
  };
}
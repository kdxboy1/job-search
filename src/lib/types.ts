import { z } from "zod";

export type SourceKind = "jobs" | "company-directory" | "mixed";

export type ParserHint =
  | "generic-jobs"
  | "generic-companies"
  | "generic-mixed"
  | "ashby"
  | "greenhouse"
  | "lever"
  | "smartrecruiters"
  | "tyomarkkinatori"
  | "dealroom";

export type SnapshotStatus = "ok" | "partial" | "error";

export type RefreshMode = "live" | "fallback";

export type SeniorityLevel =
  | "intern"
  | "junior"
  | "mid"
  | "senior"
  | "lead"
  | "manager"
  | "director"
  | "executive"
  | "unknown";

export type LanguageRequirement =
  | "required"
  | "preferred"
  | "helpful"
  | "english-friendly"
  | "not-mentioned";

export type WorkMode = "onsite" | "hybrid" | "remote" | "unspecified";

export type SourceQuality = "api" | "html" | "fallback";

export type WorkspaceMode = "pro" | "simple";

export type CountryCode =
  | "GLOBAL"
  | "FI"
  | "FR"
  | "DE"
  | "NL"
  | "BE"
  | "PL"
  | "UK"
  | "US"
  | "SE"
  | "NO";

export type CuratedSourceCategory =
  | "national-portal"
  | "private-board"
  | "company-network"
  | "ats-platform";

export type IntegrationReadiness = "supported" | "candidate" | "restricted" | "closed";

export type IntegrationStrategy =
  | "official-api"
  | "public-search"
  | "ats-api"
  | "html-fallback"
  | "privacy-gated"
  | "login-gated"
  | "anti-bot"
  | "closed";

export type CompanyNoteStatus = "prospect" | "contacted" | "responded" | "paused";

export type PersistenceDriver = "neon" | "file";

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface ExperienceRange {
  min?: number;
  max?: number;
  raw?: string;
}

export interface SourceConfig {
  id: string;
  name: string;
  url: string;
  kind: SourceKind;
  parserHint?: ParserHint;
  description: string;
  tags: string[];
}

export interface CuratedSourceDescriptor extends SourceConfig {
  country: CountryCode;
  category: CuratedSourceCategory;
  prominence: string;
  readiness: IntegrationReadiness;
  strategy: IntegrationStrategy;
  notes: string;
}

export interface CountrySourceCatalog {
  country: CountryCode;
  countryName: string;
  overview: string;
  primarySignal: string;
  sources: CuratedSourceDescriptor[];
}

export interface JobListing {
  id: string;
  title: string;
  company: string;
  companySlug: string;
  location: string;
  locations: string[];
  normalizedLocation: string;
  url: string;
  applyUrl?: string;
  sourceId: string;
  sourceName: string;
  department?: string;
  tags: string[];
  technologies: string[];
  languageRequirements: string[];
  finnishRequirement: LanguageRequirement;
  workModes: WorkMode[];
  employmentTypes: string[];
  seniority: SeniorityLevel;
  yearsExperience?: ExperienceRange;
  requirementSignals: string[];
  postedAt?: string;
  deadlineAt?: string;
  postedLabel?: string;
  remote: boolean;
  confidence: number;
  sourceQuality: SourceQuality;
  description?: string;
  summary: string;
}

export interface CompanyProfile {
  id: string;
  slug: string;
  name: string;
  location: string;
  normalizedLocation: string;
  url: string;
  jobsUrl: string;
  sourceId: string;
  sourceName: string;
  sectors: string[];
  summary: string;
  whyNow: string;
  outreachHook: string;
  contactPrompt: string;
  confidence: number;
  coordinates?: Coordinates;
}

export interface SourceSnapshot {
  source: SourceConfig;
  status: SnapshotStatus;
  mode: RefreshMode;
  refreshedAt: string;
  jobsFound: number;
  companiesFound: number;
  totalAvailableJobs?: number;
  totalAvailableCompanies?: number;
  notes: string[];
  jobs: JobListing[];
  companies: CompanyProfile[];
}

export interface AnalyticsBucket {
  label: string;
  value: number;
}

export interface PlatformAnalytics {
  totalJobs: number;
  sampledJobs: number;
  totalCompanies: number;
  sampledCompanies: number;
  liveSources: number;
  fallbackSources: number;
  remoteFriendlyJobs: number;
  bySource: AnalyticsBucket[];
  byLocation: AnalyticsBucket[];
  bySector: AnalyticsBucket[];
  byTechnology: AnalyticsBucket[];
  bySeniority: AnalyticsBucket[];
  byFinnishRequirement: AnalyticsBucket[];
  byDepartment: AnalyticsBucket[];
  byCompany: AnalyticsBucket[];
}

export interface PlatformIntelligence {
  generatedAt: string;
  sources: SourceConfig[];
  snapshots: SourceSnapshot[];
  jobs: JobListing[];
  companies: CompanyProfile[];
  analytics: PlatformAnalytics;
  brief: string[];
}

export interface SavedSearchRecord {
  id: string;
  query: string;
  label: string;
  createdAt: string;
  lastUsedAt: string;
  countryCodes: CountryCode[];
  mode: WorkspaceMode;
}

export interface CompanyNoteRecord {
  id: string;
  companyId?: string;
  companySlug: string;
  companyName: string;
  status: CompanyNoteStatus;
  body: string;
  nextAction?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface SnapshotHistoryRecord {
  id: string;
  createdAt: string;
  totalJobs: number;
  sampledJobs: number;
  totalCompanies: number;
  liveSources: number;
  fallbackSources: number;
  topTechnology?: string;
  topLocation?: string;
  summary: string;
}

export interface WorkspacePreferences {
  mode: WorkspaceMode;
  pinnedCountries: CountryCode[];
}

export interface WorkspaceState {
  customSources: SourceConfig[];
  savedSearches: SavedSearchRecord[];
  companyNotes: CompanyNoteRecord[];
  snapshotHistory: SnapshotHistoryRecord[];
  preferences: WorkspacePreferences;
}

export interface WorkspaceEnvelope {
  state: WorkspaceState;
  driver: PersistenceDriver;
  canUseDatabase: boolean;
}

export interface ResearchMetric {
  label: string;
  value: string;
  detail: string;
}

export interface ResearchReport {
  slug: string;
  title: string;
  category: string;
  summary: string;
  publishedAt: string;
  readingTime: string;
  highlights: string[];
}

export interface ResearchPerspective {
  title: string;
  audience: string;
  summary: string;
}

export interface ResearchPlatformCard {
  title: string;
  summary: string;
  emphasis: string;
}

export interface OutreachPlan {
  companyId: string;
  companyName: string;
  opening: string;
  valueAngles: string[];
  sequence: string[];
  cautions: string[];
}

export interface GroundedJobReference {
  id: string;
  title: string;
  company: string;
  location: string;
  url: string;
  sourceName: string;
  seniority?: SeniorityLevel;
  technologies?: string[];
  finnishRequirement?: LanguageRequirement;
}

export interface GroundedCompanyReference {
  id: string;
  name: string;
  location: string;
  url: string;
  jobsUrl: string;
  sourceName: string;
}

export interface GroundedAnswer {
  answer: string;
  supportingJobs: GroundedJobReference[];
  supportingCompanies: GroundedCompanyReference[];
  generatedWith: string;
}

export const SourceKindSchema = z.enum(["jobs", "company-directory", "mixed"]);

export const ParserHintSchema = z
  .enum([
    "generic-jobs",
    "generic-companies",
    "generic-mixed",
    "ashby",
    "greenhouse",
    "lever",
    "smartrecruiters",
    "tyomarkkinatori",
    "dealroom",
  ])
  .optional();

export const WorkspaceModeSchema = z.enum(["pro", "simple"]);

export const CountryCodeSchema = z.enum([
  "GLOBAL",
  "FI",
  "FR",
  "DE",
  "NL",
  "BE",
  "PL",
  "UK",
  "US",
  "SE",
  "NO",
]);

export const SourceConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  url: z.string().url(),
  kind: SourceKindSchema,
  parserHint: ParserHintSchema,
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export function hydrateSourceConfig(
  value: z.infer<typeof SourceConfigSchema>,
): SourceConfig {
  return {
    ...value,
    description: value.description ?? "",
    tags: value.tags ?? [],
  };
}
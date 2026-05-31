import { z } from "zod";

export type SourceKind = "jobs" | "company-directory" | "mixed";

export type ParserHint =
  | "generic-jobs"
  | "generic-companies"
  | "generic-mixed"
  | "tyomarkkinatori"
  | "dealroom";

export type SnapshotStatus = "ok" | "partial" | "error";

export type RefreshMode = "live" | "fallback";

export interface Coordinates {
  lat: number;
  lng: number;
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

export interface JobListing {
  id: string;
  title: string;
  company: string;
  location: string;
  normalizedLocation: string;
  url: string;
  sourceId: string;
  sourceName: string;
  tags: string[];
  postedLabel?: string;
  remote: boolean;
  confidence: number;
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
  totalCompanies: number;
  liveSources: number;
  fallbackSources: number;
  remoteFriendlyJobs: number;
  bySource: AnalyticsBucket[];
  byLocation: AnalyticsBucket[];
  bySector: AnalyticsBucket[];
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
    "tyomarkkinatori",
    "dealroom",
  ])
  .optional();

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
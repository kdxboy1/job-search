import { describe, expect, it } from "vitest";

import { buildAnalytics, buildOutreachPlan } from "./platform";
import type {
  CompanyProfile,
  JobListing,
  PlatformIntelligence,
  SourceConfig,
  SourceSnapshot,
} from "./types";

const source: SourceConfig = {
  id: "smartly-careers",
  name: "Smartly Careers",
  url: "https://job-boards.greenhouse.io/smartlyio",
  kind: "jobs",
  parserHint: "greenhouse",
  description: "Direct company board.",
  tags: ["company-board"],
};

const job: JobListing = {
  id: "job-1",
  title: "Senior Data Engineer",
  company: "Smartly",
  companySlug: "smartly",
  location: "Helsinki",
  locations: ["Helsinki"],
  normalizedLocation: "Helsinki",
  url: "https://example.com/jobs/1",
  applyUrl: "https://example.com/jobs/1/apply",
  sourceId: source.id,
  sourceName: source.name,
  department: "Data",
  tags: ["engineering", "remote-friendly"],
  technologies: ["AWS", "Python"],
  languageRequirements: ["English"],
  finnishRequirement: "english-friendly",
  workModes: ["hybrid"],
  employmentTypes: ["Full-time"],
  seniority: "senior",
  yearsExperience: { min: 5, raw: "5+ years" },
  requirementSignals: ["5+ years building data platforms"],
  postedAt: new Date().toISOString(),
  deadlineAt: new Date().toISOString(),
  postedLabel: "today",
  remote: true,
  confidence: 0.82,
  sourceQuality: "api",
  description: "5+ years building data platforms on AWS.",
  summary: "Parsed from the careers board.",
};

const company: CompanyProfile = {
  id: "company-1",
  slug: "smartly",
  name: "Smartly",
  location: "Helsinki",
  normalizedLocation: "Helsinki",
  url: "https://smartly.io",
  jobsUrl: "https://job-boards.greenhouse.io/smartlyio",
  sourceId: "dealroom-finland",
  sourceName: "Dealroom Finland",
  sectors: ["Marketing tech", "Enterprise software"],
  summary: "Creative automation and advertising technology company.",
  whyNow: "Useful if you want a company with visible product and growth mechanics.",
  outreachHook: "Talk about measurable customer impact and campaign performance.",
  contactPrompt: "Ask how customer insight changes product priorities.",
  confidence: 0.71,
  coordinates: { lat: 60.1699, lng: 24.9384 },
};

const snapshot: SourceSnapshot = {
  source,
  status: "ok",
  mode: "live",
  refreshedAt: new Date().toISOString(),
  jobsFound: 1,
  companiesFound: 1,
  totalAvailableJobs: 90,
  totalAvailableCompanies: 1,
  notes: [],
  jobs: [job],
  companies: [company],
};

describe("buildAnalytics", () => {
  it("summarizes jobs, companies, and source density", () => {
    const analytics = buildAnalytics([snapshot], [job], [company]);

    expect(analytics.totalJobs).toBe(90);
    expect(analytics.sampledJobs).toBe(1);
    expect(analytics.totalCompanies).toBe(1);
    expect(analytics.liveSources).toBe(1);
    expect(analytics.remoteFriendlyJobs).toBe(1);
    expect(analytics.byLocation[0]?.label).toBe("Helsinki");
    expect(analytics.byTechnology[0]?.label).toBe("AWS");
    expect(analytics.bySeniority[0]?.label).toBe("senior");
  });
});

describe("buildOutreachPlan", () => {
  it("produces a company-specific outreach sequence", () => {
    const intelligence: PlatformIntelligence = {
      generatedAt: new Date().toISOString(),
      sources: [source],
      snapshots: [snapshot],
      jobs: [job],
      companies: [company],
      analytics: buildAnalytics([snapshot], [job], [company]),
      brief: [],
    };

    const plan = buildOutreachPlan(company, intelligence);

    expect(plan.companyName).toBe("Smartly");
    expect(plan.opening).toContain("Smartly");
    expect(plan.valueAngles[1]).toContain("Senior Data Engineer");
    expect(plan.sequence).toHaveLength(3);
  });
});
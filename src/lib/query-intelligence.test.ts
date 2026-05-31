import { describe, expect, it } from "vitest";

import {
  buildTechnologyComparison,
  filterJobsByLens,
  parseQueryLens,
} from "./query-intelligence";
import type { JobListing } from "./types";

const jobs: JobListing[] = [
  {
    id: "aws-1",
    title: "Senior Data Engineer",
    company: "Northstar",
    companySlug: "northstar",
    location: "Helsinki",
    locations: ["Helsinki"],
    normalizedLocation: "Helsinki",
    url: "https://example.com/aws-1",
    applyUrl: "https://example.com/aws-1/apply",
    sourceId: "smartly-careers",
    sourceName: "Smartly Careers",
    department: "Data",
    tags: ["senior", "aws"],
    technologies: ["AWS", "Python"],
    languageRequirements: ["English"],
    finnishRequirement: "english-friendly",
    workModes: ["hybrid"],
    employmentTypes: ["Full-time"],
    seniority: "senior",
    yearsExperience: { min: 5, raw: "5+ years" },
    requirementSignals: ["5+ years of platform engineering experience"],
    postedAt: "2026-05-31T10:00:00Z",
    deadlineAt: undefined,
    postedLabel: "today",
    remote: true,
    confidence: 0.98,
    sourceQuality: "api",
    description: "AWS data engineering role in Helsinki.",
    summary: "AWS-focused senior data role.",
  },
  {
    id: "azure-1",
    title: "Senior Cloud Engineer",
    company: "Polar Stack",
    companySlug: "polar-stack",
    location: "Helsinki",
    locations: ["Helsinki"],
    normalizedLocation: "Helsinki",
    url: "https://example.com/azure-1",
    applyUrl: "https://example.com/azure-1/apply",
    sourceId: "smartly-careers",
    sourceName: "Smartly Careers",
    department: "Platform",
    tags: ["senior", "azure"],
    technologies: ["Azure", "Terraform"],
    languageRequirements: ["English", "Finnish"],
    finnishRequirement: "required",
    workModes: ["hybrid"],
    employmentTypes: ["Full-time"],
    seniority: "senior",
    yearsExperience: { min: 4, raw: "4+ years" },
    requirementSignals: ["4+ years with Azure infrastructure"],
    postedAt: "2026-05-30T10:00:00Z",
    deadlineAt: undefined,
    postedLabel: "yesterday",
    remote: true,
    confidence: 0.97,
    sourceQuality: "api",
    description: "Azure cloud engineering role in Helsinki with Finnish required.",
    summary: "Azure-focused senior cloud role.",
  },
  {
    id: "gcp-1",
    title: "Data Analyst",
    company: "Westwave",
    companySlug: "westwave",
    location: "Tampere",
    locations: ["Tampere"],
    normalizedLocation: "Tampere",
    url: "https://example.com/gcp-1",
    applyUrl: "https://example.com/gcp-1/apply",
    sourceId: "smartly-careers",
    sourceName: "Smartly Careers",
    department: "Analytics",
    tags: ["data", "gcp"],
    technologies: ["GCP", "SQL"],
    languageRequirements: ["English"],
    finnishRequirement: "english-friendly",
    workModes: ["remote"],
    employmentTypes: ["Full-time"],
    seniority: "mid",
    yearsExperience: { min: 3, raw: "3+ years" },
    requirementSignals: ["3+ years of analytics experience"],
    postedAt: "2026-05-28T10:00:00Z",
    deadlineAt: undefined,
    postedLabel: "3 days ago",
    remote: true,
    confidence: 0.95,
    sourceQuality: "api",
    description: "Remote analytics role in Tampere.",
    summary: "GCP analytics role.",
  },
];

describe("query intelligence", () => {
  it("parses structured comparison queries and filters jobs by the interpreted lens", () => {
    const lens = parseQueryLens("Compare AWS vs Azure in Helsinki", jobs);
    const filtered = filterJobsByLens(jobs, lens);

    expect(lens.technologies).toEqual(["AWS", "Azure"]);
    expect(lens.locations).toEqual(["Helsinki"]);
    expect(lens.comparisonPair).toEqual(["AWS", "Azure"]);
    expect(filtered.map((job) => job.id)).toEqual(["aws-1", "azure-1"]);
  });

  it("understands english-friendly senior filters and builds comparison slices", () => {
    const lens = parseQueryLens("senior english-friendly roles", jobs);
    const filtered = filterJobsByLens(jobs, lens);
    const comparison = buildTechnologyComparison(jobs, ["AWS", "Azure"]);

    expect(lens.seniority).toEqual(["senior"]);
    expect(lens.finnishRequirement).toBe("english-friendly");
    expect(filtered.map((job) => job.id)).toEqual(["aws-1"]);
    expect(comparison?.left.totalJobs).toBe(1);
    expect(comparison?.right.totalJobs).toBe(1);
    expect(comparison?.right.finnishRequirement[0]?.label).toBe("required");
  });
});
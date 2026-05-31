import { coordinatesForLocation } from "./location";
import { slugify } from "./utils";
import type { CompanyProfile, SourceConfig } from "./types";

export const defaultSources: SourceConfig[] = [
  {
    id: "tyomarkkinatori-finland",
    name: "Tyomarkkinatori Finland",
    url: "https://tyomarkkinatori.fi/en",
    kind: "jobs",
    parserHint: "tyomarkkinatori",
    description:
      "National market scan for Finnish job demand. Use it as a broad reality check before narrowing down outreach.",
    tags: ["public-market", "jobs", "finland"],
  },
  {
    id: "smartly-careers",
    name: "Smartly Careers",
    url: "https://job-boards.greenhouse.io/smartlyio",
    kind: "jobs",
    parserHint: "generic-jobs",
    description:
      "Direct company board that helps keep the pipeline grounded in first-party openings.",
    tags: ["company-board", "greenhouse", "helsinki"],
  },
  {
    id: "dealroom-finland",
    name: "Dealroom Finland",
    url: "https://finland.dealroom.co/companies/f/all_slug_locations/anyof_finland",
    kind: "company-directory",
    parserHint: "dealroom",
    description:
      "Company discovery radar for outreach, nearby firms, and market mapping across Finland.",
    tags: ["companies", "outreach", "finland"],
  },
];

const seededDealroomCompanies: Omit<
  CompanyProfile,
  | "id"
  | "slug"
  | "normalizedLocation"
  | "sourceId"
  | "sourceName"
  | "coordinates"
>[]= [
  {
    name: "Aiven",
    location: "Helsinki",
    url: "https://aiven.io",
    jobsUrl: "https://aiven.io/careers",
    sectors: ["Data infrastructure", "Developer tools"],
    summary:
      "Cloud data platform company with a strong developer audience and broad technical hiring surface.",
    whyNow:
      "Useful target when you want companies that understand technical storytelling and modern platform teams.",
    outreachHook:
      "Reference the intersection of platform reliability, data products, and developer velocity.",
    contactPrompt:
      "Ask how product, engineering, and go-to-market teams coordinate around developer adoption signals.",
    confidence: 0.58,
  },
  {
    name: "Oura",
    location: "Oulu",
    url: "https://ouraring.com",
    jobsUrl: "https://ouraring.com/careers",
    sectors: ["Health tech", "Consumer devices"],
    summary:
      "Consumer health company blending hardware, software, and data-driven product work.",
    whyNow:
      "Good option for cross-functional candidates who can speak to product insight and customer empathy.",
    outreachHook:
      "Lead with product judgment, experimentation, and how user insight turns into shipped improvements.",
    contactPrompt:
      "Ask which customer or behavior signals matter most when teams prioritize roadmap work.",
    confidence: 0.55,
  },
  {
    name: "ICEYE",
    location: "Espoo",
    url: "https://www.iceye.com",
    jobsUrl: "https://www.iceye.com/company/careers",
    sectors: ["Space tech", "Earth observation"],
    summary:
      "Satellite imaging company with deep technical depth and an applied analytics narrative.",
    whyNow:
      "Strong target when you want to position yourself around hard problems, execution rigor, and mission clarity.",
    outreachHook:
      "Tie your experience to operational data, systems thinking, and solving ambiguous technical constraints.",
    contactPrompt:
      "Ask how teams balance mission urgency with the practical realities of execution and prioritization.",
    confidence: 0.57,
  },
  {
    name: "RELEX Solutions",
    location: "Helsinki",
    url: "https://www.relexsolutions.com",
    jobsUrl: "https://www.relexsolutions.com/careers/",
    sectors: ["Supply chain", "Enterprise software"],
    summary:
      "Supply chain and retail optimization company with a broad operational software footprint.",
    whyNow:
      "Relevant if you want business-facing technology teams where measurable impact is easy to discuss.",
    outreachHook:
      "Anchor the conversation around complex customer problems, measurable outcomes, and systems adoption.",
    contactPrompt:
      "Ask which metrics most clearly show that a customer team is getting value from the platform.",
    confidence: 0.54,
  },
  {
    name: "Wolt",
    location: "Helsinki",
    url: "https://wolt.com",
    jobsUrl: "https://careers.wolt.com",
    sectors: ["Marketplace", "Operations tech"],
    summary:
      "Marketplace business with strong operational complexity, city density, and product execution depth.",
    whyNow:
      "Good target for candidates who want to connect product, operations, growth, and local market nuance.",
    outreachHook:
      "Lead with city-level execution, customer understanding, and the mechanics of scaling reliable systems.",
    contactPrompt:
      "Ask how local market feedback changes team priorities or affects how teams define success.",
    confidence: 0.56,
  },
];

export function fallbackCompaniesForSource(sourceId: string): CompanyProfile[] {
  if (sourceId !== "dealroom-finland") {
    return [];
  }

  return seededDealroomCompanies.map((company) => ({
    ...company,
    id: `${sourceId}-${slugify(company.name)}`,
    slug: slugify(company.name),
    normalizedLocation: company.location,
    sourceId,
    sourceName: "Dealroom Finland",
    coordinates: coordinatesForLocation(company.location),
  }));
}
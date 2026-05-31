import type {
  ResearchMetric,
  ResearchPerspective,
  ResearchPlatformCard,
  ResearchReport,
} from "./types";

export const researchMetrics: ResearchMetric[] = [
  {
    label: "Tracked country lenses",
    value: "10",
    detail: "Country-specific board research plus reusable ATS patterns.",
  },
  {
    label: "Structured labor signals",
    value: "12+",
    detail: "Technology, seniority, work mode, language, and experience factors.",
  },
  {
    label: "Monthly flagship output",
    value: "Radar",
    detail: "A research cadence built for employability and market positioning.",
  },
];

export const featuredReports: ResearchReport[] = [
  {
    slug: "future-skills-radar-finland",
    title: "Future Skills Radar: Finland's English-Friendly Tech Demand",
    category: "Monthly report",
    summary:
      "A labor-market read on where cloud, data, and AI demand is concentrating across Finnish employers and ATS boards.",
    publishedAt: "May 2026",
    readingTime: "7 min read",
    highlights: [
      "Cloud infrastructure and data roles remain the clearest cross-company demand signal.",
      "English-friendly hiring clusters most strongly around product, data, and platform teams.",
      "Official portals and ATS boards tell different stories; both are needed for a realistic view.",
    ],
  },
  {
    slug: "aws-vs-azure-europe",
    title: "AWS vs Azure Across Northern Europe",
    category: "Perspective",
    summary:
      "A comparison framework for understanding which companies, levels, and language expectations map to each cloud signal.",
    publishedAt: "May 2026",
    readingTime: "6 min read",
    highlights: [
      "Azure often shows up in enterprise and regulated contexts.",
      "AWS remains broad across startup, scale-up, and platform-heavy employers.",
      "Language requirement differences matter as much as technology labels when you assess fit.",
    ],
  },
  {
    slug: "public-portal-vs-ats",
    title: "Public Portal vs ATS: Where Market Intelligence Actually Comes From",
    category: "Methodology",
    summary:
      "Why official labor-market portals, private boards, and ATS families need different ingestion and confidence treatments.",
    publishedAt: "May 2026",
    readingTime: "5 min read",
    highlights: [
      "National portals give market breadth; ATS pages give detail depth.",
      "Cookie and login gates should be modelled as source constraints, not ignored.",
      "Grounded dashboards need confidence labels and transparent fallback handling.",
    ],
  },
];

export const researchPerspectives: ResearchPerspective[] = [
  {
    title: "Employability research",
    audience: "Job seekers and career strategists",
    summary:
      "Translate live labor signals into concrete positioning choices: where to apply, what to emphasize, and when to reach out.",
  },
  {
    title: "Market structure research",
    audience: "Operators, investors, and policy teams",
    summary:
      "Understand how country portals, ATS adoption, and employer behavior shape the real observable job market.",
  },
  {
    title: "Company intelligence",
    audience: "Business development and recruiting teams",
    summary:
      "Use role mix, location clusters, and language requirements to map which companies are expanding and how they hire.",
  },
];

export const researchPlatforms: ResearchPlatformCard[] = [
  {
    title: "Monthly Labor Market Report",
    summary:
      "A recurring market note with country comparisons, technology demand, and practical job-search implications.",
    emphasis: "Flagship narrative output",
  },
  {
    title: "Future Skills Radar",
    summary:
      "A forward-looking dataset focused on technologies, seniority mix, and language expectations by market and employer type.",
    emphasis: "Signal product",
  },
  {
    title: "Data Platform Access",
    summary:
      "A professional workspace for dense analysis, search persistence, CRM notes, and AI-guided market exploration.",
    emphasis: "Research infrastructure",
  },
  {
    title: "Methodology & Partners",
    summary:
      "Documentation on source treatment, adapter confidence, public portal constraints, and partner integrations.",
    emphasis: "Trust layer",
  },
];
import type { ParserHint, SourceKind } from "./types";

export type SetupStep = {
  title: string;
  detail: string;
};

export type ProductionConnection = {
  id: "auth-secret" | "google-oauth" | "github-oauth" | "database" | "openai";
  label: string;
  envVars: string[];
  summary: string;
  required: boolean;
};

export type SourceQuickstartExample = {
  label: string;
  name: string;
  url: string;
  kind: SourceKind;
  parserHint: ParserHint;
  summary: string;
};

export const beginnerSetupSteps: SetupStep[] = [
  {
    title: "Copy the env template",
    detail:
      "Run cp .env.example .env.local for local work. In Vercel, open Project Settings > Environment Variables and add the same keys there.",
  },
  {
    title: "Switch persistence to Neon",
    detail:
      "Add DATABASE_URL or NEON_DATABASE_URL. As soon as one of those exists, Herizon stops using the local JSON fallback and persists the public workspace in the database.",
  },
  {
    title: "Paste supported source URLs",
    detail:
      "In the workspace, paste a supported board URL exactly as the employer uses it. Herizon infers the connector from the URL and folds it into the next refresh.",
  },
  {
    title: "Optionally generate AUTH_SECRET",
    detail:
      "Use a long random secret such as the output of openssl rand -base64 32 only if you want to re-enable Auth.js login later.",
  },
  {
    title: "Optionally turn on OAuth login",
    detail:
      "Add Google, GitHub, or both if you want account-based access later. Each provider needs its client ID and client secret pair before the login screen can be turned back on in production.",
  },
];

export const productionConnections: ProductionConnection[] = [
  {
    id: "auth-secret",
    label: "Session secret",
    envVars: ["AUTH_SECRET"],
    summary: "Optional while public access is enabled. Required only if you re-enable Auth.js sessions.",
    required: false,
  },
  {
    id: "google-oauth",
    label: "Google OAuth",
    envVars: ["AUTH_GOOGLE_ID", "AUTH_GOOGLE_SECRET"],
    summary: "Optional provider. Configure this only if you want Google sign-in later.",
    required: false,
  },
  {
    id: "github-oauth",
    label: "GitHub OAuth",
    envVars: ["AUTH_GITHUB_ID", "AUTH_GITHUB_SECRET"],
    summary: "Optional provider. Configure this only if you want GitHub sign-in later.",
    required: false,
  },
  {
    id: "database",
    label: "Workspace database",
    envVars: ["DATABASE_URL", "NEON_DATABASE_URL"],
    summary: "Set one of these to replace the local file fallback with production persistence.",
    required: true,
  },
  {
    id: "openai",
    label: "Copilot model key",
    envVars: ["OPENAI_API_KEY"],
    summary: "Optional. Without it, grounded answers stay deterministic and local.",
    required: false,
  },
];

export const sourceQuickstartExamples: SourceQuickstartExample[] = [
  {
    label: "Ashby board",
    name: "OpenAI Jobs",
    url: "https://jobs.ashbyhq.com/openai",
    kind: "jobs",
    parserHint: "ashby",
    summary: "Public Ashby board pages plus direct job-detail routes.",
  },
  {
    label: "Greenhouse board",
    name: "Smartly Careers",
    url: "https://job-boards.greenhouse.io/smartlyio",
    kind: "jobs",
    parserHint: "greenhouse",
    summary: "Structured Greenhouse board with job content support.",
  },
  {
    label: "Lever board",
    name: "Netlify Careers",
    url: "https://jobs.lever.co/netlify",
    kind: "jobs",
    parserHint: "lever",
    summary: "Public Lever postings endpoint behind the company board URL.",
  },
  {
    label: "SmartRecruiters board",
    name: "SmartRecruiters Careers",
    url: "https://jobs.smartrecruiters.com/smartrecruiters",
    kind: "jobs",
    parserHint: "smartrecruiters",
    summary: "Public SmartRecruiters company board with detail enrichment.",
  },
  {
    label: "Job Market Finland",
    name: "Tyomarkkinatori Finland",
    url: "https://tyomarkkinatori.fi/en/personal-customers/vacancies",
    kind: "jobs",
    parserHint: "tyomarkkinatori",
    summary: "Official Finnish vacancies surface with search and detail APIs.",
  },
];

export function formatParserHintLabel(parserHint: ParserHint | undefined): string {
  switch (parserHint) {
    case "ashby":
      return "Ashby";
    case "greenhouse":
      return "Greenhouse";
    case "lever":
      return "Lever";
    case "smartrecruiters":
      return "SmartRecruiters";
    case "tyomarkkinatori":
      return "Tyomarkkinatori";
    case "dealroom":
      return "Dealroom";
    case "generic-companies":
      return "Generic company-directory parser";
    case "generic-mixed":
      return "Generic mixed-surface parser";
    case "generic-jobs":
    default:
      return "Generic jobs parser";
  }
}
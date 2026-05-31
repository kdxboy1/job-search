import { load } from "cheerio";

import type {
  ExperienceRange,
  LanguageRequirement,
  SeniorityLevel,
  WorkMode,
} from "./types";
import { dedupeBy, slugify } from "./utils";

const TECHNOLOGY_PATTERNS = [
  { label: "AWS", regex: /\baws\b|amazon web services/i },
  { label: "Azure", regex: /\bazure\b|microsoft azure/i },
  { label: "GCP", regex: /\bgcp\b|google cloud/i },
  { label: "Kubernetes", regex: /\bkubernetes\b|\bk8s\b/i },
  { label: "Docker", regex: /\bdocker\b/i },
  { label: "Terraform", regex: /\bterraform\b/i },
  { label: "Python", regex: /\bpython\b/i },
  { label: "TypeScript", regex: /\btypescript\b/i },
  { label: "JavaScript", regex: /\bjavascript\b/i },
  { label: "React", regex: /\breact\b/i },
  { label: "Next.js", regex: /\bnext\.js\b|\bnextjs\b/i },
  { label: "Node.js", regex: /\bnode(?:\.js)?\b/i },
  { label: "Java", regex: /\bjava\b/i },
  { label: "Go", regex: /\bgolang\b|\bgo\b/i },
  { label: "SQL", regex: /\bsql\b|postgres|mysql|snowflake/i },
  { label: "Databricks", regex: /\bdatabricks\b/i },
  { label: "Snowflake", regex: /\bsnowflake\b/i },
  { label: "Kafka", regex: /\bkafka\b/i },
  { label: "Spark", regex: /\bspark\b|pyspark/i },
  { label: "Airflow", regex: /\bairflow\b/i },
  { label: "dbt", regex: /\bdbt\b/i },
  { label: "Tableau", regex: /\btableau\b/i },
  { label: "Power BI", regex: /power\s*bi/i },
];

const REQUIREMENT_HEADING_HINT =
  /what we(?:'|’)re looking for|requirements|qualifications|skills|you bring|your profile/i;

export function stripHtml(value: string): string {
  const $ = load(`<div>${value}</div>`);
  return $.text().replace(/\s+/g, " ").trim();
}

export function compactText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function pickFirstSentence(value: string, maxLength = 220): string {
  const compact = compactText(value);

  if (!compact) {
    return "";
  }

  const sentence = compact.match(/^.+?[.!?](?:\s|$)/)?.[0]?.trim() ?? compact;

  if (sentence.length <= maxLength) {
    return sentence;
  }

  return `${sentence.slice(0, maxLength - 1).trimEnd()}…`;
}

export function extractRequirementSignalsFromHtml(html: string): string[] {
  if (!html.trim()) {
    return [];
  }

  const $ = load(`<div>${html}</div>`);
  const listSignals = $("li")
    .map((_, element) => compactText($(element).text()))
    .get()
    .filter((item) => item.length >= 20)
    .slice(0, 5);

  if (listSignals.length) {
    return listSignals;
  }

  const paragraphs = $("p, div")
    .map((_, element) => compactText($(element).text()))
    .get()
    .filter((item) => REQUIREMENT_HEADING_HINT.test(item) || item.length >= 40)
    .slice(0, 3);

  return dedupeBy(paragraphs, (item) => item.toLowerCase());
}

export function extractTechnologies(title: string, content: string): string[] {
  const haystack = `${title}\n${content}`;

  return TECHNOLOGY_PATTERNS.filter((pattern) => pattern.regex.test(haystack)).map(
    (pattern) => pattern.label,
  );
}

export function detectSeniority(title: string, content: string): SeniorityLevel {
  const haystack = `${title} ${content}`.toLowerCase();

  if (/intern|internship|trainee|graduate/.test(haystack)) {
    return "intern";
  }

  if (/junior|associate\b/.test(haystack)) {
    return "junior";
  }

  if (/chief|vice president|\bvp\b|head of|cxo\b/.test(haystack)) {
    return "executive";
  }

  if (/director/.test(haystack)) {
    return "director";
  }

  if (/principal|staff|lead/.test(haystack)) {
    return "lead";
  }

  if (/senior|sr\.?\b/.test(haystack)) {
    return "senior";
  }

  if (/manager/.test(haystack)) {
    return "manager";
  }

  if (/specialist|engineer|developer|designer|analyst|scientist|consultant|product manager/.test(haystack)) {
    return "mid";
  }

  return "unknown";
}

export function detectExperienceRange(content: string): ExperienceRange | undefined {
  const patterns: RegExp[] = [
    /(\d+)\s*[-–]\s*(\d+)\+?\s+years?/i,
    /(\d+)\+\s+years?/i,
    /at least\s+(\d+)\s+years?/i,
    /(\d+)\s+years?\s+of\s+experience/i,
    /vähintään\s+(\d+)\s+vuoden/i,
    /(\d+)\s+vuoden\s+kokemus/i,
  ];

  for (const pattern of patterns) {
    const match = content.match(pattern);

    if (!match) {
      continue;
    }

    if (match[2]) {
      return {
        min: Number.parseInt(match[1] ?? "", 10),
        max: Number.parseInt(match[2], 10),
        raw: match[0],
      };
    }

    return {
      min: Number.parseInt(match[1] ?? "", 10),
      raw: match[0],
    };
  }

  return undefined;
}

export function normalizeLanguageLabel(value: string): string {
  const normalized = value.trim().toLowerCase();

  if (["fi", "finnish", "suomi"].includes(normalized)) {
    return "Finnish";
  }

  if (["en", "english"].includes(normalized)) {
    return "English";
  }

  if (["sv", "swedish"].includes(normalized)) {
    return "Swedish";
  }

  return value;
}

export function classifyFinnishRequirement(
  content: string,
  languageRequirements: string[],
): LanguageRequirement {
  const normalizedLanguages = languageRequirements.map((language) =>
    normalizeLanguageLabel(language),
  );
  const haystack = content.toLowerCase();

  if (normalizedLanguages.includes("Finnish")) {
    return "required";
  }

  if (
    /(finnish|suomi).{0,30}(required|must|need|mandatory)/i.test(content) ||
    /(required|must|need|mandatory).{0,30}(finnish|suomi)/i.test(content)
  ) {
    return "required";
  }

  if (
    /(finnish|suomi).{0,30}(preferred|plus|helpful|benefit|advantage)/i.test(content) ||
    /(preferred|plus|helpful|benefit|advantage).{0,30}(finnish|suomi)/i.test(content)
  ) {
    return "preferred";
  }

  if (/english/.test(haystack) || normalizedLanguages.includes("English")) {
    return "english-friendly";
  }

  return "not-mentioned";
}

export function detectWorkModes(content: string, locations: string[]): WorkMode[] {
  const haystack = `${content} ${locations.join(" ")}`.toLowerCase();
  const modes: WorkMode[] = [];

  if (/remote/.test(haystack)) {
    modes.push("remote");
  }

  if (/hybrid/.test(haystack)) {
    modes.push("hybrid");
  }

  if (/on-site|onsite|on site/.test(haystack)) {
    modes.push("onsite");
  }

  if (!modes.length) {
    modes.push("unspecified");
  }

  return dedupeBy(modes, (mode) => mode);
}

export function formatPrimaryLocation(locations: string[]): string {
  if (!locations.length) {
    return "Unspecified";
  }

  if (locations.length === 1) {
    return locations[0] ?? "Unspecified";
  }

  return `${locations[0]} + ${locations.length - 1} more`;
}

export function buildJobTags(input: {
  department?: string;
  seniority: SeniorityLevel;
  technologies: string[];
  finnishRequirement: LanguageRequirement;
  workModes: WorkMode[];
}): string[] {
  const tags: string[] = [];

  if (input.department) {
    tags.push(slugify(input.department).replace(/-/g, " "));
  }

  if (input.seniority !== "unknown") {
    tags.push(input.seniority);
  }

  if (input.finnishRequirement !== "not-mentioned") {
    tags.push(`finnish ${input.finnishRequirement}`);
  }

  for (const technology of input.technologies.slice(0, 3)) {
    tags.push(technology.toLowerCase());
  }

  if (input.workModes.some((mode) => mode === "remote" || mode === "hybrid")) {
    tags.push("remote-friendly");
  }

  return dedupeBy(tags, (tag) => tag);
}
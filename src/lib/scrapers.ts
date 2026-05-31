import { load } from "cheerio";

import { coordinatesForLocation, detectLocationFromText, normalizeLocation } from "./location";
import { dedupeBy, slugify } from "./utils";
import type { CompanyProfile, JobListing, SourceConfig } from "./types";

const JOB_TEXT_HINT =
  /(job|career|position|vacanc|opening|hiring|rekry|tyo|developer|engineer|designer|manager|analyst|lead|specialist)/i;
const JOB_LINK_HINT = /(job|career|position|vacanc|opening|greenhouse|lever|workable|apply)/i;
const COMPANY_LINK_HINT = /(company|companies|startup|portfolio|venture|team)/i;
const REMOTE_HINT = /(remote|hybrid|distributed)/i;
const FINNISH_CITY_HINT =
  /(helsinki|espoo|vantaa|tampere|turku|oulu|lahti|jyvaskyla|kuopio|finland)/i;

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

function cleanText(value: string): string {
  return value.replace(/\s+/g, " ").replace(/\s+[|>]+\s+/g, " ").trim();
}

function resolveUrl(baseUrl: string, rawHref: string): string {
  try {
    return new URL(rawHref, baseUrl).toString();
  } catch {
    return baseUrl;
  }
}

function sourceHostLabel(url: string): string {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    return hostname.split(".")[0]?.replace(/[-_]+/g, " ") ?? hostname;
  } catch {
    return "source";
  }
}

function inferTags(title: string, context: string): string[] {
  const combined = `${title} ${context}`.toLowerCase();
  const tags: string[] = [];

  if (REMOTE_HINT.test(combined)) {
    tags.push("remote-friendly");
  }

  if (/(data|analytics|platform)/.test(combined)) {
    tags.push("data");
  }

  if (/(product|growth|marketing)/.test(combined)) {
    tags.push("commercial");
  }

  if (/(design|ux|research)/.test(combined)) {
    tags.push("design");
  }

  if (/(engineer|developer|software|backend|frontend)/.test(combined)) {
    tags.push("engineering");
  }

  return tags;
}

function guessCompany(title: string, context: string, source: SourceConfig): string {
  const patterns = [
    /(?:at|join|with)\s+([A-Z][A-Za-z0-9&' .-]{1,60})/,
    /company\s*[:|-]\s*([A-Z][A-Za-z0-9&' .-]{1,60})/i,
    /employer\s*[:|-]\s*([A-Z][A-Za-z0-9&' .-]{1,60})/i,
  ];

  for (const pattern of patterns) {
    const match = context.match(pattern);

    if (match?.[1] && !match[1].includes(title)) {
      return cleanText(match[1]);
    }
  }

  const fragments = context
    .split(/[|•\n]/)
    .map((fragment) => cleanText(fragment))
    .filter(Boolean)
    .filter((fragment) => fragment !== title)
    .filter((fragment) => fragment.length >= 3 && fragment.length <= 50)
    .filter((fragment) => !JOB_TEXT_HINT.test(fragment));

  if (fragments[0]) {
    return fragments[0];
  }

  return sourceHostLabel(source.url);
}

function inferSectors(context: string): string[] {
  const sectors = SECTOR_PATTERNS.filter((pattern) => pattern.regex.test(context)).map(
    (pattern) => pattern.label,
  );

  return sectors.length ? sectors : ["General tech"];
}

function summarizeContext(context: string, fallback: string): string {
  const summary = cleanText(context).slice(0, 180);
  return summary || fallback;
}

function extractPostedLabel(context: string): string | undefined {
  const match = context.match(
    /\b(today|yesterday|\d+\s+(?:minutes?|hours?|days?|weeks?)\s+ago)\b/i,
  );

  return match?.[0];
}

function scoreJob(title: string, href: string, context: string): number {
  let score = 0;

  if (JOB_TEXT_HINT.test(title)) {
    score += 3;
  }

  if (JOB_LINK_HINT.test(href)) {
    score += 2;
  }

  if (FINNISH_CITY_HINT.test(context) || REMOTE_HINT.test(context)) {
    score += 1;
  }

  if (/apply|salary|department|team|full[- ]time|part[- ]time/i.test(context)) {
    score += 1;
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

  if (FINNISH_CITY_HINT.test(context) || /startup|scaleup|software|platform|fintech/i.test(context)) {
    score += 1;
  }

  return score;
}

export async function fetchHtml(url: string): Promise<string> {
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`Request failed with ${response.status}`);
  }

  return response.text();
}

export function extractJobsFromHtml(html: string, source: SourceConfig): JobListing[] {
  const $ = load(html);
  const jobs: JobListing[] = [];

  $("a[href]").each((_, element) => {
    const title = cleanText($(element).text());
    const href = resolveUrl(source.url, $(element).attr("href") ?? "");

    if (!title || title.length < 6 || title.length > 140) {
      return;
    }

    const container = $(element).closest("article, li, div, section, tr");
    const context = cleanText(container.text());
    const score = scoreJob(title, href, context);

    if (score < 3) {
      return;
    }

    const location = detectLocationFromText(context);
    const company = guessCompany(title, context, source);
    const remote = REMOTE_HINT.test(context);

    jobs.push({
      id: `${source.id}-${slugify(`${title}-${href}`)}`,
      title,
      company,
      location,
      normalizedLocation: normalizeLocation(location),
      url: href,
      sourceId: source.id,
      sourceName: source.name,
      tags: inferTags(title, context),
      postedLabel: extractPostedLabel(context),
      remote,
      confidence: Number(Math.min(0.96, 0.32 + score * 0.11).toFixed(2)),
      summary: summarizeContext(context.replace(title, ""), `Parsed from ${source.name}.`),
    });
  });

  return dedupeBy(jobs, (job) => job.url)
    .sort((left, right) => right.confidence - left.confidence)
    .slice(0, 28);
}

export function extractCompaniesFromHtml(
  html: string,
  source: SourceConfig,
): CompanyProfile[] {
  const $ = load(html);
  const companies: CompanyProfile[] = [];

  $("a[href]").each((_, element) => {
    const name = cleanText($(element).text());
    const href = resolveUrl(source.url, $(element).attr("href") ?? "");

    if (!name || name.length < 2 || name.length > 64) {
      return;
    }

    if (JOB_TEXT_HINT.test(name) || NAVIGATION_BLOCKLIST.has(name.toLowerCase())) {
      return;
    }

    const container = $(element).closest("article, li, div, section, tr");
    const context = cleanText(container.text());
    const score = scoreCompany(name, href, context);

    if (score < 2) {
      return;
    }

    const location = detectLocationFromText(context);

    companies.push({
      id: `${source.id}-${slugify(name)}`,
      slug: slugify(name),
      name,
      location,
      normalizedLocation: normalizeLocation(location),
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
      confidence: Number(Math.min(0.93, 0.34 + score * 0.12).toFixed(2)),
      coordinates: coordinatesForLocation(location),
    });
  });

  return dedupeBy(companies, (company) => company.slug)
    .sort((left, right) => right.confidence - left.confidence)
    .slice(0, 30);
}
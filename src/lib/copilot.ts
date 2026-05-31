import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";

import { buildOutreachPlan } from "./platform";
import type {
  CompanyProfile,
  GroundedAnswer,
  GroundedCompanyReference,
  GroundedJobReference,
  JobListing,
  PlatformIntelligence,
} from "./types";

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3);
}

function overlapScore(tokens: string[], haystack: string): number {
  const corpus = haystack.toLowerCase();
  return tokens.reduce(
    (score, token) => (corpus.includes(token) ? score + 1 : score),
    0,
  );
}

function pickSupportingJobs(
  question: string,
  intelligence: PlatformIntelligence,
): JobListing[] {
  const tokens = tokenize(question);

  return intelligence.jobs
    .map((job) => ({
      job,
      score:
        overlapScore(
          tokens,
          `${job.title} ${job.company} ${job.location} ${job.summary} ${job.tags.join(" ")}`,
        ) + job.confidence,
    }))
    .sort((left, right) => right.score - left.score)
    .slice(0, 5)
    .map(({ job }) => job);
}

function pickSupportingCompanies(
  question: string,
  intelligence: PlatformIntelligence,
): CompanyProfile[] {
  const tokens = tokenize(question);

  return intelligence.companies
    .map((company) => ({
      company,
      score:
        overlapScore(
          tokens,
          `${company.name} ${company.location} ${company.summary} ${company.sectors.join(" ")} ${company.whyNow}`,
        ) + company.confidence,
    }))
    .sort((left, right) => right.score - left.score)
    .slice(0, 5)
    .map(({ company }) => company);
}

function toJobReferences(jobs: JobListing[]): GroundedJobReference[] {
  return jobs.map((job) => ({
    id: job.id,
    title: job.title,
    company: job.company,
    location: job.location,
    url: job.url,
    sourceName: job.sourceName,
  }));
}

function toCompanyReferences(companies: CompanyProfile[]): GroundedCompanyReference[] {
  return companies.map((company) => ({
    id: company.id,
    name: company.name,
    location: company.location,
    url: company.url,
    jobsUrl: company.jobsUrl,
    sourceName: company.sourceName,
  }));
}

function heuristicAnswer(
  question: string,
  intelligence: PlatformIntelligence,
  supportingJobs: JobListing[],
  supportingCompanies: CompanyProfile[],
): string {
  const lowerQuestion = question.toLowerCase();
  const lines: string[] = [
    `I refreshed ${intelligence.sources.length} sources and currently see ${intelligence.analytics.totalJobs} job signals plus ${intelligence.analytics.totalCompanies} companies in the radar.`,
  ];

  if (!supportingJobs.length && !supportingCompanies.length) {
    lines.push(
      "There is not enough grounded evidence in the current refresh to answer that precisely yet. Add a more direct careers page or company directory source.",
    );
    return lines.join(" ");
  }

  if (lowerQuestion.includes("remote")) {
    lines.push(
      `${intelligence.analytics.remoteFriendlyJobs} of the parsed job records mention remote or hybrid flexibility.`,
    );
  }

  if (
    lowerQuestion.includes("outreach") ||
    lowerQuestion.includes("message") ||
    lowerQuestion.includes("network") ||
    lowerQuestion.includes("contact")
  ) {
    const company = supportingCompanies[0];

    if (company) {
      const plan = buildOutreachPlan(company, intelligence);
      lines.push(
        `${company.name} is a strong outreach target because ${company.whyNow.toLowerCase()} Start with: "${plan.opening}"`,
      );
    }
  }

  if (supportingJobs[0]) {
    lines.push(
      `The strongest job-side signal is ${supportingJobs[0].title} at ${supportingJobs[0].company} in ${supportingJobs[0].location}.`,
    );
  }

  if (supportingCompanies[0]) {
    lines.push(
      `On the company side, ${supportingCompanies[0].name} stands out for ${supportingCompanies[0].sectors.join(", ")}.`,
    );
  }

  return lines.join(" ");
}

export async function answerGroundedQuestion(
  question: string,
  intelligence: PlatformIntelligence,
): Promise<GroundedAnswer> {
  const supportingJobs = pickSupportingJobs(question, intelligence);
  const supportingCompanies = pickSupportingCompanies(question, intelligence);

  let answer = heuristicAnswer(
    question,
    intelligence,
    supportingJobs,
    supportingCompanies,
  );
  let generatedWith = "heuristic-grounding";

  if (process.env.OPENAI_API_KEY) {
    try {
      const { text } = await generateText({
        model: openai("gpt-4.1-mini"),
        system:
          "You are a grounded job-search copilot. Use only the provided records. If the records do not support a claim, say so clearly. Keep the answer concise and actionable.",
        prompt: JSON.stringify(
          {
            question,
            analytics: intelligence.analytics,
            supportingJobs: toJobReferences(supportingJobs),
            supportingCompanies: toCompanyReferences(supportingCompanies),
          },
          null,
          2,
        ),
      });

      if (text.trim()) {
        answer = text.trim();
        generatedWith = "openai:gpt-4.1-mini";
      }
    } catch {
      generatedWith = "heuristic-grounding";
    }
  }

  return {
    answer,
    supportingJobs: toJobReferences(supportingJobs),
    supportingCompanies: toCompanyReferences(supportingCompanies),
    generatedWith,
  };
}
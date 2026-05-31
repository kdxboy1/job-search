import { describe, expect, it } from "vitest";

import { extractCompaniesFromHtml, extractJobsFromHtml } from "./scrapers";
import type { SourceConfig } from "./types";

const jobSource: SourceConfig = {
  id: "smartly-careers",
  name: "Smartly Careers",
  url: "https://job-boards.greenhouse.io/smartlyio",
  kind: "jobs",
  parserHint: "generic-jobs",
  description: "Direct company board.",
  tags: ["company-board"],
};

const companySource: SourceConfig = {
  id: "dealroom-finland",
  name: "Dealroom Finland",
  url: "https://finland.dealroom.co/companies/f/all_slug_locations/anyof_finland",
  kind: "company-directory",
  parserHint: "dealroom",
  description: "Company discovery board.",
  tags: ["companies"],
};

describe("extractJobsFromHtml", () => {
  it("parses likely job cards from a careers board", () => {
    const html = `
      <section>
        <article>
          <a href="/jobs/senior-data-engineer">Senior Data Engineer</a>
          <p>Join Smartly in Helsinki. Remote friendly. Data platform team.</p>
        </article>
        <article>
          <a href="/jobs/product-designer">Product Designer</a>
          <p>Work with product teams in Tampere. Hybrid. Apply now.</p>
        </article>
      </section>
    `;

    const jobs = extractJobsFromHtml(html, jobSource);

    expect(jobs).toHaveLength(2);
    expect(jobs[0]?.sourceName).toBe("Smartly Careers");
    expect(jobs.some((job) => job.normalizedLocation === "Helsinki")).toBe(true);
    expect(jobs.some((job) => job.remote)).toBe(true);
  });
});

describe("extractCompaniesFromHtml", () => {
  it("parses likely company cards from a company directory", () => {
    const html = `
      <section>
        <article>
          <a href="/companies/aiven">Aiven</a>
          <p>Helsinki data infrastructure startup building managed cloud services.</p>
        </article>
        <article>
          <a href="/companies/oura">Oura</a>
          <p>Oulu health tech company building connected consumer devices.</p>
        </article>
      </section>
    `;

    const companies = extractCompaniesFromHtml(html, companySource);

    expect(companies).toHaveLength(2);
    expect(companies[0]?.sourceName).toBe("Dealroom Finland");
    expect(companies.some((company) => company.normalizedLocation === "Helsinki")).toBe(
      true,
    );
    expect(companies[1]?.sectors.length).toBeGreaterThan(0);
  });
});
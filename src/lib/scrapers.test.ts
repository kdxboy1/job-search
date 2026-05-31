import { afterEach, describe, expect, it, vi } from "vitest";

import { scrapeSource } from "./scrapers";
import type { SourceConfig } from "./types";

const tyomarkkinatoriSource: SourceConfig = {
  id: "tyomarkkinatori-finland",
  name: "Tyomarkkinatori Finland",
  url: "https://tyomarkkinatori.fi/en/personal-customers/vacancies",
  kind: "jobs",
  parserHint: "tyomarkkinatori",
  description: "Official vacancies board.",
  tags: ["public-market"],
};

const greenhouseSource: SourceConfig = {
  id: "smartly-careers",
  name: "Smartly Careers",
  url: "https://job-boards.greenhouse.io/smartlyio",
  kind: "jobs",
  parserHint: "greenhouse",
  description: "Direct company board.",
  tags: ["company-board"],
};

const leverSource: SourceConfig = {
  id: "netlify-careers",
  name: "Netlify Careers",
  url: "https://jobs.lever.co/netlify",
  kind: "jobs",
  parserHint: "lever",
  description: "Lever board.",
  tags: ["company-board"],
};

const smartRecruitersSource: SourceConfig = {
  id: "smartrecruiters-demo",
  name: "SmartRecruiters Careers",
  url: "https://jobs.smartrecruiters.com/smartrecruiters",
  kind: "jobs",
  parserHint: "smartrecruiters",
  description: "SmartRecruiters board.",
  tags: ["company-board"],
};

const ashbySource: SourceConfig = {
  id: "openai-jobs",
  name: "OpenAI Jobs",
  url: "https://jobs.ashbyhq.com/openai",
  kind: "jobs",
  parserHint: "ashby",
  description: "Ashby board.",
  tags: ["company-board"],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("scrapeSource", () => {
  it("uses the Tyomarkkinatori APIs for list and detail enrichment", async () => {
    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = String(input);

      if (url.includes("jobpostingfulltext/search/v2/search")) {
        return new Response(
          JSON.stringify({
            totalElements: 12706,
            content: [
              {
                id: "aa4f08f8-875a-4a67-ab02-897804de711c",
                title: { fi: "Ilmalämpöpumppuasentaja" },
                employer: { ownerName: { fi: "CoolerYkköset" } },
                location: {
                  municipalities: [
                    { value: "564", label: { en: "Oulu" } },
                    { value: "139", label: { en: "Ii" } },
                  ],
                },
                applicationPeriodEndDate: "2026-06-12T20:59:00Z",
                publishDate: "2026-05-31T12:00:00Z",
                employmentRelationships: "01",
                workTime: "01",
              },
            ],
          }),
          { status: 200 },
        );
      }

      if (url.includes("jobposting-new/v1/public/jobpostings/aa4f08f8-875a-4a67-ab02-897804de711c")) {
        return new Response(
          JSON.stringify({
            position: {
              title: { fi: "Ilmalämpöpumppuasentaja" },
              jobDescription: {
                fi: "Haemme kokenutta asentajaa. Vähintään 2 vuoden kokemus edellytetään. Työkieli suomi.",
              },
              workLanguages: ["fi"],
              workTime: "01",
              continuityOfWork: ["01"],
            },
            owner: { company: { fi: "CoolerYkköset" } },
            application: {
              expires: "2026-06-12T20:59:00Z",
              published: "2026-05-31T12:00:00Z",
              openPositions: 1,
            },
          }),
          { status: 200 },
        );
      }

      if (url.includes("/api/codes/v1/kopa/KIELI/")) {
        return new Response(
          JSON.stringify([{ tunnus: "fi", selite: [{ kielikoodi: "en", teksti: "Finnish" }] }]),
          { status: 200 },
        );
      }

      if (url.includes("/api/codes/v1/kopa/PALVELUSSUHDE/")) {
        return new Response(
          JSON.stringify([{ tunnus: "01", selite: [{ kielikoodi: "en", teksti: "Employment relationship" }] }]),
          { status: 200 },
        );
      }

      if (
        url.includes("/api/codes/v1/kopa/TYÖN_JATKUVUUS/") ||
        url.includes("/api/codes/v1/kopa/TY%C3%96N_JATKUVUUS/")
      ) {
        return new Response(
          JSON.stringify([{ tunnus: "01", selite: [{ kielikoodi: "en", teksti: "Permanent" }] }]),
          { status: 200 },
        );
      }

      if (
        url.includes("/api/codes/v1/kopa/TYÖAIKA/") ||
        url.includes("/api/codes/v1/kopa/TY%C3%96AIKA/")
      ) {
        return new Response(
          JSON.stringify([{ tunnus: "01", selite: [{ kielikoodi: "en", teksti: "Full-time" }] }]),
          { status: 200 },
        );
      }

      throw new Error(`Unhandled fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    const result = await scrapeSource(tyomarkkinatoriSource);

    expect(result.totalAvailableJobs).toBe(12706);
    expect(result.jobs).toHaveLength(1);
    expect(result.jobs[0]?.title).toBe("Ilmalämpöpumppuasentaja");
    expect(result.jobs[0]?.company).toBe("CoolerYkköset");
    expect(result.jobs[0]?.yearsExperience?.min).toBe(2);
    expect(result.jobs[0]?.finnishRequirement).toBe("required");
    expect(result.jobs[0]?.employmentTypes).toContain("Permanent");
  });

  it("uses the Greenhouse board API for structured jobs with content", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          jobs: [
            {
              id: 5833008004,
              title: "Senior Product Manager, Rendering Platform",
              absolute_url: "https://job-boards.greenhouse.io/smartlyio/jobs/5833008004",
              updated_at: "2026-05-13T10:38:04-04:00",
              location: { name: "Helsinki, Uusimaa, Finland" },
              departments: [{ name: "Product Management" }],
              content:
                "<p>5+ years of product management experience.</p><p>Experience with AWS, Azure, and data analysis. English is required.</p>",
            },
          ],
        }),
        { status: 200 },
      ),
    );

    vi.stubGlobal("fetch", fetchMock);

    const result = await scrapeSource(greenhouseSource);

    expect(result.totalAvailableJobs).toBe(1);
    expect(result.jobs).toHaveLength(1);
    expect(result.jobs[0]?.company).toBe("Smartly");
    expect(result.jobs[0]?.department).toBe("Product Management");
    expect(result.jobs[0]?.technologies).toEqual(expect.arrayContaining(["AWS", "Azure"]));
    expect(result.jobs[0]?.seniority).toBe("senior");
    expect(result.jobs[0]?.yearsExperience?.min).toBe(5);
    expect(result.jobs[0]?.finnishRequirement).toBe("english-friendly");
  });

  it("uses the Lever postings API for structured jobs", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify([
          {
            id: "lever-1",
            text: "Senior Data Engineer",
            categories: {
              location: "Remote / Europe",
              commitment: "Full-time",
              team: "Data",
              department: "Engineering",
              allLocations: ["Remote / Europe", "Helsinki"],
            },
            descriptionPlain:
              "5+ years building data platforms. Strong AWS and dbt experience. English is required.",
            additionalPlain: "Hybrid collaboration with product and analytics.",
            hostedUrl: "https://jobs.lever.co/netlify/lever-1",
            applyUrl: "https://jobs.lever.co/netlify/lever-1/apply",
            workplaceType: "remote",
          },
        ]),
        { status: 200 },
      ),
    );

    vi.stubGlobal("fetch", fetchMock);

    const result = await scrapeSource(leverSource);

    expect(result.totalAvailableJobs).toBe(1);
    expect(result.jobs[0]?.company).toBe("Netlify");
    expect(result.jobs[0]?.department).toBe("Engineering / Data");
    expect(result.jobs[0]?.technologies).toEqual(expect.arrayContaining(["AWS", "dbt"]));
    expect(result.jobs[0]?.seniority).toBe("senior");
    expect(result.jobs[0]?.yearsExperience?.min).toBe(5);
    expect(result.jobs[0]?.workModes).toContain("remote");
  });

  it("uses the SmartRecruiters postings endpoints for structured jobs", async () => {
    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = String(input);

      if (url.includes("/v1/companies/smartrecruiters/postings?limit=30")) {
        return new Response(
          JSON.stringify({
            totalFound: 1,
            content: [
              {
                id: "74983486",
                name: "Senior Analytics Engineer",
                company: { identifier: "smartrecruiters", name: "SmartRecruiters" },
                releasedDate: "2026-05-30T12:00:00.000Z",
                location: {
                  city: "Krakow",
                  region: "Lesser Poland",
                  country: "Poland",
                  remote: true,
                },
                department: { label: "Data" },
                function: { label: "Engineering" },
                typeOfEmployment: { label: "Permanent" },
                experienceLevel: { label: "Mid-Senior Level" },
              },
            ],
          }),
          { status: 200 },
        );
      }

      if (url.includes("/v1/companies/smartrecruiters/postings/74983486")) {
        return new Response(
          JSON.stringify({
            id: "74983486",
            name: "Senior Analytics Engineer",
            company: { identifier: "smartrecruiters", name: "SmartRecruiters" },
            releasedDate: "2026-05-30T12:00:00.000Z",
            location: {
              city: "Krakow",
              region: "Lesser Poland",
              country: "Poland",
              remote: true,
            },
            department: { label: "Data" },
            function: { label: "Engineering" },
            typeOfEmployment: { label: "Permanent" },
            experienceLevel: { label: "Mid-Senior Level" },
            applyUrl: "https://jobs.smartrecruiters.com/smartrecruiters/74983486",
            jobAd: {
              sections: {
                jobDescription: {
                  title: "Job Description",
                  text: "<p>5+ years of analytics engineering experience. Strong SQL, dbt, and Python skills. English is required.</p>",
                },
                qualifications: {
                  title: "Qualifications",
                  text: "<p>Experience with cloud data platforms and stakeholder collaboration.</p>",
                },
              },
            },
          }),
          { status: 200 },
        );
      }

      throw new Error(`Unhandled fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    const result = await scrapeSource(smartRecruitersSource);

    expect(result.totalAvailableJobs).toBe(1);
    expect(result.jobs[0]?.company).toBe("SmartRecruiters");
    expect(result.jobs[0]?.department).toBe("Data / Engineering");
    expect(result.jobs[0]?.technologies).toEqual(expect.arrayContaining(["SQL", "dbt", "Python"]));
    expect(result.jobs[0]?.seniority).toBe("senior");
    expect(result.jobs[0]?.yearsExperience?.min).toBe(5);
    expect(result.jobs[0]?.workModes).toContain("remote");
  });

  it("uses Ashby board pages and detail routes for structured jobs", async () => {
    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = String(input);

      if (url === ashbySource.url) {
        return new Response(
          `<!doctype html><html><head><title>OpenAI Jobs</title></head><body><script>window.__ASHBY_JOB_BOARD_STATE__ = {"jobBoard":{"jobPostings":[{"id":"ashby-posting-1","title":"Senior AI Systems Engineer","departmentName":"Applied AI","teamName":"Codex","locationName":"San Francisco","workplaceType":"Hybrid","employmentType":"FullTime","publishedDate":"2026-05-30","compensationTierSummary":"$230K – $385K • Offers Equity","isListed":true,"secondaryLocations":[{"locationName":"Remote - US"}]}]},"routerPrefix":"/"};</script></body></html>`,
          { status: 200 },
        );
      }

      if (url === "https://jobs.ashbyhq.com/openai/ashby-posting-1") {
        return new Response(
          `<!doctype html><html><head><meta name="description" content="About The Role 5+ years building AI systems with Python and AWS. English is required."></head><body><a href="/openai/ashby-posting-1/application">Apply for this Job</a></body></html>`,
          { status: 200 },
        );
      }

      throw new Error(`Unhandled fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    const result = await scrapeSource(ashbySource);

    expect(result.totalAvailableJobs).toBe(1);
    expect(result.jobs).toHaveLength(1);
    expect(result.jobs[0]?.company).toBe("OpenAI");
    expect(result.jobs[0]?.department).toBe("Applied AI / Codex");
    expect(result.jobs[0]?.url).toBe("https://jobs.ashbyhq.com/openai/ashby-posting-1");
    expect(result.jobs[0]?.applyUrl).toBe(
      "https://jobs.ashbyhq.com/openai/ashby-posting-1/application",
    );
    expect(result.jobs[0]?.technologies).toEqual(expect.arrayContaining(["Python", "AWS"]));
    expect(result.jobs[0]?.yearsExperience?.min).toBe(5);
    expect(result.jobs[0]?.seniority).toBe("senior");
    expect(result.jobs[0]?.workModes).toContain("hybrid");
    expect(result.jobs[0]?.finnishRequirement).toBe("english-friendly");
  });
});
import type {
  CountryCode,
  CountrySourceCatalog,
  CuratedSourceDescriptor,
  ParserHint,
  SourceKind,
} from "./types";

function buildSourceDescriptor(
  descriptor: CuratedSourceDescriptor,
): CuratedSourceDescriptor {
  return {
    ...descriptor,
    tags: [...descriptor.tags, "catalog"],
  };
}

export function inferSourceParserHint(url: string, kind: SourceKind): ParserHint {
  if (/tyomarkkinatori\.fi/i.test(url)) {
    return "tyomarkkinatori";
  }

  if (/ashbyhq\.com/i.test(url)) {
    return "ashby";
  }

  if (/greenhouse/i.test(url)) {
    return "greenhouse";
  }

  if (/jobs\.lever\.co|api\.lever\.co/i.test(url)) {
    return "lever";
  }

  if (/smartrecruiters/i.test(url)) {
    return "smartrecruiters";
  }

  if (/dealroom/i.test(url)) {
    return "dealroom";
  }

  return kind === "jobs"
    ? "generic-jobs"
    : kind === "company-directory"
      ? "generic-companies"
      : "generic-mixed";
}

const globalAtsPlatforms: CuratedSourceDescriptor[] = [
  buildSourceDescriptor({
    id: "ats-greenhouse",
    name: "Greenhouse",
    url: "https://job-boards.greenhouse.io/",
    kind: "jobs",
    parserHint: "greenhouse",
    description: "Reusable company board pattern with a public structured boards API.",
    tags: ["ats", "global", "structured"],
    country: "GLOBAL",
    category: "ats-platform",
    prominence: "ATS footprint across growth and enterprise employers.",
    readiness: "supported",
    strategy: "ats-api",
    notes: "Typed adapter available now via the public boards API.",
  }),
  buildSourceDescriptor({
    id: "ats-lever",
    name: "Lever",
    url: "https://jobs.lever.co/",
    kind: "jobs",
    parserHint: "lever",
    description: "Lever-hosted company boards backed by a public postings API.",
    tags: ["ats", "global", "structured"],
    country: "GLOBAL",
    category: "ats-platform",
    prominence: "Common ATS on product, startup, and scale-up company pages.",
    readiness: "supported",
    strategy: "ats-api",
    notes: "Typed adapter available now via the public Lever postings API.",
  }),
  buildSourceDescriptor({
    id: "ats-smartrecruiters",
    name: "SmartRecruiters",
    url: "https://jobs.smartrecruiters.com/",
    kind: "jobs",
    parserHint: "smartrecruiters",
    description: "Structured company career sites and posting endpoints for SmartRecruiters customers.",
    tags: ["ats", "global", "structured"],
    country: "GLOBAL",
    category: "ats-platform",
    prominence: "Large enterprise and international recruiting footprint.",
    readiness: "supported",
    strategy: "ats-api",
    notes: "Typed adapter available now via the public company postings endpoints.",
  }),
  buildSourceDescriptor({
    id: "ats-workday",
    name: "Workday Jobs",
    url: "https://wd1.myworkdaysite.com/",
    kind: "jobs",
    parserHint: "generic-jobs",
    description: "Very common enterprise career stack, but URL patterns and pagination vary by tenant.",
    tags: ["ats", "global", "enterprise"],
    country: "GLOBAL",
    category: "ats-platform",
    prominence: "Massive enterprise footprint.",
    readiness: "candidate",
    strategy: "html-fallback",
    notes: "High-value next adapter, but tenant variation means careful normalization work.",
  }),
  buildSourceDescriptor({
    id: "ats-ashby",
    name: "Ashby",
    url: "https://jobs.ashbyhq.com/",
    kind: "jobs",
    parserHint: "ashby",
    description: "Fast-growing ATS in modern software companies.",
    tags: ["ats", "global", "startup"],
    country: "GLOBAL",
    category: "ats-platform",
    prominence: "Emerging startup default in software hiring.",
    readiness: "supported",
    strategy: "public-search",
    notes: "Typed adapter available now via Ashby's public board pages and detail routes.",
  }),
];

export const countrySourceCatalog: CountrySourceCatalog[] = [
  {
    country: "FI",
    countryName: "Finland",
    overview: "Public national coverage plus startup and employer boards.",
    primarySignal: "Start with Tyomarkkinatori, then layer ATS career pages from target employers.",
    sources: [
      buildSourceDescriptor({
        id: "catalog-tyomarkkinatori",
        name: "Tyomarkkinatori Finland",
        url: "https://tyomarkkinatori.fi/en/personal-customers/vacancies",
        kind: "jobs",
        parserHint: "tyomarkkinatori",
        description: "Official Finnish vacancies surface with public search and detail APIs.",
        tags: ["official", "finland", "public"],
        country: "FI",
        category: "national-portal",
        prominence: "Official national labor-market source.",
        readiness: "supported",
        strategy: "official-api",
        notes: "Already integrated with typed search and detail extraction.",
      }),
      buildSourceDescriptor({
        id: "catalog-duunitori",
        name: "Duunitori",
        url: "https://duunitori.fi/tyopaikat",
        kind: "jobs",
        parserHint: "generic-jobs",
        description: "Major Finnish private job board with broad market coverage.",
        tags: ["private-board", "finland"],
        country: "FI",
        category: "private-board",
        prominence: "Large private-market surface.",
        readiness: "candidate",
        strategy: "public-search",
        notes: "Prominent board, but still needs a stable source-specific adapter.",
      }),
      buildSourceDescriptor({
        id: "catalog-oikotie",
        name: "Oikotie Jobs",
        url: "https://tyopaikat.oikotie.fi/",
        kind: "jobs",
        parserHint: "generic-jobs",
        description: "Previously important Finnish job board.",
        tags: ["private-board", "finland"],
        country: "FI",
        category: "private-board",
        prominence: "Historically prominent.",
        readiness: "closed",
        strategy: "closed",
        notes: "Systematic collection is explicitly closed; keep this as research context only.",
      }),
    ],
  },
  {
    country: "FR",
    countryName: "France",
    overview: "Official public employment plus executive and employer-brand surfaces.",
    primarySignal: "Use France Travail for national breadth and Welcome to the Jungle for company-brand context.",
    sources: [
      buildSourceDescriptor({
        id: "catalog-france-travail",
        name: "France Travail",
        url: "https://www.francetravail.fr/accueil/",
        kind: "jobs",
        parserHint: "generic-jobs",
        description: "Official French public employment portal.",
        tags: ["official", "france", "public"],
        country: "FR",
        category: "national-portal",
        prominence: "National public labor-market source.",
        readiness: "candidate",
        strategy: "public-search",
        notes: "Public surface exists, but the fetch path can be obscured by privacy and cookie flows.",
      }),
      buildSourceDescriptor({
        id: "catalog-apec",
        name: "Apec",
        url: "https://www.apec.fr/",
        kind: "jobs",
        parserHint: "generic-jobs",
        description: "Well-known executive and professional jobs platform in France.",
        tags: ["private-board", "france", "executive"],
        country: "FR",
        category: "private-board",
        prominence: "Professional and white-collar market.",
        readiness: "restricted",
        strategy: "privacy-gated",
        notes: "Visible search exists, but privacy and gating layers make durable scraping harder.",
      }),
      buildSourceDescriptor({
        id: "catalog-wttj-france",
        name: "Welcome to the Jungle",
        url: "https://www.welcometothejungle.com/",
        kind: "mixed",
        parserHint: "generic-mixed",
        description: "High-visibility employer-brand and jobs ecosystem across France and Europe.",
        tags: ["mixed", "france", "employer-brand"],
        country: "FR",
        category: "private-board",
        prominence: "Major cross-country discovery surface.",
        readiness: "candidate",
        strategy: "public-search",
        notes: "Public listings are visible and useful for company context, but still need a typed adapter.",
      }),
    ],
  },
  {
    country: "DE",
    countryName: "Germany",
    overview: "Official public labor infrastructure plus dominant private boards.",
    primarySignal: "Use Bundesagentur for official coverage and StepStone for private-market breadth where access allows.",
    sources: [
      buildSourceDescriptor({
        id: "catalog-arbeitsagentur",
        name: "Bundesagentur für Arbeit",
        url: "https://www.arbeitsagentur.de/jobsuche/",
        kind: "jobs",
        parserHint: "generic-jobs",
        description: "German federal employment search portal.",
        tags: ["official", "germany", "public"],
        country: "DE",
        category: "national-portal",
        prominence: "National public labor-market source.",
        readiness: "restricted",
        strategy: "privacy-gated",
        notes: "Prominent, but first-contact scraping is obscured by cookie/privacy layers.",
      }),
      buildSourceDescriptor({
        id: "catalog-stepstone",
        name: "StepStone Germany",
        url: "https://www.stepstone.de/",
        kind: "jobs",
        parserHint: "generic-jobs",
        description: "One of Germany's dominant private job boards.",
        tags: ["private-board", "germany"],
        country: "DE",
        category: "private-board",
        prominence: "Private-market category leader.",
        readiness: "restricted",
        strategy: "privacy-gated",
        notes: "Highly relevant commercially, but a privacy gate blocks stable anonymous ingestion.",
      }),
    ],
  },
  {
    country: "NL",
    countryName: "Netherlands",
    overview: "Official employment infrastructure mixed with privacy-heavy commercial boards.",
    primarySignal: "Treat national boards as research candidates and lean on ATS employer pages for dependable structured data.",
    sources: [
      buildSourceDescriptor({
        id: "catalog-werk-nl",
        name: "Werk.nl",
        url: "https://www.werk.nl/",
        kind: "jobs",
        parserHint: "generic-jobs",
        description: "Official Dutch labor-market service surface.",
        tags: ["official", "netherlands"],
        country: "NL",
        category: "national-portal",
        prominence: "National public labor-market entrypoint.",
        readiness: "restricted",
        strategy: "login-gated",
        notes: "Search flows redirect into login-heavy paths, so this is not yet a dependable automated source.",
      }),
      buildSourceDescriptor({
        id: "catalog-nationale-vacaturebank",
        name: "Nationale Vacaturebank",
        url: "https://www.nationalevacaturebank.nl/",
        kind: "jobs",
        parserHint: "generic-jobs",
        description: "Large Dutch commercial job board.",
        tags: ["private-board", "netherlands"],
        country: "NL",
        category: "private-board",
        prominence: "Private-market coverage.",
        readiness: "restricted",
        strategy: "privacy-gated",
        notes: "Visible, but cookie/privacy flows dominate the first fetch path.",
      }),
    ],
  },
  {
    country: "BE",
    countryName: "Belgium",
    overview: "Regional public portals matter more than a single national source.",
    primarySignal: "Le Forem and VDAB cover different labor markets, so the country view should stay region-aware.",
    sources: [
      buildSourceDescriptor({
        id: "catalog-leforem",
        name: "Le Forem",
        url: "https://www.leforem.be/",
        kind: "jobs",
        parserHint: "generic-jobs",
        description: "Public Wallonia employment service with visible job volume.",
        tags: ["official", "belgium", "wallonia"],
        country: "BE",
        category: "national-portal",
        prominence: "Regional public labor-market source.",
        readiness: "candidate",
        strategy: "public-search",
        notes: "Public search pages are visible and promising for a stable adapter.",
      }),
      buildSourceDescriptor({
        id: "catalog-vdab",
        name: "VDAB",
        url: "https://www.vdab.be/",
        kind: "jobs",
        parserHint: "generic-jobs",
        description: "Public Flanders employment service.",
        tags: ["official", "belgium", "flanders"],
        country: "BE",
        category: "national-portal",
        prominence: "Regional public labor-market source.",
        readiness: "restricted",
        strategy: "privacy-gated",
        notes: "Relevant, but the first fetch path is still heavily cookie-driven.",
      }),
    ],
  },
  {
    country: "PL",
    countryName: "Poland",
    overview: "A strong mix of large general boards and tech-specialized platforms.",
    primarySignal: "Use Pracuj for broad visibility and No Fluff Jobs or Just Join IT for technology hiring.",
    sources: [
      buildSourceDescriptor({
        id: "catalog-pracuj",
        name: "Pracuj.pl",
        url: "https://www.pracuj.pl/",
        kind: "jobs",
        parserHint: "generic-jobs",
        description: "One of Poland's largest job boards.",
        tags: ["private-board", "poland"],
        country: "PL",
        category: "private-board",
        prominence: "General-market leader.",
        readiness: "restricted",
        strategy: "privacy-gated",
        notes: "Commercially important but the first fetch path is cookie-gated.",
      }),
      buildSourceDescriptor({
        id: "catalog-no-fluff-jobs",
        name: "No Fluff Jobs",
        url: "https://nofluffjobs.com/",
        kind: "jobs",
        parserHint: "generic-jobs",
        description: "Prominent salary-transparent technology hiring board.",
        tags: ["private-board", "poland", "tech"],
        country: "PL",
        category: "private-board",
        prominence: "Technology job-market specialist.",
        readiness: "restricted",
        strategy: "privacy-gated",
        notes: "High-value for tech market intelligence, but cookie gating blocks stable anonymous scraping.",
      }),
    ],
  },
  {
    country: "UK",
    countryName: "United Kingdom",
    overview: "Private commercial boards dominate, with high visible public result counts.",
    primarySignal: "Reed is immediately useful for broad demand scanning; other boards remain good follow-on sources.",
    sources: [
      buildSourceDescriptor({
        id: "catalog-reed",
        name: "Reed",
        url: "https://www.reed.co.uk/jobs",
        kind: "jobs",
        parserHint: "generic-jobs",
        description: "Large UK private board with visible search counts and detailed cards.",
        tags: ["private-board", "uk"],
        country: "UK",
        category: "private-board",
        prominence: "General-market leader.",
        readiness: "candidate",
        strategy: "public-search",
        notes: "Public search works and exposes filters/counts, so this is a strong next board adapter.",
      }),
      buildSourceDescriptor({
        id: "catalog-cv-library",
        name: "CV-Library",
        url: "https://www.cv-library.co.uk/",
        kind: "jobs",
        parserHint: "generic-jobs",
        description: "Major UK commercial job board.",
        tags: ["private-board", "uk"],
        country: "UK",
        category: "private-board",
        prominence: "General-market coverage.",
        readiness: "candidate",
        strategy: "public-search",
        notes: "Worth adapting after Reed because it is another large public board footprint.",
      }),
    ],
  },
  {
    country: "US",
    countryName: "United States",
    overview: "Official federal jobs plus anti-bot-heavy private platforms.",
    primarySignal: "USAJobs is the dependable official national source; private boards often require a different access strategy.",
    sources: [
      buildSourceDescriptor({
        id: "catalog-usajobs",
        name: "USAJobs",
        url: "https://www.usajobs.gov/",
        kind: "jobs",
        parserHint: "generic-jobs",
        description: "Official federal jobs portal.",
        tags: ["official", "us", "public"],
        country: "US",
        category: "national-portal",
        prominence: "Federal labor-market source.",
        readiness: "candidate",
        strategy: "public-search",
        notes: "Public search is visible and structured enough to support a dedicated adapter if federal hiring matters.",
      }),
      buildSourceDescriptor({
        id: "catalog-wellfound",
        name: "Wellfound",
        url: "https://wellfound.com/jobs",
        kind: "jobs",
        parserHint: "generic-jobs",
        description: "Startup-focused US jobs marketplace.",
        tags: ["private-board", "us", "startup"],
        country: "US",
        category: "private-board",
        prominence: "Startup and venture-backed hiring.",
        readiness: "restricted",
        strategy: "anti-bot",
        notes: "The public jobs surface returned 403 in research, so it needs a different ingestion approach.",
      }),
    ],
  },
  {
    country: "SE",
    countryName: "Sweden",
    overview: "Strong official labor-market infrastructure with visible open-data hooks.",
    primarySignal: "Platsbanken is the obvious Swedish anchor because it exposes both search and open-data signals.",
    sources: [
      buildSourceDescriptor({
        id: "catalog-platsbanken",
        name: "Platsbanken",
        url: "https://arbetsformedlingen.se/platsbanken",
        kind: "jobs",
        parserHint: "generic-jobs",
        description: "Swedish public jobs surface from Arbetsförmedlingen.",
        tags: ["official", "sweden", "public"],
        country: "SE",
        category: "national-portal",
        prominence: "Official national labor-market source.",
        readiness: "candidate",
        strategy: "official-api",
        notes: "Public search and open-data/API references are visible, making this a high-quality next adapter.",
      }),
    ],
  },
  {
    country: "NO",
    countryName: "Norway",
    overview: "Public national search with explicit API pathways.",
    primarySignal: "Arbeidsplassen is the strongest Norwegian source because it exposes public results and mentions ad-transfer APIs.",
    sources: [
      buildSourceDescriptor({
        id: "catalog-arbeidsplassen",
        name: "Arbeidsplassen",
        url: "https://arbeidsplassen.nav.no/stillinger",
        kind: "jobs",
        parserHint: "generic-jobs",
        description: "Norwegian national jobs search from NAV.",
        tags: ["official", "norway", "public"],
        country: "NO",
        category: "national-portal",
        prominence: "Official national labor-market source.",
        readiness: "candidate",
        strategy: "official-api",
        notes: "Public search results and API references make this one of the best next public-board integrations.",
      }),
    ],
  },
];

export function getGlobalAtsCatalog(): CuratedSourceDescriptor[] {
  return globalAtsPlatforms;
}

export function getCountrySourceCatalog(countries?: CountryCode[]): CountrySourceCatalog[] {
  if (!countries?.length) {
    return countrySourceCatalog;
  }

  const allow = new Set(countries);
  return countrySourceCatalog.filter((entry) => allow.has(entry.country));
}
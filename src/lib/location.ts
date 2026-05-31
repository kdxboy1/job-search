import type { Coordinates } from "./types";

const CITY_COORDINATES: Record<string, Coordinates> = {
  helsinki: { lat: 60.1699, lng: 24.9384 },
  espoo: { lat: 60.2055, lng: 24.6559 },
  vantaa: { lat: 60.2934, lng: 25.0378 },
  tampere: { lat: 61.4978, lng: 23.761 },
  turku: { lat: 60.4518, lng: 22.2666 },
  oulu: { lat: 65.0121, lng: 25.4651 },
  lahti: { lat: 60.9827, lng: 25.6615 },
  jyvaskyla: { lat: 62.2426, lng: 25.7473 },
  kuopio: { lat: 62.8924, lng: 27.677 },
};

const ALIASES: Record<string, string> = {
  "greater helsinki": "helsinki",
  "helsinki metropolitan area": "helsinki",
  hybrid: "remote",
  anywhere: "remote",
  finland: "finland",
};

export function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1).toLowerCase())
    .join(" ");
}

export function normalizeLocation(input: string): string {
  const value = input.trim().toLowerCase();

  if (!value) {
    return "Unspecified";
  }

  if (value.includes("remote")) {
    return "Remote";
  }

  for (const [alias, canonical] of Object.entries(ALIASES)) {
    if (!value.includes(alias)) {
      continue;
    }

    if (canonical === "remote") {
      return "Remote";
    }

    return titleCase(canonical);
  }

  for (const city of Object.keys(CITY_COORDINATES)) {
    if (value.includes(city)) {
      return titleCase(city);
    }
  }

  return titleCase(value.split(/[|,/]/)[0] ?? value);
}

export function detectLocationFromText(text: string): string {
  const value = text.toLowerCase();

  for (const city of Object.keys(CITY_COORDINATES)) {
    if (value.includes(city)) {
      return titleCase(city);
    }
  }

  if (value.includes("remote")) {
    return "Remote";
  }

  if (value.includes("finland")) {
    return "Finland";
  }

  return "Unspecified";
}

export function coordinatesForLocation(input: string): Coordinates | undefined {
  const normalized = normalizeLocation(input).toLowerCase();

  if (normalized === "remote" || normalized === "unspecified" || normalized === "finland") {
    return undefined;
  }

  return CITY_COORDINATES[normalized];
}
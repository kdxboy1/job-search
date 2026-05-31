import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { neon } from "@neondatabase/serverless";

import type {
  CompanyNoteRecord,
  CompanyNoteStatus,
  CountryCode,
  PlatformIntelligence,
  SavedSearchRecord,
  SnapshotHistoryRecord,
  SourceConfig,
  WorkspaceEnvelope,
  WorkspaceMode,
  WorkspacePreferences,
  WorkspaceState,
} from "./types";
import { dedupeBy, slugify } from "./utils";

const workspaceStatePath = path.join(process.cwd(), ".data", "herizon-workspace-state.json");
const databaseUrl =
  process.env.DATABASE_URL ??
  process.env.POSTGRES_URL ??
  process.env.NEON_DATABASE_URL ??
  null;

const sql = databaseUrl ? neon(databaseUrl) : null;

let tablesEnsured = false;

type FileWorkspaceStore = Record<string, WorkspaceState>;

const defaultPreferences: WorkspacePreferences = {
  mode: "pro",
  pinnedCountries: ["FI", "SE", "NO", "UK", "DE"],
};

function normalizePreferences(
  value: Partial<WorkspacePreferences> | undefined,
): WorkspacePreferences {
  return {
    mode: value?.mode ?? defaultPreferences.mode,
    pinnedCountries:
      value?.pinnedCountries?.length ? value.pinnedCountries : defaultPreferences.pinnedCountries,
  };
}

function normalizeWorkspaceState(raw: Partial<WorkspaceState> | null | undefined): WorkspaceState {
  return {
    customSources: dedupeBy(raw?.customSources ?? [], (source) => `${source.kind}:${source.url}`),
    savedSearches: [...(raw?.savedSearches ?? [])].sort((left, right) =>
      right.lastUsedAt.localeCompare(left.lastUsedAt),
    ),
    companyNotes: [...(raw?.companyNotes ?? [])].sort((left, right) =>
      right.updatedAt.localeCompare(left.updatedAt),
    ),
    snapshotHistory: [...(raw?.snapshotHistory ?? [])]
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, 30),
    preferences: normalizePreferences(raw?.preferences),
  };
}

async function ensureTables() {
  if (!sql || tablesEnsured) {
    return;
  }

  await sql`
    CREATE TABLE IF NOT EXISTS herizon_workspace_state (
      user_key TEXT PRIMARY KEY,
      state JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  tablesEnsured = true;
}

async function readFileStore(): Promise<FileWorkspaceStore> {
  try {
    const content = await readFile(workspaceStatePath, "utf8");
    return JSON.parse(content) as FileWorkspaceStore;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {};
    }

    throw error;
  }
}

async function writeFileStore(store: FileWorkspaceStore) {
  await mkdir(path.dirname(workspaceStatePath), { recursive: true });
  await writeFile(workspaceStatePath, JSON.stringify(store, null, 2), "utf8");
}

async function readStateFromPersistence(userKey: string): Promise<WorkspaceEnvelope> {
  if (sql) {
    await ensureTables();
    const rows = (await sql`
      SELECT state
      FROM herizon_workspace_state
      WHERE user_key = ${userKey}
      LIMIT 1
    `) as Array<{ state: WorkspaceState }>;

    return {
      state: normalizeWorkspaceState(rows[0]?.state),
      driver: "neon",
      canUseDatabase: true,
    };
  }

  const store = await readFileStore();

  return {
    state: normalizeWorkspaceState(store[userKey]),
    driver: "file",
    canUseDatabase: false,
  };
}

async function writeStateToPersistence(
  userKey: string,
  state: WorkspaceState,
): Promise<WorkspaceEnvelope["driver"]> {
  if (sql) {
    await ensureTables();
    await sql`
      INSERT INTO herizon_workspace_state (user_key, state, updated_at)
      VALUES (${userKey}, ${JSON.stringify(state)}::jsonb, NOW())
      ON CONFLICT (user_key)
      DO UPDATE SET state = EXCLUDED.state, updated_at = NOW()
    `;
    return "neon";
  }

  const store = await readFileStore();
  store[userKey] = state;
  await writeFileStore(store);
  return "file";
}

export async function getWorkspaceEnvelope(userKey: string): Promise<WorkspaceEnvelope> {
  return readStateFromPersistence(userKey);
}

export async function updateWorkspaceEnvelope(
  userKey: string,
  updater: (state: WorkspaceState) => WorkspaceState,
): Promise<WorkspaceEnvelope> {
  const current = await readStateFromPersistence(userKey);
  const nextState = normalizeWorkspaceState(updater(current.state));
  const driver = await writeStateToPersistence(userKey, nextState);

  return {
    state: nextState,
    driver,
    canUseDatabase: current.canUseDatabase,
  };
}

export async function setCustomSources(
  userKey: string,
  customSources: SourceConfig[],
): Promise<WorkspaceEnvelope> {
  return updateWorkspaceEnvelope(userKey, (state) => ({
    ...state,
    customSources,
  }));
}

export async function setWorkspacePreferences(
  userKey: string,
  preferences: Partial<WorkspacePreferences>,
): Promise<WorkspaceEnvelope> {
  return updateWorkspaceEnvelope(userKey, (state) => ({
    ...state,
    preferences: normalizePreferences({ ...state.preferences, ...preferences }),
  }));
}

export async function saveSearchRecord(
  userKey: string,
  payload: {
    query: string;
    label?: string;
    countryCodes?: CountryCode[];
    mode?: WorkspaceMode;
  },
): Promise<WorkspaceEnvelope> {
  const now = new Date().toISOString();

  return updateWorkspaceEnvelope(userKey, (state) => {
    const existing = state.savedSearches.find(
      (search) => search.query.toLowerCase() === payload.query.trim().toLowerCase(),
    );
    const nextRecord: SavedSearchRecord = existing
      ? {
          ...existing,
          label: payload.label?.trim() || existing.label,
          lastUsedAt: now,
          countryCodes: payload.countryCodes?.length ? payload.countryCodes : existing.countryCodes,
          mode: payload.mode ?? existing.mode,
        }
      : {
          id: crypto.randomUUID(),
          query: payload.query.trim(),
          label: payload.label?.trim() || payload.query.trim(),
          createdAt: now,
          lastUsedAt: now,
          countryCodes: payload.countryCodes?.length ? payload.countryCodes : [],
          mode: payload.mode ?? state.preferences.mode,
        };

    return {
      ...state,
      savedSearches: dedupeBy(
        [nextRecord, ...state.savedSearches.filter((search) => search.id !== nextRecord.id)],
        (search) => search.id,
      ).slice(0, 20),
    };
  });
}

export async function deleteSearchRecord(
  userKey: string,
  id: string,
): Promise<WorkspaceEnvelope> {
  return updateWorkspaceEnvelope(userKey, (state) => ({
    ...state,
    savedSearches: state.savedSearches.filter((search) => search.id !== id),
  }));
}

export async function upsertCompanyNote(
  userKey: string,
  payload: {
    id?: string;
    companyId?: string;
    companySlug: string;
    companyName: string;
    body: string;
    nextAction?: string;
    status?: CompanyNoteStatus;
    tags?: string[];
  },
): Promise<WorkspaceEnvelope> {
  const now = new Date().toISOString();

  return updateWorkspaceEnvelope(userKey, (state) => {
    const noteId = payload.id ?? crypto.randomUUID();
    const note: CompanyNoteRecord = {
      id: noteId,
      companyId: payload.companyId,
      companySlug: payload.companySlug || slugify(payload.companyName),
      companyName: payload.companyName,
      body: payload.body.trim(),
      nextAction: payload.nextAction?.trim() || undefined,
      status: payload.status ?? "prospect",
      tags: payload.tags?.filter(Boolean) ?? [],
      createdAt:
        state.companyNotes.find((existing) => existing.id === noteId)?.createdAt ?? now,
      updatedAt: now,
    };

    return {
      ...state,
      companyNotes: [
        note,
        ...state.companyNotes.filter((existing) => existing.id !== note.id),
      ].slice(0, 120),
    };
  });
}

function buildSnapshotSummary(intelligence: PlatformIntelligence): SnapshotHistoryRecord {
  const topTechnology = intelligence.analytics.byTechnology[0]?.label;
  const topLocation = intelligence.analytics.byLocation[0]?.label;

  return {
    id: crypto.randomUUID(),
    createdAt: intelligence.generatedAt,
    totalJobs: intelligence.analytics.totalJobs,
    sampledJobs: intelligence.analytics.sampledJobs,
    totalCompanies: intelligence.analytics.totalCompanies,
    liveSources: intelligence.analytics.liveSources,
    fallbackSources: intelligence.analytics.fallbackSources,
    topTechnology,
    topLocation,
    summary: topTechnology
      ? `${intelligence.analytics.totalJobs.toLocaleString()} openings tracked; ${topTechnology} led the sampled fact base.`
      : `${intelligence.analytics.totalJobs.toLocaleString()} openings tracked across ${intelligence.analytics.liveSources} live sources.`,
  };
}

export async function recordSnapshotHistory(
  userKey: string,
  intelligence: PlatformIntelligence,
): Promise<WorkspaceEnvelope> {
  return updateWorkspaceEnvelope(userKey, (state) => {
    const nextSnapshot = buildSnapshotSummary(intelligence);
    const latest = state.snapshotHistory[0];

    if (
      latest &&
      latest.summary === nextSnapshot.summary &&
      latest.totalJobs === nextSnapshot.totalJobs &&
      latest.sampledJobs === nextSnapshot.sampledJobs &&
      Date.parse(nextSnapshot.createdAt) - Date.parse(latest.createdAt) < 1000 * 60 * 20
    ) {
      return state;
    }

    return {
      ...state,
      snapshotHistory: [nextSnapshot, ...state.snapshotHistory].slice(0, 24),
    };
  });
}
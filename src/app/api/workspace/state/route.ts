import { NextResponse } from "next/server";
import { z } from "zod";

import {
  deleteSearchRecord,
  getWorkspaceEnvelope,
  saveSearchRecord,
  setCustomSources,
  setWorkspacePreferences,
  upsertCompanyNote,
} from "@/lib/persistence";
import {
  CountryCodeSchema,
  hydrateSourceConfig,
  SourceConfigSchema,
  WorkspaceModeSchema,
} from "@/lib/types";
import { PUBLIC_WORKSPACE_KEY } from "@/lib/workspace-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const workspaceActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("set-custom-sources"),
    customSources: z.array(SourceConfigSchema).max(20),
  }),
  z.object({
    action: z.literal("set-preferences"),
    preferences: z.object({
      mode: WorkspaceModeSchema.optional(),
      pinnedCountries: z.array(CountryCodeSchema).max(10).optional(),
    }),
  }),
  z.object({
    action: z.literal("save-search"),
    query: z.string().min(1).max(240),
    label: z.string().min(1).max(120).optional(),
    countryCodes: z.array(CountryCodeSchema).max(10).optional(),
    mode: WorkspaceModeSchema.optional(),
  }),
  z.object({
    action: z.literal("delete-search"),
    id: z.string().min(1),
  }),
  z.object({
    action: z.literal("upsert-note"),
    note: z.object({
      id: z.string().optional(),
      companyId: z.string().optional(),
      companySlug: z.string().min(1),
      companyName: z.string().min(1),
      body: z.string().min(1).max(4000),
      nextAction: z.string().max(240).optional(),
      status: z.enum(["prospect", "contacted", "responded", "paused"]).optional(),
      tags: z.array(z.string().min(1).max(40)).max(8).optional(),
    }),
  }),
]);

function getUserKey() {
  return PUBLIC_WORKSPACE_KEY;
}

export async function GET() {
  const userKey = getUserKey();
  const workspace = await getWorkspaceEnvelope(userKey);
  return NextResponse.json(workspace);
}

export async function PATCH(request: Request) {
  const userKey = getUserKey();
  const rawBody = await request.json().catch(() => ({}));
  const parsed = workspaceActionSchema.safeParse(rawBody);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid workspace action." }, { status: 400 });
  }

  switch (parsed.data.action) {
    case "set-custom-sources": {
      const workspace = await setCustomSources(
        userKey,
        parsed.data.customSources.map((source) => hydrateSourceConfig(source)),
      );
      return NextResponse.json(workspace);
    }
    case "set-preferences": {
      const workspace = await setWorkspacePreferences(userKey, parsed.data.preferences);
      return NextResponse.json(workspace);
    }
    case "save-search": {
      const workspace = await saveSearchRecord(userKey, parsed.data);
      return NextResponse.json(workspace);
    }
    case "delete-search": {
      const workspace = await deleteSearchRecord(userKey, parsed.data.id);
      return NextResponse.json(workspace);
    }
    case "upsert-note": {
      const workspace = await upsertCompanyNote(userKey, parsed.data.note);
      return NextResponse.json(workspace);
    }
  }
}
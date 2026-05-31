import { NextResponse } from "next/server";
import { z } from "zod";

import { recordSnapshotHistory } from "@/lib/persistence";
import { collectPlatformIntelligence } from "@/lib/platform";
import { defaultSources } from "@/lib/seed";
import { hydrateSourceConfig, SourceConfigSchema } from "@/lib/types";
import { PUBLIC_WORKSPACE_KEY } from "@/lib/workspace-access";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({
  sources: z.array(SourceConfigSchema).min(1).max(12).optional(),
});

export async function GET() {
  const intelligence = await collectPlatformIntelligence(defaultSources);
  return NextResponse.json(intelligence);
}

export async function POST(request: Request) {
  const rawBody = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(rawBody);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid sources payload." }, { status: 400 });
  }

  const sources = parsed.data.sources?.map((source) => hydrateSourceConfig(source)) ?? defaultSources;
  const intelligence = await collectPlatformIntelligence(sources);
  await recordSnapshotHistory(PUBLIC_WORKSPACE_KEY, intelligence);

  return NextResponse.json(intelligence);
}
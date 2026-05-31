import { NextResponse } from "next/server";
import { z } from "zod";

import { buildOutreachPlan, collectPlatformIntelligence, findCompanyById } from "@/lib/platform";
import { defaultSources } from "@/lib/seed";
import { hydrateSourceConfig, SourceConfigSchema } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({
  companyId: z.string().min(1),
  sources: z.array(SourceConfigSchema).min(1).max(12).optional(),
});

export async function POST(request: Request) {
  const rawBody = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(rawBody);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid outreach request." }, { status: 400 });
  }

  const sources = parsed.data.sources?.map((source) => hydrateSourceConfig(source)) ?? defaultSources;
  const intelligence = await collectPlatformIntelligence(sources);
  const company = findCompanyById(intelligence, parsed.data.companyId);

  if (!company) {
    return NextResponse.json({ error: "Company not found in current intelligence." }, { status: 404 });
  }

  return NextResponse.json(buildOutreachPlan(company, intelligence));
}
import { NextResponse } from "next/server";
import { z } from "zod";

import { answerGroundedQuestion } from "@/lib/copilot";
import { collectPlatformIntelligence } from "@/lib/platform";
import { defaultSources } from "@/lib/seed";
import { hydrateSourceConfig, SourceConfigSchema } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({
  question: z.string().min(4),
  sources: z.array(SourceConfigSchema).min(1).max(12).optional(),
});

export async function POST(request: Request) {
  const rawBody = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(rawBody);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid copilot request." }, { status: 400 });
  }

  const sources = parsed.data.sources?.map((source) => hydrateSourceConfig(source)) ?? defaultSources;
  const intelligence = await collectPlatformIntelligence(sources);
  const answer = await answerGroundedQuestion(parsed.data.question, intelligence);

  return NextResponse.json(answer);
}
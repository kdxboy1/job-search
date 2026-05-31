import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { Dashboard } from "@/components/dashboard";
import { SiteHeader } from "@/components/site-header";
import { getWorkspaceEnvelope, recordSnapshotHistory } from "@/lib/persistence";
import { collectPlatformIntelligence } from "@/lib/platform";
import { defaultSources } from "@/lib/seed";
import { countrySourceCatalog } from "@/lib/source-catalog";
import { dedupeBy } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function WorkspacePage() {
  const session = await auth();

  if (!session?.user?.email) {
    redirect("/login?callbackUrl=/workspace");
  }

  const workspace = await getWorkspaceEnvelope(session.user.email);
  const sources = dedupeBy(
    [...defaultSources, ...workspace.state.customSources],
    (source) => `${source.kind}:${source.url}`,
  );
  const intelligence = await collectPlatformIntelligence(sources);
  const nextWorkspace = await recordSnapshotHistory(session.user.email, intelligence);

  return (
    <main className="pb-16">
      <SiteHeader authenticated userName={session.user.name} />
      <Dashboard
        baseSources={defaultSources}
        currentUser={{ email: session.user.email, name: session.user.name }}
        initialData={intelligence}
        initialWorkspace={nextWorkspace}
        sourceCatalog={countrySourceCatalog}
      />
    </main>
  );
}
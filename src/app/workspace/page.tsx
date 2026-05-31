import { Dashboard } from "@/components/dashboard";
import { SiteHeader } from "@/components/site-header";
import { getWorkspaceEnvelope, recordSnapshotHistory } from "@/lib/persistence";
import { collectPlatformIntelligence } from "@/lib/platform";
import { defaultSources } from "@/lib/seed";
import { countrySourceCatalog } from "@/lib/source-catalog";
import { dedupeBy } from "@/lib/utils";
import { PUBLIC_WORKSPACE_KEY, PUBLIC_WORKSPACE_NAME } from "@/lib/workspace-access";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function WorkspacePage() {
  const workspace = await getWorkspaceEnvelope(PUBLIC_WORKSPACE_KEY);
  const sources = dedupeBy(
    [...defaultSources, ...workspace.state.customSources],
    (source) => `${source.kind}:${source.url}`,
  );
  const intelligence = await collectPlatformIntelligence(sources);
  const nextWorkspace = await recordSnapshotHistory(PUBLIC_WORKSPACE_KEY, intelligence);

  return (
    <main className="pb-16">
      <SiteHeader />
      <Dashboard
        baseSources={defaultSources}
        currentUser={{ email: null, name: PUBLIC_WORKSPACE_NAME }}
        initialData={intelligence}
        initialWorkspace={nextWorkspace}
        sourceCatalog={countrySourceCatalog}
      />
    </main>
  );
}
import { Dashboard } from "@/components/dashboard";
import { collectPlatformIntelligence } from "@/lib/platform";
import { defaultSources } from "@/lib/seed";

export const dynamic = "force-dynamic";

export default async function Home() {
  const intelligence = await collectPlatformIntelligence(defaultSources);

  return <Dashboard initialData={intelligence} />;
}

import { AppShell } from "@/components/app-shell";
import { ModelsMarketplace } from "@/components/models-marketplace";
import { listRuntimeModels } from "@/lib/model-store";
import { getInternalUsdPkr } from "@/lib/pricing";

export const dynamic = "force-dynamic";

export default async function Page() {
  const [models, fxRate] = await Promise.all([listRuntimeModels(), getInternalUsdPkr()]);
  return <AppShell><div className="model-marketplace-page"><ModelsMarketplace models={models} fxRate={fxRate} /></div></AppShell>;
}

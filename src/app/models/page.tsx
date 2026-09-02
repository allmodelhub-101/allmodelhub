import { AppShell } from "@/components/app-shell";
import { ModelsMarketplace } from "@/components/models-marketplace";
import { listRuntimeModels } from "@/lib/model-store";
import { getInternalUsdPkr } from "@/lib/pricing";

export const dynamic = "force-dynamic";

export default async function Page() {
  const [models, fxRate] = await Promise.all([listRuntimeModels(), getInternalUsdPkr()]);
  return <AppShell><div className="marketplace-intro"><div className="kicker">Model marketplace</div><h1 className="page-title">Choose intelligence that fits the work</h1><p className="muted">A focused catalog of capable models for writing, images, motion, and sound. Pick a tier, choose a tool, and get straight to work.</p></div><ModelsMarketplace models={models} fxRate={fxRate} /></AppShell>;
}

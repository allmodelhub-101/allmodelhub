import { AppShell } from "@/components/app-shell";
import { ModelsMarketplace } from "@/components/models-marketplace";
import { listRuntimeModels } from "@/lib/model-store";
import { creditsFromUsd, getInternalUsdPkr } from "@/lib/pricing";
import type { CatalogModel } from "@/lib/models";

export const dynamic = "force-dynamic";

function displayPrice(model: CatalogModel, fxRate: number) {
  if (model.inputUsdPerMillion) return `From ${creditsFromUsd(model.inputUsdPerMillion, model.markup, fxRate).toFixed(2)} Credits / 1M input tokens`;
  if (model.flatUsd) return `From ${creditsFromUsd(model.flatUsd, model.markup, fxRate).toFixed(2)} Credits / generation`;
  if (model.perSecondUsd) return `From ${creditsFromUsd(model.perSecondUsd, model.markup, fxRate).toFixed(2)} Credits / second`;
  if (model.per1kCharsUsd) return `From ${creditsFromUsd(model.per1kCharsUsd, model.markup, fxRate).toFixed(2)} Credits / 1K characters`;
  return "Usage based";
}

export default async function Page() {
  const [models, fxRate] = await Promise.all([listRuntimeModels(), getInternalUsdPkr()]);
  return <AppShell><div className="marketplace-intro"><div className="kicker">Model marketplace</div><h1 className="page-title">Choose intelligence that fits the work</h1><p className="muted">Compare the active runtime catalog by capability, modality, tier, and transparent usage pricing.</p></div><ModelsMarketplace models={models} fxRate={fxRate} displayPrice={displayPrice} /></AppShell>;
}

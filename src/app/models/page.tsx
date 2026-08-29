import Link from "next/link";
import { AppShell } from "@/components/app-shell";
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
  return <AppShell><div style={{ marginBottom: 20 }}><div className="kicker">Runtime catalog</div><h1 className="page-title">Choose the intelligence you need</h1><p className="muted">All Model Hub keeps the normal experience simple with Budget, Balanced, Premium and Flagship tiers. Power users can select an exact active model.</p></div><div className="model-grid">{models.map((model) => <article key={model.id} className="card model-card"><div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}><span className={`tier tier-${model.tier}`}>{model.tier}</span><span className="muted small">{model.modality}</span></div><h3>{model.name}</h3><p>{model.description}</p><div className="capability-row">{model.capabilities.slice(0, 5).map((capability) => <span className="mini-chip" key={capability}>{capability}</span>)}</div><div className="soft-card small" style={{ padding: 10 }}>{displayPrice(model, fxRate)}</div>{model.modality === "text" ? <Link className="btn btn-primary" href={`/chat?model=${encodeURIComponent(model.id)}`}>Use exact model</Link> : <Link className="btn btn-primary" href={model.modality === "image" ? `/images?model=${encodeURIComponent(model.id)}` : model.modality === "video" ? `/video?model=${encodeURIComponent(model.id)}` : `/audio?model=${encodeURIComponent(model.id)}`}>Open studio</Link>}</article>)}</div></AppShell>;
}

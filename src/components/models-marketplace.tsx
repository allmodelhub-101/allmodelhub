"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { CatalogModel } from "@/lib/models";
import { creditsFromUsd } from "@/lib/pricing";

type Props = { models: CatalogModel[]; fxRate: number };
const modalities = ["all", "text", "image", "video", "audio"] as const;
const tiers = ["all", "budget", "balanced", "premium", "flagship"] as const;

function costLabel(model: CatalogModel, fxRate: number) {
  const usd = model.inputUsdPerMillion ?? model.flatUsd ?? model.perSecondUsd ?? model.per1kCharsUsd ?? 0;
  const credits = creditsFromUsd(usd, model.markup, fxRate);
  if (credits <= 1) return "Low";
  if (credits <= 10) return "Medium";
  if (credits <= 50) return "High";
  return "Premium";
}

function bestFor(model: CatalogModel) {
  if (model.modality === "image") return ["Visual concepts", "Editing", "Creative assets"];
  if (model.modality === "video") return ["Motion design", "Social content", "Cinematic scenes"];
  if (model.modality === "audio") return model.capabilities.includes("music") ? ["Music creation", "Vocals", "Soundtracks"] : ["Voiceover", "Localization", "Sound design"];
  const items = model.capabilities.includes("coding") ? ["Coding", "Architecture", "Technical work"] : ["Writing", "Research", "Everyday work"];
  return items;
}

function speedLabel(model: CatalogModel) {
  if (model.tier === "budget" || model.capabilities.includes("fast")) return "Fast";
  if (model.tier === "balanced") return "Medium";
  return "Advanced";
}

function titleCase(value: string) { return value[0].toUpperCase() + value.slice(1); }

export function ModelsMarketplace({ models, fxRate }: Props) {
  const [modality, setModality] = useState<(typeof modalities)[number]>("all");
  const [tier, setTier] = useState<(typeof tiers)[number]>("all");
  const filtered = useMemo(() => models.filter((model) => (modality === "all" || model.modality === modality) && (tier === "all" || model.tier === tier)), [models, modality, tier]);
  const hrefFor = (model: CatalogModel) => model.modality === "text" ? `/chat?model=${encodeURIComponent(model.id)}` : `/${model.modality === "image" ? "images" : model.modality === "video" ? "video" : "audio"}?model=${encodeURIComponent(model.id)}`;
  return <div className="marketplace">
    <div className="marketplace-controls glass">
      <div className="filter-group" role="group" aria-label="Filter by capability"><span className="filter-label">Capability</span>{modalities.map((item) => <button type="button" key={item} className={`mode-pill ${modality === item ? "active" : ""}`} aria-pressed={modality === item} onClick={() => setModality(item)}>{titleCase(item)}</button>)}</div>
      <div className="filter-group" role="group" aria-label="Filter by tier"><span className="filter-label">Tier</span>{tiers.map((item) => <button type="button" key={item} className={`mode-pill ${tier === item ? "active" : ""}`} aria-pressed={tier === item} onClick={() => setTier(item)}>{titleCase(item)}</button>)}</div>
    </div>
    <div className="marketplace-heading"><div><span className="kicker">Runtime catalog</span><h2>Every model, one workspace</h2></div><span className="muted small">{filtered.length} models</span></div>
    {filtered.length > 0 ? <div className="model-grid">{filtered.map((model) => <ModelCard key={model.id} model={model} fxRate={fxRate} href={hrefFor(model)} />)}</div> : <div className="card marketplace-empty"><h3>No models match these filters</h3><p className="muted">Try another capability or tier.</p></div>}
  </div>;
}

function ModelCard({ model, fxRate, href }: { model: CatalogModel; fxRate: number; href: string }) {
  const bullets = bestFor(model);
  return <article className="card glass model-card">
    <div className="model-card-top"><span className={`tier tier-${model.tier}`}>{titleCase(model.tier)}</span><span className="category-badge">{titleCase(model.modality)}</span></div>
    <div className="model-card-title"><div><h3>{model.name}</h3><p className="muted small">{model.providerFamily}</p></div><span className="model-signal" aria-label="Available" /></div>
    <div className="model-details">
      <div><span className="detail-label">Best for</span><ul>{bullets.map((item) => <li key={item}>{item}</li>)}</ul></div>
      <div className="detail-row"><span className="detail-label">Speed</span><strong>{speedLabel(model)}</strong></div>
      <div className="detail-row"><span className="detail-label">Cost</span><strong>{costLabel(model, fxRate)}</strong></div>
    </div>
    <Link className="btn btn-primary model-action" href={href}>{model.modality === "text" ? "Use Model" : "Open Studio"}<span aria-hidden="true">↗</span></Link>
  </article>;
}

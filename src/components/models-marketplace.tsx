"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { CatalogModel } from "@/lib/models";
import { creditsFromUsd } from "@/lib/pricing";

type Props = { models: CatalogModel[]; fxRate: number };
const modalities = ["all", "text", "image", "video", "audio"] as const;
const tiers = ["all", "budget", "balanced", "premium", "flagship"] as const;

function displayPrice(model: CatalogModel, fxRate: number) {
  const credits = model.inputUsdPerMillion
    ? creditsFromUsd(model.inputUsdPerMillion, model.markup, fxRate)
    : model.flatUsd
      ? creditsFromUsd(model.flatUsd, model.markup, fxRate)
      : model.perSecondUsd
        ? creditsFromUsd(model.perSecondUsd, model.markup, fxRate)
        : model.per1kCharsUsd
          ? creditsFromUsd(model.per1kCharsUsd, model.markup, fxRate)
          : null;

  if (credits === null) return "Usage based";
  if (credits <= 1) return "Low cost";
  if (credits <= 10) return "Balanced cost";
  if (credits <= 50) return "Premium";
  return `≈ ${credits.toFixed(0)} credits per request`;
}

export function ModelsMarketplace({ models, fxRate }: Props) {
  const [modality, setModality] = useState<(typeof modalities)[number]>("all");
  const [tier, setTier] = useState<(typeof tiers)[number]>("all");
  const featured = useMemo(() => models.filter((model) => model.tier === "flagship" || model.tier === "premium").slice(0, 3), [models]);
  const filtered = useMemo(() => models.filter((model) => (modality === "all" || model.modality === modality) && (tier === "all" || model.tier === tier)), [models, modality, tier]);
  const hrefFor = (model: CatalogModel) => model.modality === "text" ? `/chat?model=${encodeURIComponent(model.id)}` : `/${model.modality === "image" ? "images" : model.modality === "video" ? "video" : "audio"}?model=${encodeURIComponent(model.id)}`;
  return <div className="marketplace">
    <div className="marketplace-controls glass"><div className="filter-group" role="group" aria-label="Filter by capability"><span className="filter-label">Capability</span>{modalities.map((item) => <button type="button" key={item} className={`mode-pill ${modality === item ? "active" : ""}`} aria-pressed={modality === item} onClick={() => setModality(item)}>{item[0].toUpperCase() + item.slice(1)}</button>)}</div><div className="filter-group" role="group" aria-label="Filter by tier"><span className="filter-label">Tier</span>{tiers.map((item) => <button type="button" key={item} className={`mode-pill ${tier === item ? "active" : ""}`} aria-pressed={tier === item} onClick={() => setTier(item)}>{item[0].toUpperCase() + item.slice(1)}</button>)}</div></div>
    {modality === "all" && tier === "all" && <section className="featured-models"><div className="section-label"><span className="kicker">Curated frontier</span><h2>Featured models</h2><p className="muted">The strongest tools in the catalog, ready for ambitious work.</p></div><div className="featured-grid">{featured.map((model) => <ModelCard key={model.id} model={model} fxRate={fxRate}  href={hrefFor(model)} featured />)}</div></section>}
    <div className="marketplace-heading"><div><span className="kicker">Runtime catalog</span><h2>Every model, one workspace</h2></div><span className="muted small">{filtered.length} models</span></div><div className="model-grid">{filtered.map((model) => <ModelCard key={model.id} model={model} fxRate={fxRate}  href={hrefFor(model)} />)}</div>
  </div>;
}

function ModelCard({ model, fxRate, href, featured = false }: { model: CatalogModel; fxRate: number; href: string; featured?: boolean }) {
  return <article className={`card glass model-card ${featured ? "model-card-featured" : ""}`}><div className="model-card-top"><span className={`tier tier-${model.tier}`}>{model.tier}</span><span className="category-badge">{model.modality}</span></div><div className="model-card-title"><div><h3>{model.name}</h3><p className="muted small">{model.providerFamily}</p></div><span className="model-signal" aria-label={`${model.tier} tier`} /></div><p className="model-description">{model.description}</p><div className="capability-row">{model.capabilities.slice(0, 5).map((capability) => <span className="mini-chip" key={capability}>{capability}</span>)}</div><div className="model-price"><span className="muted small">Pricing</span><strong>{displayPrice(model, fxRate)}</strong></div><Link className="btn btn-primary" href={href}>{model.modality === "text" ? "Use model" : "Open studio"}<span aria-hidden="true">↗</span></Link></article>;
}

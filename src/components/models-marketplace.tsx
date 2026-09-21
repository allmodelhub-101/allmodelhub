"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CaretDown, ChatCircle, ImageSquare, MagnifyingGlass, SlidersHorizontal, SquaresFour, VideoCamera, Waveform } from "@phosphor-icons/react";
import { ModelBrand } from "@/components/model-brand";
import type { CatalogModel } from "@/lib/models";
import { creditsFromUsd } from "@/lib/pricing";

type Props = { models: CatalogModel[]; fxRate: number };
const modalities = ["all", "text", "image", "video", "audio"] as const;
const tiers = ["all", "budget", "balanced", "premium", "flagship"] as const;
type Sort = "recommended" | "price" | "name";

function creditEstimate(model: CatalogModel, fxRate: number) {
  return creditsFromUsd(model.inputUsdPerMillion ?? model.flatUsd ?? model.perSecondUsd ?? model.per1kCharsUsd ?? 0, model.markup, fxRate);
}

function costLabel(model: CatalogModel) {
  if (model.tier === "budget") return "Budget-friendly";
  if (model.tier === "balanced") return "Medium";
  if (model.tier === "premium") return "Premium";
  return "Flagship";
}

function bestFor(model: CatalogModel) {
  if (model.modality === "image") return ["Visual concepts and art", "Editing and variations", "Marketing assets"];
  if (model.modality === "video") return ["Short films and clips", "Creative video content", "Motion design"];
  if (model.modality === "audio") return model.capabilities.includes("music") ? ["Music creation", "Vocals and songs", "Soundtracks"] : ["Voice generation", "Podcasts and narration", "Content localization"];
  return model.capabilities.includes("coding") ? ["Coding and architecture", "Technical tasks", "Complex workflows"] : ["Writing and content creation", "Research and analysis", "Everyday work"];
}

function speedLabel(model: CatalogModel) {
  if (model.tier === "budget" || model.capabilities.some((item) => item.toLowerCase() === "fast")) return "Fast";
  if (model.tier === "balanced") return "Balanced";
  return "Advanced";
}

function titleCase(value: string) { return value[0].toUpperCase() + value.slice(1); }

function HeroStat({ icon: Icon, value, label, detail }: { icon: typeof SquaresFour; value: string | number; label: string; detail: string }) {
  return <div className="marketplace-stat"><span className="marketplace-stat-icon"><Icon weight="duotone" aria-hidden="true" /></span><span><strong>{value}</strong><b>{label}</b><small>{detail}</small></span></div>;
}

const heroTiles = [
  { label: "Text", icon: ChatCircle, tone: "text" },
  { label: "Image", icon: ImageSquare, tone: "image" },
  { label: "Video", icon: VideoCamera, tone: "video" },
  { label: "Audio", icon: Waveform, tone: "audio" }
] as const;

export function ModelsMarketplace({ models, fxRate }: Props) {
  const [modality, setModality] = useState<(typeof modalities)[number]>("all");
  const [tier, setTier] = useState<(typeof tiers)[number]>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("recommended");
  const capabilityCount = new Set(models.map((model) => model.modality)).size;
  const providerCount = new Set(models.map((model) => model.providerFamily)).size;
  const providerDetail = [...new Set(models.map((model) => model.providerFamily))].slice(0, 3).join(", ");
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return models.filter((model) => (
      (modality === "all" || model.modality === modality) &&
      (tier === "all" || model.tier === tier) &&
      (!needle || `${model.name} ${model.providerFamily} ${model.description} ${model.capabilities.join(" ")}`.toLowerCase().includes(needle))
    )).sort((a, b) => (
      sort === "price" ? creditEstimate(a, fxRate) - creditEstimate(b, fxRate) :
        sort === "name" ? a.name.localeCompare(b.name) :
          Number(Boolean(b.autoEligible)) - Number(Boolean(a.autoEligible)) || a.name.localeCompare(b.name)
    ));
  }, [models, modality, tier, query, sort, fxRate]);
  const hrefFor = (model: CatalogModel) => model.modality === "text" ? `/chat?model=${encodeURIComponent(model.id)}` : `/${model.modality === "image" ? "images" : model.modality === "video" ? "video" : "audio"}?model=${encodeURIComponent(model.id)}`;

  return <div className="marketplace">
    <section className="models-marketplace-hero" aria-labelledby="models-marketplace-title">
      <div className="models-hero-copy">
        <span className="kicker">Model marketplace</span>
        <h1 id="models-marketplace-title">Choose intelligence that fits the work</h1>
        <p>A focused catalog of capable models for writing, images, motion, and sound. Pick a tier, choose a tool, and get straight to work.</p>
        <div className="marketplace-stats marketplace-stats-desktop">
          <HeroStat icon={SquaresFour} value={models.length} label="models" detail="in one workspace" />
          <HeroStat icon={SquaresFour} value={capabilityCount} label="capabilities" detail="text, image, video, audio" />
          <HeroStat icon={SquaresFour} value={providerCount} label="top providers" detail={providerDetail || "Available providers"} />
        </div>
      </div>
      <div className="models-hero-art" aria-hidden="true">
        <span className="hero-orbit hero-orbit-one" /><span className="hero-orbit hero-orbit-two" />
        <div className="hero-tile-grid">{heroTiles.map(({ label, icon: Icon, tone }) => <span key={label} className={`hero-capability-tile ${tone}`}><Icon weight="duotone" /><b>{label}</b></span>)}</div>
        <span className="hero-note">More<br />Possibilities<br />Together</span>
      </div>
    </section>

    <section className="marketplace-controls glass" aria-label="Browse models">
      <div className="model-search-row">
        <label className="model-search"><MagnifyingGlass size={17} aria-hidden="true" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search models, providers or capabilities…" aria-label="Search models" /></label>
        <label className="model-sort"><span className="model-sort-label"><SlidersHorizontal aria-hidden="true" weight="bold" /><small>Sort by</small></span><select value={sort} onChange={(event) => setSort(event.target.value as Sort)} aria-label="Sort models"><option value="recommended">Recommended</option><option value="price">Lowest estimated cost</option><option value="name">Name</option></select><CaretDown className="model-sort-caret" aria-hidden="true" weight="bold" /></label>
      </div>
      <div className="marketplace-filter-row">
        <div className="filter-group" role="group" aria-label="Filter by capability"><span className="filter-label">Capability</span>{modalities.map((item) => <button type="button" key={item} className={`mode-pill ${modality === item ? "active" : ""}`} aria-pressed={modality === item} onClick={() => setModality(item)}>{titleCase(item)}</button>)}</div>
        <div className="marketplace-tier-cluster"><div className="filter-group" role="group" aria-label="Filter by tier"><span className="filter-label">Tier</span>{tiers.map((item) => <button type="button" key={item} className={`mode-pill ${tier === item ? "active" : ""}`} aria-pressed={tier === item} onClick={() => setTier(item)}>{titleCase(item)}</button>)}</div><span className="marketplace-result-count" aria-live="polite">{filtered.length} models</span></div>
      </div>
      <div className="marketplace-stats marketplace-stats-mobile">
        <HeroStat icon={SquaresFour} value={models.length} label="models" detail="in one workspace" />
        <HeroStat icon={SquaresFour} value={capabilityCount} label="capabilities" detail="text, image, video, audio" />
      </div>
    </section>

    {filtered.length > 0 ? <div className="model-grid" aria-live="polite">{filtered.map((model) => <ModelCard key={model.id} model={model} href={hrefFor(model)} />)}</div> : <div className="card marketplace-empty"><h2>No models match these filters</h2><p className="muted">Try another capability, tier, or search term.</p></div>}
  </div>;
}

function ModelCard({ model, href }: { model: CatalogModel; href: string }) {
  const bullets = bestFor(model);
  return <article className="card glass model-card">
    <div className="model-card-heading">
      <ModelBrand modelName={model.name} provider={model.providerFamily} />
      <div className="model-card-badges"><span className={`category-badge category-${model.modality}`}>{titleCase(model.modality)}</span><span className={`tier tier-${model.tier}`}>{titleCase(model.tier)}</span></div>
      <span className="model-signal" aria-label="Available" />
    </div>
    <div className="model-card-title"><div><h2>{model.name}</h2><p>{model.providerFamily}</p></div></div>
    <div className="capability-chips">{model.capabilities.slice(0, 4).map((item) => <span key={item}>{item}</span>)}</div>
    <div className="model-details">
      <div className="model-best"><span className="detail-label">Best for</span><ul>{bullets.slice(0, 3).map((item) => <li key={item}>{item}</li>)}</ul></div>
      <div className="model-vitals"><div><span className="detail-label">Speed</span><strong>{speedLabel(model)}</strong></div><div><span className="detail-label">Cost</span><strong>{costLabel(model)}</strong></div></div>
    </div>
    <Link className="btn btn-primary model-action" href={href}>{model.modality === "text" ? "Use model" : "Open studio"}<span aria-hidden="true">↗</span></Link>
  </article>;
}

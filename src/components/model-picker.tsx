"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ModelBrand } from "@/components/model-brand";

export type PickerModel = {
  id: string;
  name: string;
  providerFamily?: string;
  tier: string;
  description?: string;
  capabilities?: string[];
  autoEligible?: boolean;
  uiSchema?: { inputModes?: string[]; aspectRatios?: string[]; maxReferences?: number };
  retail?: { inputPerMillionCredits?: number; outputPerMillionCredits?: number; flatCredits?: number; perSecondCredits?: number; per1kCharsCredits?: number };
};

type Filter = "recommended" | "fast" | "reasoning" | "coding" | "vision" | "editing" | "typography" | "multi-reference" | "image-to-video" | "audio" | "1080p" | "cheapest";

const textFilters: { id: Filter; label: string }[] = [
  { id: "recommended", label: "Recommended" },
  { id: "fast", label: "Fast" },
  { id: "reasoning", label: "Reasoning" },
  { id: "coding", label: "Coding" },
  { id: "vision", label: "Vision" },
  { id: "cheapest", label: "Lowest cost" }
];

const imageFilters: { id: Filter; label: string }[] = [
  { id: "recommended", label: "Recommended" },
  { id: "fast", label: "Fast" },
  { id: "editing", label: "Editing" },
  { id: "typography", label: "Typography" },
  { id: "multi-reference", label: "Multi-reference" },
  { id: "cheapest", label: "Lowest cost" }
];

const videoFilters: { id: Filter; label: string }[] = [
  { id: "recommended", label: "Recommended" },
  { id: "fast", label: "Fast" },
  { id: "image-to-video", label: "Image to video" },
  { id: "audio", label: "Native audio" },
  { id: "1080p", label: "1080p" },
  { id: "cheapest", label: "Lowest cost" }
];

function priceLabel(model: PickerModel) {
  if (model.retail?.flatCredits != null) return `${model.retail.flatCredits.toFixed(2)} credits per generation`;
  if (model.retail?.perSecondCredits != null) return `${model.retail.perSecondCredits.toFixed(2)} credits per second`;
  const input = model.retail?.inputPerMillionCredits;
  const output = model.retail?.outputPerMillionCredits;
  if (input == null && output == null) return "Pricing on request";
  if (input != null && output != null) return `${input.toFixed(1)} / ${output.toFixed(1)} credits per 1M`;
  return `${Number(input ?? output).toFixed(1)} credits per 1M`;
}

export function ModelPicker({ models, value, onChange, open, onOpenChange, modality = "text" }: {
  models: PickerModel[];
  value: string;
  onChange: (value: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modality?: "text" | "image" | "video";
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("recommended");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const filters = modality === "image" ? imageFilters : modality === "video" ? videoFilters : textFilters;

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 0);
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onOpenChange(false);
    }
    document.addEventListener("keydown", onKeyDown);
    document.body.classList.add("modal-open");
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("keydown", onKeyDown);
      document.body.classList.remove("modal-open");
    };
  }, [open, onOpenChange]);

  const visibleModels = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const matches = models.filter((model) => {
      const haystack = [model.name, model.providerFamily, model.tier, model.description, ...(model.capabilities || [])].join(" ").toLowerCase();
      if (normalized && !haystack.includes(normalized)) return false;
      if (filter === "recommended") return model.autoEligible !== false;
      if (filter === "cheapest") return true;
      if (filter === "fast") return model.capabilities?.includes("fast") || model.tier === "budget";
      return model.capabilities?.includes(filter) || false;
    });
    if (filter !== "cheapest") return matches;
    return [...matches].sort((a, b) => (a.retail?.inputPerMillionCredits ?? Infinity) - (b.retail?.inputPerMillionCredits ?? Infinity));
  }, [filter, models, query]);

  if (!open) return null;

  return createPortal(<div className="model-picker-backdrop" role="presentation" onMouseDown={(event) => {
    if (event.target === event.currentTarget) onOpenChange(false);
  }}>
    <section className="model-picker-dialog" role="dialog" aria-modal="true" aria-labelledby="model-picker-title">
      <header className="model-picker-head">
        <div><span className="eyebrow">Model library</span><h2 id="model-picker-title">{modality === "image" ? "Choose an image model" : modality === "video" ? "Choose a video model" : "Choose the right intelligence"}</h2></div>
        <button className="dialog-close" type="button" onClick={() => onOpenChange(false)} aria-label="Close model picker">Close</button>
      </header>
      <label className="model-search">
        <span>Search</span>
        <input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Model, provider, or capability" />
        <kbd>Esc</kbd>
      </label>
      <div className="model-filter-row" role="tablist" aria-label="Model categories">
        {filters.map((item) => <button key={item.id} type="button" role="tab" aria-selected={filter === item.id} className={filter === item.id ? "active" : ""} onClick={() => setFilter(item.id)}>{item.label}</button>)}
      </div>
      <div className="model-picker-list">
        {modality === "text" && !query && filter === "recommended" && <button type="button" className={`model-picker-option auto-option ${value ? "" : "selected"}`} onClick={() => { onChange(""); onOpenChange(false); }}>
          <ModelBrand modelName="Auto" /><span className="model-option-copy"><strong>Auto — best available</strong><small>Routes each prompt by complexity, speed, and value.</small><span className="capability-list"><em>Recommended</em><em>Automatic routing</em></span></span><span className="model-option-side"><span className="availability"><i />Available</span><b>Select</b></span>
        </button>}
        {visibleModels.map((model) => <button type="button" key={model.id} className={`model-picker-option ${value === model.id ? "selected" : ""}`} onClick={() => { onChange(model.id); onOpenChange(false); }}>
          <ModelBrand modelName={model.name} provider={model.providerFamily} />
          <span className="model-option-copy"><strong>{model.name}</strong><small>{model.description || `${model.providerFamily || "AI"} ${model.tier} model`}</small><span className="capability-list">{(model.capabilities || []).slice(0, 4).map((capability) => <em key={capability}>{capability.replaceAll("-", " ")}</em>)}</span></span>
          <span className="model-option-side"><span className="availability"><i />Available</span><small>{priceLabel(model)}</small><b>{value === model.id ? "Selected" : "Select"}</b></span>
        </button>)}
        {visibleModels.length === 0 && <div className="model-picker-empty"><strong>No matching models</strong><span>Try another capability or search term.</span></div>}
      </div>
    </section>
  </div>, document.body);
}


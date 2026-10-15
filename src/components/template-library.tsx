"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Briefcase, GraduationCap, MagnifyingGlass, Megaphone, ShoppingCart, Sparkle, Storefront, VideoCamera } from "@phosphor-icons/react";
import "./template-library.css";

export type PromptTemplate = { id: string; slug: string; category: string; title: string; description: string; prompt: string; language: string | null; pakistan_focused: boolean | null };

function categoryKind(category: string) {
  const value = category.toLowerCase();
  if (value.includes("creator") || value.includes("youtube")) return { Icon: VideoCamera, tone: "creator" };
  if (value.includes("commerce") || value.includes("daraz") || value.includes("shop")) return { Icon: ShoppingCart, tone: "commerce" };
  if (value.includes("freelanc") || value.includes("upwork") || value.includes("fiverr")) return { Icon: Briefcase, tone: "freelance" };
  if (value.includes("market")) return { Icon: Megaphone, tone: "marketing" };
  if (value.includes("student") || value.includes("education")) return { Icon: GraduationCap, tone: "student" };
  return { Icon: Storefront, tone: "business" };
}

export function TemplateLibrary({ templates }: { templates: PromptTemplate[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const categories = useMemo(() => Array.from(new Set(templates.map((template) => template.category))).filter(Boolean), [templates]);
  const visibleTemplates = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return templates.filter((template) => (category === "all" || template.category === category) && (!needle || `${template.title} ${template.description} ${template.category} ${template.language || ""}`.toLowerCase().includes(needle)));
  }, [category, query, templates]);

  return <div className="template-library-page template-refined">
    <section className="template-hero">
      <div className="template-hero-copy"><div className="kicker">Your next idea starts here</div><h1>Prompt <span>Templates</span></h1><p>A better starting point. Choose a workflow and make it yours in Chat.</p></div>
      <div className="template-refined-art" aria-hidden="true"><Sparkle weight="duotone" /><i /><i /></div>
    </section>

    <section className="template-controls" aria-label="Browse prompt templates">
      <div className="template-search-row"><label className="template-search"><MagnifyingGlass aria-hidden="true" /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a workflow…" aria-label="Search templates" /></label>{query && <button className="template-reset" type="button" onClick={() => setQuery("")}>Clear search</button>}</div>
      <div className="template-filters" role="group" aria-label="Filter templates by category"><button type="button" className={category === "all" ? "active" : ""} aria-pressed={category === "all"} onClick={() => setCategory("all")}><Sparkle weight="bold" /> All</button>{categories.map((item) => { const { Icon } = categoryKind(item); return <button type="button" key={item} className={category === item ? "active" : ""} aria-pressed={category === item} onClick={() => setCategory(item)}><Icon weight="duotone" /> {item}</button>; })}</div>
    </section>

    <div className="template-results-head"><h2>{category === "all" ? "Discover a workflow" : category}</h2><p role="status" aria-live="polite" aria-atomic="true">{visibleTemplates.length} {visibleTemplates.length === 1 ? "template" : "templates"}{query.trim() ? " found" : " available"}</p></div>
    {visibleTemplates.length > 0 ? <section className="template-grid" aria-label="Prompt templates">{visibleTemplates.map((template) => {
      const { Icon, tone } = categoryKind(template.category);
      const language = template.language === "en" ? "English" : template.language === "ur" ? "Urdu" : ["roman-urdu", "roman-ur"].includes(template.language || "") ? "Roman Urdu" : template.language;
      const tags = [language, template.pakistan_focused ? "Pakistan focused" : null].filter((tag): tag is string => Boolean(tag));
      return <article className={`template-card ${tone}`} key={template.id}>
        <div className="template-card-heading"><div className={`template-card-icon ${tone}`}><Icon weight="duotone" aria-hidden="true" /></div><span>{template.category}</span></div>
        <div className="template-card-copy"><h2>{template.title}</h2><p>{template.description}</p></div>
        {tags.length > 0 && <div className="template-tags">{tags.map((tag) => <span key={tag}>{tag}</span>)}</div>}
        <Link className="template-use" aria-label={`Use ${template.title} template`} href={`/chat?template=${encodeURIComponent(template.prompt)}`}>Use template <span aria-hidden="true">↗</span></Link>
      </article>;
    })}</section> : <section className="template-empty"><Sparkle weight="fill" aria-hidden="true" /><h2>{templates.length ? "No matching templates" : "New workflows are on the way"}</h2><p>{templates.length ? "Try another search or reset your filters." : "Check back soon for ready-to-use prompts."}</p>{templates.length > 0 && <button type="button" onClick={() => { setQuery(""); setCategory("all"); }}>Reset filters</button>}</section>}
  </div>;
}

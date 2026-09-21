"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Briefcase, GraduationCap, MagnifyingGlass, Megaphone, ShoppingCart, Sparkle, Storefront, VideoCamera } from "@phosphor-icons/react";

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

  return <main className="template-library-page">
    <section className="template-hero">
      <div className="template-hero-copy"><div className="kicker">Pakistan workflow library</div><h1>Prompt Templates <span>Start with a proven workflow.</span></h1><p>Ready-to-use prompt templates for creators, freelancers, students, marketers and businesses. Save time, get better results, and do more with AI.</p></div>
      <div className="template-hero-art" aria-hidden="true"><span className="template-art-icon"><Sparkle weight="fill" /></span><div className="template-art-card"><strong>Turn ideas<br />into results</strong><i /><i /><i /></div><small>Better prompts<br />Brighter possibilities</small></div>
    </section>

    <section className="template-controls" aria-label="Browse prompt templates">
      <label className="template-search"><MagnifyingGlass aria-hidden="true" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search templates (e.g. YouTube, marketing, proposal...)" aria-label="Search templates" /></label>
      <div className="template-filters" role="group" aria-label="Filter templates by category"><button type="button" className={category === "all" ? "active" : ""} aria-pressed={category === "all"} onClick={() => setCategory("all")}><Sparkle weight="bold" /> All</button>{categories.map((item) => { const { Icon } = categoryKind(item); return <button type="button" key={item} className={category === item ? "active" : ""} aria-pressed={category === item} onClick={() => setCategory(item)}><Icon weight="duotone" /> {item}</button>; })}</div>
      {templates.length > 0 && <div className="template-facts"><span><Sparkle weight="fill" /><b>{templates.length} templates</b><small>Ready to use</small></span><span><Storefront weight="duotone" /><b>One-click launch</b><small>Open in Chat</small></span>{templates.some((template) => template.language) && <span><GraduationCap weight="duotone" /><b>Language ready</b><small>Templates retain their language</small></span>}</div>}
    </section>

    {visibleTemplates.length > 0 ? <section className="template-grid">{visibleTemplates.map((template) => { const { Icon, tone } = categoryKind(template.category); const tags = [template.language, template.pakistan_focused ? "Pakistan focused" : null].filter((tag): tag is string => Boolean(tag)); return <article className="template-card" key={template.id}><div className={`template-card-icon ${tone}`}><Icon weight="fill" /></div><div className="template-card-copy"><div className="kicker">{template.category}</div><h2>{template.title}</h2><p>{template.description}</p>{tags.length > 0 && <div className="template-tags">{tags.map((tag) => <span key={tag}>{tag}</span>)}</div>}</div><Link className="template-use" href={`/chat?template=${encodeURIComponent(template.prompt)}`}>Use template <span aria-hidden="true">→</span></Link></article>; })}</section> : <section className="template-empty"><Sparkle weight="fill" /><h2>No templates match yet</h2><p>Try another search term or clear the category filter.</p><button type="button" onClick={() => { setQuery(""); setCategory("all"); }}>Clear filters</button></section>}
  </main>;
}

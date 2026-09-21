"use client";

import { CSSProperties, FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowRight, ArrowsClockwise, Check, Copy, Info, Sparkle, Trophy } from "@phosphor-icons/react";
import { ModelBrand } from "@/components/model-brand";

type Model = { id: string; name: string; modality: string; tier: string; providerFamily?: string };
type Output = { text: string; meta?: string; error?: string };
const promptIdeas = ["Explain quantum computing simply", "Write a product launch email", "Analyze this business idea", "Compare pros and cons", "Create a travel itinerary"];

async function runModel(prompt: string, modelId: string, onDelta: (text: string) => void) {
  const response = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestId: crypto.randomUUID(), messages: [{ role: "user", content: prompt }], modelId, maxTokens: 1800, private: true }) });
  if (!response.ok || !response.body) { const data = await response.json().catch(() => ({})); throw new Error(data.error || "Model request failed"); }
  const reader = response.body.getReader(), decoder = new TextDecoder(); let buffer = "", meta = "";
  while (true) { const { value, done } = await reader.read(); if (done) break; buffer += decoder.decode(value, { stream: true }); const chunks = buffer.split("\n\n"); buffer = chunks.pop() || ""; for (const chunk of chunks) { const line = chunk.split("\n").find((entry) => entry.startsWith("data:")); if (!line) continue; try { const event = JSON.parse(line.slice(5).trim()); if (event.type === "delta") onDelta(event.text); if (event.type === "usage") meta = `${event.model} · ${Number(event.credits).toFixed(4)} Credits`; } catch { /* Ignore incomplete streaming frames. */ } } }
  return meta;
}

export function ModelBattle() {
  const [models, setModels] = useState<Model[]>([]);
  const [selected, setSelected] = useState<string[]>(["gpt-5-6-terra", "claude-sonnet-4-6"]);
  const [prompt, setPrompt] = useState("");
  const [outputs, setOutputs] = useState<Record<string, Output>>({});
  const [busy, setBusy] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);
  useEffect(() => { fetch("/api/models").then((response) => response.json()).then((data) => setModels((data.models || []).filter((model: Model) => model.modality === "text"))).catch(() => setModels([])); }, []);
  const selectedModels = useMemo(() => selected.map((id) => models.find((model) => model.id === id)).filter((model): model is Model => Boolean(model)), [models, selected]);
  const hasResults = Object.values(outputs).some((output) => output.text || output.error);
  const toggle = (id: string) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : current.length < 3 ? [...current, id] : current);
  const resetComparison = () => { setPrompt(""); setOutputs({}); setWinner(null); };
  async function submit(event: FormEvent) {
    event.preventDefault(); if (selected.length < 2 || !prompt.trim() || busy) return;
    setBusy(true); setWinner(null); setOutputs(Object.fromEntries(selected.map((id) => [id, { text: "" }])));
    await Promise.all(selected.map(async (id) => { try { const meta = await runModel(prompt, id, (text) => setOutputs((current) => ({ ...current, [id]: { ...current[id], text: `${current[id]?.text || ""}${text}` } }))); setOutputs((current) => ({ ...current, [id]: { ...current[id], meta } })); } catch (error) { setOutputs((current) => ({ ...current, [id]: { ...current[id], error: error instanceof Error ? error.message : "Failed" } })); } }));
    setBusy(false);
  }
  const copyResponse = async (text: string) => { if (text) await navigator.clipboard?.writeText(text); };

  return <main className="battle-page">
    <header className="battle-hero"><div><div className="kicker">Model Battle</div><h1 className="page-title">One prompt. <span>Multiple AI minds.</span></h1><p>Compare two or three models side by side. Each model is billed as a separate request.</p></div><div className="battle-hero-orbit" aria-hidden="true"><Sparkle weight="fill" /></div></header>
    <form className="battle-console" onSubmit={submit}>
      <div className="battle-steps" aria-label="Comparison steps"><div className="is-active"><b>1</b><span><strong>Add your prompt</strong><small>Describe what you want to compare</small></span></div><i aria-hidden="true" /><div><b>2</b><span><strong>Select models</strong><small>Choose 2–3 AI models</small></span></div><i aria-hidden="true" /><div><b>3</b><span><strong>Compare output</strong><small>See results side by side</small></span></div></div>
      <label className="battle-prompt">Prompt <small>{prompt.length}/4000</small><textarea value={prompt} onChange={(event) => setPrompt(event.target.value.slice(0, 4000))} placeholder="Ask something worth comparing…" required /></label>
      <div className="battle-ideas"><span>Try these ideas:</span>{promptIdeas.map((idea) => <button type="button" key={idea} onClick={() => setPrompt(idea)}>{idea}</button>)}</div>
      <section className="battle-select" aria-labelledby="battle-models-label"><div className="battle-select-head"><strong id="battle-models-label">Select models (2–3)</strong><div><span className={selected.length >= 2 ? "ready" : ""}>{selected.length}/3 selected</span>{selected.length > 0 && <button type="button" onClick={() => setSelected([])}>Clear all</button>}</div></div><div className="battle-models">{models.map((model) => { const isSelected = selected.includes(model.id), unavailable = !isSelected && selected.length >= 3; return <button type="button" key={model.id} className={isSelected ? "active" : ""} disabled={unavailable || busy} aria-pressed={isSelected} onClick={() => toggle(model.id)}><ModelBrand compact modelName={model.name} provider={model.providerFamily} /><span>{model.name}</span>{isSelected && <Check weight="bold" aria-hidden="true" />}</button>; })}</div></section>
      <div className="battle-footer"><span className="battle-mobile-step" aria-hidden="true">3</span><div className="battle-cost-note"><span><Info weight="bold" /></span><p><strong>Each selected model runs as a separate request and is billed individually.</strong><small>Select 2–3 models only when comparison is worth the extra usage.</small></p></div><button className="btn btn-primary battle-submit" disabled={busy || selected.length < 2 || !prompt.trim()}>{busy ? "Comparing…" : <>Compare {selected.length} model{selected.length === 1 ? "" : "s"} <ArrowRight weight="bold" /></>}</button></div>
    </form>
    <section className="battle-result-section" aria-live="polite"><header><div><div className="kicker">Comparison Results</div><h2>Results</h2><p>Responses appear side by side so you can review each perspective.</p></div>{hasResults && <button type="button" className="battle-reset" onClick={resetComparison}><ArrowsClockwise weight="bold" /> New comparison</button>}</header><div className="battle-results" style={{ "--battle-columns": Math.max(1, selectedModels.length) } as CSSProperties}>{selectedModels.map((model) => { const output = outputs[model.id], isWinner = winner === model.id, status = output?.error ? "Error" : output?.text ? "Ready" : busy ? "Thinking…" : "Ready"; return <article className={`battle-result ${busy && !output?.text && !output?.error ? "is-streaming" : ""} ${isWinner ? "is-winner" : ""}`} key={model.id}><header><div className="battle-result-model"><ModelBrand modelName={model.name} provider={model.providerFamily} /><span><small>{model.tier}</small><h2>{model.name}</h2><p>{model.providerFamily || "AI model"}</p></span></div><i className={output?.error ? "error" : output?.text ? "ready" : ""}>{status}</i></header><div className="battle-response">{output?.error ? <div className="battle-error">{output.error}</div> : output?.text ? output.text : busy ? <div className="battle-thinking"><div><i /><i /><i /></div><strong>Comparing your prompt</strong><span>This model is preparing its response.</span></div> : <div className="battle-ready"><Sparkle weight="fill" /><strong>Ready for your prompt</strong><span>Select 2–3 models and compare their responses here.</span></div>}</div><footer>{output?.text && <button type="button" onClick={() => copyResponse(output.text)}><Copy /> Copy</button>}{output?.text && <button type="button" className="battle-winner" onClick={() => setWinner(model.id)}>{isWinner ? <><Check /> Winner</> : <><Trophy /> Choose winner</>}</button>}</footer></article>; })}</div></section>
  </main>;
}

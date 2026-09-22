import Image from "next/image";

type ModelBrandProps = { modelName?: string; provider?: string; compact?: boolean };

function brandKind(modelName = "", provider = "") {
  const value = `${provider} ${modelName}`.toLowerCase();
  if (value.includes("claude") || value.includes("anthropic")) return "claude";
  if (value.includes("gemini") || value.includes("google")) return "gemini";
  if (value.includes("deepseek")) return "deepseek";
  if (value.includes("grok") || value.includes("xai")) return "grok";
  if (value.includes("qwen") || value.includes("alibaba")) return "qwen";
  if (value.includes("gpt") || value.includes("openai")) return "openai";
  return "auto";
}

export function ModelBrand({ modelName = "Auto", provider = "", compact = false }: ModelBrandProps) {
  const kind = brandKind(modelName, provider);
  const label = kind === "auto" ? "All Model Hub automatic routing" : `${provider || modelName} model`;
  return <span className={`model-brand model-brand-${kind}${compact ? " is-compact" : ""}`} role="img" aria-label={label} title={label}>
    {kind === "openai" && <Image className="openai-logo" src="/openai-logo.png" alt="" width={32} height={32} aria-hidden="true" />}
    {kind === "claude" && <svg viewBox="0 0 32 32" aria-hidden="true"><g stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M16 3v9M16 20v9M3 16h9M20 16h9M6.8 6.8l6.3 6.3M18.9 18.9l6.3 6.3M25.2 6.8l-6.3 6.3M13.1 18.9l-6.3 6.3"/></g></svg>}
    {kind === "gemini" && <svg viewBox="0 0 32 32" aria-hidden="true"><path fill="currentColor" d="M16 2c1.6 8.2 5.8 12.4 14 14-8.2 1.6-12.4 5.8-14 14-1.6-8.2-5.8-12.4-14-14C10.2 14.4 14.4 10.2 16 2Z"/></svg>}
    {kind === "deepseek" && <svg viewBox="0 0 32 32" aria-hidden="true"><path fill="currentColor" d="M3 18.5c3.2-6 9.5-9.2 16.2-7.2 2.1.6 3.8 1.7 5.2 3.2 1.5-.1 3.1-.7 4.5-1.8-.3 3.1-1.7 5.4-4.1 6.9-2.7 6-8.8 9.2-15.2 7.2-3.5-1-5.6-3.8-6.6-8.3Zm8.1 1.1a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/></svg>}
    {kind === "grok" && <svg viewBox="0 0 32 32" aria-hidden="true"><g fill="none" stroke="currentColor" strokeWidth="3.3" strokeLinecap="round"><path d="M24.8 8.1A11 11 0 1 0 26.5 20"/><path d="M5 27 27 5"/></g></svg>}
    {kind === "qwen" && <svg viewBox="0 0 32 32" aria-hidden="true"><path fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" d="m16 3 4.1 7.1 8.2.1-4 7.2 4 7.1-8.2.1L16 29l-4.1-4.4-8.2-.1 4-7.1-4-7.2 8.2-.1Z"/><path fill="currentColor" d="m16 12 4 7h-8z"/></svg>}
    {kind === "auto" && <svg viewBox="0 0 32 32" aria-hidden="true"><path fill="currentColor" d="M16 2c1.3 7.4 5.2 11.3 12.6 12.6C21.2 16 17.3 19.8 16 27.2 14.7 19.8 10.8 16 3.4 14.6 10.8 13.3 14.7 9.4 16 2Z"/><circle cx="25.5" cy="6.5" r="2.5" fill="currentColor"/></svg>}
  </span>;
}


"use client";

import { useEffect, useId, useRef, useState } from "react";

type Option = { value: string; label: string; disabled?: boolean };

type PremiumSelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  "aria-label"?: string;
  className?: string;
  disabled?: boolean;
};

export function PremiumSelect({ value, onChange, options, className = "", disabled, ...props }: PremiumSelectProps) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(() => Math.max(0, options.findIndex((option) => option.value === value)));
  const selected = options.find((option) => option.value === value);
  const available = options.map((option, index) => ({ option, index })).filter(({ option }) => !option.disabled);

  useEffect(() => {
    function close(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  function choose(option: Option) {
    if (option.disabled) return;
    onChange(option.value);
    setOpen(false);
  }

  function move(step: number) {
    const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));
    const current = available.findIndex(({ index }) => index === (open ? activeIndex : selectedIndex));
    const next = available[(current + step + available.length) % available.length];
    if (next) setActiveIndex(next.index);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "Escape") { event.preventDefault(); setOpen(false); return; }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) setOpen(true);
      move(event.key === "ArrowDown" ? 1 : -1);
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (!open) { setActiveIndex(Math.max(0, options.findIndex((option) => option.value === value))); setOpen(true); return; }
      const option = options[activeIndex];
      if (option) choose(option);
    }
  }

  return <div ref={rootRef} className={`premium-select ${className}`}>
    <button type="button" id={id} className="premium-select-trigger" aria-haspopup="listbox" aria-expanded={open} disabled={disabled} onClick={() => { if (!open) setActiveIndex(Math.max(0, options.findIndex((option) => option.value === value))); setOpen((current) => !current); }} onKeyDown={handleKeyDown} {...props}>
      <span className="premium-select-value">{selected?.label || "Select an option"}</span><span className="premium-select-chevron" aria-hidden="true">⌄</span>
    </button>
    {open && <div className="premium-select-menu" role="listbox" aria-labelledby={id} tabIndex={-1}>
      {options.map((option, index) => <button type="button" role="option" aria-selected={option.value === value} className={`premium-select-option ${option.value === value ? "selected" : ""} ${index === activeIndex ? "active" : ""}`} key={option.value} disabled={option.disabled} onMouseEnter={() => setActiveIndex(index)} onClick={() => choose(option)}>{option.label}{option.value === value && <span aria-hidden="true">✓</span>}</button>)}
    </div>}
  </div>;
}

export function selectOptions(values: Array<[string, string]>): Option[] {
  return values.map(([value, label]) => ({ value, label }));
}

export type { Option };

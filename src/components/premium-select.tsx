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
  const selected = options.find((option) => option.value === value);

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

  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "Escape") setOpen(false);
    if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setOpen(true);
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
    }
  }

  return <div ref={rootRef} className={`premium-select ${className}`}>
    <button type="button" id={id} className="premium-select-trigger" aria-haspopup="listbox" aria-expanded={open} disabled={disabled} onClick={() => setOpen((current) => !current)} onKeyDown={handleKeyDown} {...props}>
      <span>{selected?.label || "Select an option"}</span><span className="premium-select-chevron" aria-hidden="true">⌄</span>
    </button>
    {open && <div className="premium-select-menu" role="listbox" aria-labelledby={id}>
      {options.map((option) => <button type="button" role="option" aria-selected={option.value === value} className={`premium-select-option ${option.value === value ? "selected" : ""}`} key={option.value} disabled={option.disabled} onClick={() => choose(option)}>{option.label}{option.value === value && <span aria-hidden="true">✓</span>}</button>)}
    </div>}
  </div>;
}

export function selectOptions(values: Array<[string, string]>): Option[] {
  return values.map(([value, label]) => ({ value, label }));
}

export type { Option };

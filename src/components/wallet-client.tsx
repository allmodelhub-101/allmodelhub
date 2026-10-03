"use client";

import Image from "next/image";
import React, { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, CaretDown, Check, CheckCircle, Clock, Copy, CreditCard, FileArrowUp, Info, Receipt, ShieldCheck, Sparkle, UploadSimple, Wallet, X } from "@phosphor-icons/react";
import { calculateTopupBonus, isValidTopupAmount, TOPUP_BONUS_TIERS, TOPUP_MAX_PKR, TOPUP_MIN_PKR } from "@/lib/topup-bonus";

type Method = { id: string; label: string; accountTitle: string; accountNumber: string; iban?: string; instructions: string };
type WalletData = { available: number; purchased: number; promo: number; reserved: number };
type Transaction = { id: string; created_at: string; type: string; amount: number; balance_after?: number | null; reference_id?: string | null };
type SubmittedPayment = { public_id: string; amount_pkr: number; bonus_credits: number; total_credits: number };

const suggestedAmounts = [500, 1000, 2500, 5000, 10000];
const methodMeta: Record<string, { caption: string; logo: string }> = {
  easypaisa: { caption: "Mobile wallet", logo: "/payment-logos/easypaisa.svg" },
  meezan: { caption: "Bank transfer", logo: "/payment-logos/meezan-bank.svg" }
};
const money = (value: number) => Math.max(0, Number.isFinite(value) ? value : 0).toLocaleString("en-PK", { maximumFractionDigits: 2 });
const configuredMethod = (item: Method) => Boolean(item.accountTitle && item.accountNumber && !/configure in vercel|not configured/i.test(`${item.accountTitle} ${item.accountNumber} ${item.iban || ""}`));

export function WalletClient({ initialWallet, initialTransactions }: { initialWallet: WalletData; initialTransactions: Transaction[] }) {
  const [wallet, setWallet] = useState(initialWallet);
  const [transactions, setTransactions] = useState(initialTransactions);
  const [methods, setMethods] = useState<Method[]>([]);
  const [minimum, setMinimum] = useState(TOPUP_MIN_PKR);
  const [methodsState, setMethodsState] = useState<"loading" | "ready" | "error">("loading");
  const [method, setMethod] = useState("");
  const [amountText, setAmountText] = useState("");
  const [reference, setReference] = useState("");
  const [proof, setProof] = useState<File | null>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState("");
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [submitted, setSubmitted] = useState<SubmittedPayment | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  async function loadMethods() {
    setMethodsState("loading");
    setStatus("");
    try {
      const response = await fetch("/api/payments/manual");
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Payment methods are temporarily unavailable.");
      const nextMinimum = Math.max(TOPUP_MIN_PKR, Number.isInteger(data.minimum) ? data.minimum : TOPUP_MIN_PKR);
      const nextMethods = Array.isArray(data.methods) ? data.methods.filter(configuredMethod) : [];
      setMinimum(nextMinimum);
      setAmountText((current) => current && Number(current) < nextMinimum ? "" : current);
      setMethods(nextMethods);
      setMethod((current) => nextMethods.some((item: Method) => item.id === current) ? current : "");
      setMethodsState("ready");
      if (!nextMethods.length) setStatus("No payment method is available right now. Please try again later.");
    } catch (error) {
      setMethods([]);
      setMethod("");
      setMethodsState("error");
      setStatus(error instanceof Error ? error.message : "Payment methods are temporarily unavailable.");
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void loadMethods(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const amount = Number(amountText);
  const selected = methods.find((item) => item.id === method);
  const bonus = useMemo(() => calculateTopupBonus(amount), [amount]);
  const amountError = amountText !== "" && (!Number.isInteger(amount) || amount < minimum
    ? `Minimum top-up is PKR ${money(minimum)}.`
    : amount > TOPUP_MAX_PKR ? `Maximum top-up is PKR ${money(TOPUP_MAX_PKR)}.` : "");
  const canContinue = isValidTopupAmount(amount) && amount >= minimum && Boolean(selected) && methodsState === "ready";

  function moveTo(next: 1 | 2 | 3) {
    if (next > step && !canContinue) {
      setStatus(amountError || (methodsState === "error" ? "Retry loading payment methods before continuing." : "Choose a valid amount and payment method first."));
      return;
    }
    setDirection(next >= step ? "forward" : "back");
    setStatus("");
    setStep(next);
    window.setTimeout(() => {
      panelRef.current?.focus();
      panelRef.current?.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    }, 40);
  }

  function updateAmount(value: string) {
    setAmountText(value.replace(/\D/g, "").slice(0, 6));
    setStatus("");
  }

  function chooseProof(file: File | null) {
    if (!file) return;
    const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!allowed.includes(file.type)) {
      removeProof();
      return setStatus("Use a JPG, PNG, WebP, or PDF receipt.");
    }
    if (file.size > 5 * 1024 * 1024) {
      removeProof();
      return setStatus("Receipt must be 5 MB or smaller.");
    }
    setProof(file);
    setStatus("");
  }

  function removeProof() {
    setProof(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function copyValue(value: string, key: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      window.setTimeout(() => setCopied(""), 1600);
    } catch {
      setStatus("Copy was blocked. Select the payment detail and copy it manually.");
    }
  }

  async function refresh() {
    const response = await fetch("/api/wallet");
    if (!response.ok) return;
    const data = await response.json();
    setWallet(data.wallet);
    setTransactions(data.transactions || []);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (!canContinue) return setStatus(amountError || "Choose a valid amount and payment method first.");
    if (reference.trim().length < 4) return setStatus("Enter a valid transaction/reference ID.");
    if (!proof) return setStatus("Add your payment receipt before submitting.");
    setBusy(true);
    setStatus("");
    try {
      const form = new FormData();
      form.append("method", method);
      form.append("amount", String(amount));
      form.append("transactionReference", reference.trim());
      form.append("proof", proof);
      const response = await fetch("/api/payments/manual", { method: "POST", body: form });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not submit payment. Try again.");
      setSubmitted({ public_id: data.payment.public_id, amount_pkr: Number(data.payment.amount_pkr), bonus_credits: Number(data.payment.bonus_credits), total_credits: Number(data.payment.total_credits) });
      await refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not submit payment. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setSubmitted(null);
    setStep(1);
    setAmountText("");
    setMethod("");
    setReference("");
    removeProof();
    setStatus("");
  }

  const hasValidAmount = amountText !== "" && !amountError && isValidTopupAmount(amount) && amount >= minimum;
  const balanceCards = [
    { label: "Available", value: wallet.available, detail: "Ready to use after temporary reservations", icon: CreditCard, primary: true },
    { label: "Purchased", value: wallet.purchased, detail: "Never expires", icon: CheckCircle },
    { label: "Promotional", value: wallet.promo, detail: "Tracked separately", icon: Receipt },
    { label: "Temporarily reserved", value: wallet.reserved, detail: "Not spent; released or captured after settlement", icon: Clock }
  ];

  return <div className="wallet-workspace">
    <section className="wallet-balance-grid" aria-label="Wallet balances">{balanceCards.map((card) => { const Icon = card.icon; return <div className={`card wallet-balance-card ${card.primary ? "is-primary" : ""}`} key={card.label}><span className="wallet-balance-icon"><Icon weight="fill" /></span><span className="wallet-balance-label">{card.label}</span><strong>{Number(card.value).toFixed(2)}</strong><small>{card.detail}</small></div>; })}</section>
    <section className="wallet-topup-shell">
      <header className="wallet-topup-head"><div><span className="kicker">Add credits</span><h2>Top up. Get more AI power.</h2><p>One credit equals PKR 1. Credits are added after manual payment approval.</p></div><span className="wallet-review-badge"><Clock weight="fill" />Manual review</span></header>
      {!submitted && <Progress step={step} moveTo={moveTo} />}
      {submitted ? <SuccessState payment={submitted} reset={reset} /> : <form onSubmit={submit} noValidate>
        <div ref={panelRef} tabIndex={-1} className={`wallet-wizard-panel is-${direction}`} key={step}>
          {step === 1 && <section className="wallet-step-layout">
            <div className="wallet-step-main">
              <StepHeading number="01" title="Choose your amount" detail={`Top up from PKR ${money(minimum)} to ${money(TOPUP_MAX_PKR)}.`} />
              <label className="label">Amount in PKR<span className={`wallet-amount-field ${amountError ? "has-error" : ""}`}><span>PKR</span><input inputMode="numeric" min={minimum} max={TOPUP_MAX_PKR} value={amountText} placeholder={`Min. ${money(minimum)}`} onChange={(event) => updateAmount(event.target.value)} aria-invalid={Boolean(amountError)} aria-describedby="amount-help" /><small>{hasValidAmount ? `${bonus.percent}% bonus` : "Choose amount"}</small></span></label>
              {amountError && <p id="amount-help" className="wallet-field-error" role="alert">{amountError}</p>}
              <div className="wallet-amount-chips" aria-label="Suggested top-up amounts">{suggestedAmounts.map((value) => <button type="button" className={amount === value ? "active" : ""} onClick={() => updateAmount(String(value))} disabled={value < minimum} key={value}>PKR {money(value)}</button>)}</div>
              <BonusDisclosure amount={amount} />
              <div className="wallet-payment-methods"><h3>Select payment method</h3>{methodsState === "loading" && <div className="wallet-account-loading">Loading secure payment methods…</div>}{methodsState === "error" && <button type="button" className="wallet-retry" onClick={() => void loadMethods()}>Retry loading payment methods</button>}{methodsState === "ready" && <div className="wallet-method-grid" role="radiogroup" aria-label="Payment method">{methods.map((item) => <button type="button" role="radio" aria-checked={method === item.id} className={`wallet-method ${method === item.id ? "active" : ""}`} onClick={() => { setMethod(item.id); setStatus(""); }} key={item.id}><PaymentLogo method={item.id} /><span><strong>{item.label}</strong><small>{methodMeta[item.id]?.caption || "Manual payment"}</small></span>{method === item.id && <Check weight="bold" />}</button>)}</div>}</div>
            </div>
            <aside className="wallet-step-side"><ValueSummary amount={hasValidAmount ? amount : null} bonus={hasValidAmount ? bonus.bonusCredits : null} percent={hasValidAmount ? bonus.percent : null} total={hasValidAmount ? bonus.totalCredits : null} method={selected?.label} /><p className="wallet-summary-note"><Info weight="fill" />{!hasValidAmount ? "Choose an amount, then select a payment method to continue." : !selected ? "Select an available payment method to continue." : "Your payment is reviewed manually before credits are added."}</p><button type="button" className="btn btn-primary wallet-submit" disabled={!canContinue} onClick={() => moveTo(2)}>View payment details <ArrowRight weight="bold" /></button></aside>
          </section>}
          {step === 2 && <section className="wallet-step-layout">
            <div className="wallet-step-main">
              <StepHeading number="02" title="Make your payment" detail="Transfer the exact amount to the selected recipient." />
              <div className="wallet-pay-focus"><small>Send exactly</small><strong>PKR {money(amount)}</strong><p>Use these details only for this selected amount and method.</p></div>
              {selected ? <><div className="wallet-transfer-brand"><PaymentLogo method={method} /><div><small>Pay with</small><strong>{selected.label}</strong></div></div><div className="wallet-account-details"><CopyRow label="Account title" value={selected.accountTitle} id="title" copied={copied} copyValue={copyValue} /><CopyRow label={selected.iban ? "Account number" : "Mobile account"} value={selected.accountNumber} id="account" copied={copied} copyValue={copyValue} />{selected.iban && <CopyRow label="IBAN" value={selected.iban} id="iban" copied={copied} copyValue={copyValue} />}</div></> : <div className="wallet-account-loading">Payment details are unavailable. Return and choose an available method.</div>}
            </div>
            <aside className="wallet-step-side"><CompactSummary amount={amount} bonus={bonus.bonusCredits} total={bonus.totalCredits} method={selected?.label || "—"} /><p className="wallet-summary-note"><ShieldCheck weight="fill" />Changing your amount or method means using the updated recipient details.</p><div className="wallet-actions"><button type="button" className="btn btn-ghost" onClick={() => moveTo(1)}><ArrowLeft />Edit</button><button type="button" className="btn btn-primary" disabled={!selected} onClick={() => moveTo(3)}>I’ve made the transfer <ArrowRight /></button></div><ol className="wallet-payment-instructions"><li>Transfer the exact amount.</li><li>Save your transaction/reference ID.</li><li>Keep your receipt.</li></ol></aside>
          </section>}
          {step === 3 && <section className="wallet-step-layout">
            <div className="wallet-step-main">
              <StepHeading number="03" title="Submit payment proof" detail="Add the reference from your transfer and its receipt." />
              <label className="label">Transaction / reference ID<input className="input" value={reference} onChange={(event) => { setReference(event.target.value); setStatus(""); }} required minLength={4} maxLength={120} disabled={busy} placeholder="e.g. 12345678901" /></label>
              <input ref={fileRef} className="wallet-file-native" id="wallet-proof" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(event) => chooseProof(event.target.files?.[0] || null)} disabled={busy} />
              <label className={`wallet-proof-drop ${proof ? "has-file" : ""}`} htmlFor="wallet-proof"><span>{proof ? <CheckCircle weight="fill" /> : <FileArrowUp weight="duotone" />}</span><div><strong>{proof ? "Receipt attached" : "Upload payment receipt"}</strong><small>{proof ? proof.name : "JPG, PNG, WebP or PDF · maximum 5 MB"}</small></div><b>{proof ? "Change" : "Browse"}</b></label>
              {proof && <button type="button" className="wallet-remove-proof" onClick={removeProof} disabled={busy}><X weight="bold" />Remove receipt</button>}
            </div>
            <aside className="wallet-step-side"><CompactSummary amount={amount} bonus={bonus.bonusCredits} total={bonus.totalCredits} method={selected?.label || "—"} /><button className="btn btn-primary wallet-submit" disabled={busy || !proof || reference.trim().length < 4 || !canContinue}><UploadSimple weight="bold" />{busy ? "Submitting securely…" : "Submit for manual review"}</button><p className="wallet-submit-help"><ShieldCheck weight="fill" />Credits are added after payment approval.</p><button type="button" className="wallet-back-link" disabled={busy} onClick={() => moveTo(2)}><ArrowLeft />Back to payment details</button></aside>
          </section>}
        </div>
        {status && <div className="wallet-status" role="alert" aria-live="polite">{status}</div>}
      </form>}
    </section>
    <section className="wallet-protection-strip"><div><ShieldCheck weight="fill" /><span><b>Credits never expire</b><small>Your purchased balance stays yours.</small></span></div><div><Wallet weight="fill" /><span><b>Protected spending</b><small>Reservations prevent a negative balance.</small></span></div><div><Receipt weight="fill" /><span><b>Clear ledger</b><small>Every movement is recorded below.</small></span></div></section>
    <section className="wallet-ledger"><div className="wallet-ledger-heading"><span><Receipt weight="fill" /><span><span className="kicker">Receipts</span><h2 className="page-title">Recent transactions</h2></span></span><small>Every movement is recorded</small></div><div className="table-wrap"><table><thead><tr><th>Date</th><th>Type</th><th>Amount</th><th>Balance after</th><th>Reference</th></tr></thead><tbody>{transactions.length ? transactions.map((transaction) => <tr key={transaction.id}><td>{new Date(transaction.created_at).toLocaleString()}</td><td>{transaction.type}</td><td style={{ color: Number(transaction.amount) >= 0 ? "var(--success)" : "var(--text)" }}>{Number(transaction.amount) >= 0 ? "+" : ""}{Number(transaction.amount).toFixed(4)}</td><td>{transaction.balance_after == null ? "—" : Number(transaction.balance_after).toFixed(4)}</td><td>{transaction.reference_id || "—"}</td></tr>) : <tr><td colSpan={5} className="muted">No transactions yet.</td></tr>}</tbody></table></div></section>
  </div>;
}

function Progress({ step, moveTo }: { step: 1 | 2 | 3; moveTo: (step: 1 | 2 | 3) => void }) { return <div className="wallet-steps" aria-label={`Payment step ${step} of 3`}>{["Choose Amount", "Make Payment", "Submit Proof"].map((label, index) => { const number = (index + 1) as 1 | 2 | 3; return <button type="button" key={label} className={number === step ? "is-current" : number < step ? "is-complete" : ""} onClick={() => number < step && moveTo(number)} disabled={number > step}><b>{number < step ? <Check weight="bold" /> : String(number).padStart(2, "0")}</b><i>{label}</i></button>; })}</div>; }
function PaymentLogo({ method }: { method: string }) { const meta = methodMeta[method] || methodMeta.easypaisa; return <span className="wallet-method-logo"><Image src={meta.logo} alt={`${method === "meezan" ? "Meezan Bank" : "Easypaisa"} logo`} width={50} height={50} sizes="50px" /></span>; }
function StepHeading({ number, title, detail }: { number: string; title: string; detail: string }) { return <div className="wallet-form-title"><span>{number}</span><div><h3>{title}</h3><p>{detail}</p></div></div>; }
function ValueSummary({ amount, bonus, percent, total, method }: { amount: number | null; bonus: number | null; percent: number | null; total: number | null; method?: string }) { return <div className="wallet-value-summary"><span><small>You pay</small><b>{amount === null ? "Choose amount" : `PKR ${money(amount)}`}</b></span><span className="bonus"><small>Bonus credits</small><b>{bonus === null ? "—" : `+${money(bonus)}${percent ? ` · ${percent}%` : ""}`}</b></span><span className="total"><small>You’ll receive after approval</small><strong key={total ?? "empty"}>{total === null ? "Choose an amount" : `${money(total)} Credits`}</strong></span><span className="wallet-summary-method"><small>Payment method</small><b>{method || "Choose a method"}</b></span></div>; }
function CompactSummary({ amount, bonus, total, method }: { amount: number; bonus: number; total: number; method: string }) { return <div className="wallet-compact-summary"><span><small>Payment</small><b>PKR {money(amount)}</b></span><span><small>Bonus</small><b className="bonus">+{money(bonus)}</b></span><span><small>Total after approval</small><b>{money(total)} Credits</b></span><span><small>Via</small><b>{method}</b></span></div>; }
function BonusDisclosure({ amount }: { amount: number }) { const bonus = calculateTopupBonus(amount); return <details className="wallet-bonus-disclosure"><summary><span><Sparkle weight="fill" />{bonus.percent ? `${bonus.percent}% bonus applied · +${money(bonus.bonusCredits)} credits` : "Bonus tiers"}</span><CaretDown weight="bold" /></summary><div>{TOPUP_BONUS_TIERS.map((tier) => <span className={amount >= tier.minimum ? "is-active" : ""} key={tier.minimum}>PKR {money(tier.minimum)}{tier.minimum === 10000 ? "+" : ""}<b>+{tier.percent}%</b></span>)}</div></details>; }
function CopyRow({ label, value, id, copied, copyValue }: { label: string; value: string; id: string; copied: string; copyValue: (value: string, key: string) => void }) { return <div className={`wallet-copy-row ${copied === id ? "is-copied" : ""}`}><span><small>{label}</small><strong>{value}</strong></span><button type="button" onClick={() => void copyValue(value, id)}>{copied === id ? <Check weight="bold" /> : <Copy weight="bold" />}{copied === id ? "Copied" : "Copy"}</button></div>; }
function SuccessState({ payment, reset }: { payment: SubmittedPayment; reset: () => void }) { return <div className="wallet-success" aria-live="polite"><span className="wallet-success-icon"><Check weight="bold" /><Sparkle weight="fill" /></span><span className="kicker">Awaiting manual review</span><h3>Payment proof submitted</h3><p>Reference <b>{payment.public_id}</b> is ready for review.</p><div className="wallet-compact-summary"><span><small>Payment</small><b>PKR {money(payment.amount_pkr)}</b></span><span><small>Bonus</small><b className="bonus">+{money(payment.bonus_credits)} Credits</b></span><span><small>Expected after approval</small><b>{money(payment.total_credits)} Credits</b></span></div><div className="wallet-status-track"><span className="done"><Check />Submitted</span><i /><span>Under review</span><i /><span>Credits added</span></div><button type="button" className="btn btn-primary" onClick={reset}>Make another top-up</button></div>; }

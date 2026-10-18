"use client";

import { FormEvent, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Eye, EyeSlash, LockKey, WarningCircle } from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import { safeAuthenticatedPath } from "@/lib/security/request";

type Mode = "login" | "signup" | "recovery";
type EntryMode = Exclude<Mode, "recovery">;
type FieldName = "email" | "password";
type Notice = { tone: "error" | "success"; title: string; detail: string };

const subscribeEmail = () => () => {};
const serverEmail = () => "";
function savedEmailSnapshot() {
  try { return window.sessionStorage.getItem("models-suite-auth-email") || ""; }
  catch { return ""; }
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getPasswordIssue(password: string) {
  if (password.length < 8) return "Use at least 8 characters.";
  if (!/[a-z]/.test(password)) return "Add a lowercase letter.";
  if (!/[A-Z]/.test(password)) return "Add an uppercase letter.";
  if (!/\d/.test(password)) return "Add a number.";
  if (!/[^A-Za-z0-9]/.test(password)) return "Add a symbol.";
  return null;
}

function accountServiceNotice(): Notice {
  return {
    tone: "error",
    title: "Account service is not ready",
    detail: "Please try again shortly. If this continues, contact Models Suite support.",
  };
}

function callbackErrorNotice(code?: string): Notice | null {
  if (!code) return null;
  if (code === "missing_code") {
    return { tone: "error", title: "That sign-in link is incomplete", detail: "Start the secure sign-in again. Your intended page has been preserved." };
  }
  if (code === "verification_invalid") {
    return { tone: "error", title: "That verification link is invalid or expired", detail: "Create a fresh verification email from the sign-up page, or sign in if you already confirmed your account." };
  }
  if (code === "verification_required") {
    return { tone: "error", title: "Open your verification email first", detail: "The confirmation screen is available only after you use the secure link in your email." };
  }
  if (code === "provisioning_failed") {
    return { tone: "error", title: "We could not prepare your workspace", detail: "Your email was verified, but account setup did not finish. Please sign in again to retry safely." };
  }
  return { tone: "error", title: "We could not complete sign-in", detail: "The secure sign-in expired or was cancelled. Please try again." };
}

function providerErrorNotice(error: unknown, action: "google" | "signup" | "recovery"): Notice {
  const message = error instanceof Error ? error.message : "";
  if (/missing public supabase|configuration|not configured/i.test(message)) return accountServiceNotice();
  if (action === "google" && /provider|oauth|google|not enabled/i.test(message)) {
    return { tone: "error", title: "Google sign-in is not available yet", detail: "Please continue with email, or try Google again after the sign-in service is enabled." };
  }
  if (action === "signup" && /already registered|already exists/i.test(message)) {
    return { tone: "error", title: "Use your existing account", detail: "This email may already have an account. Sign in instead, or reset your password." };
  }
  if (action === "signup" && /password|character|weak/i.test(message)) {
    return { tone: "error", title: "Choose a stronger password", detail: "Use 8 or more characters with uppercase, lowercase, a number, and a symbol." };
  }
  if (action === "recovery") {
    return { tone: "error", title: "We could not send the recovery link", detail: "Check the email address and try again in a moment." };
  }
  return accountServiceNotice();
}

export function LoginForm({ nextPath = "/chat", initialMode = "login", authError }: { nextPath?: string; initialMode?: EntryMode; authError?: string }) {
  const router = useRouter();
  const safeNextPath = safeAuthenticatedPath(nextPath);
  const [mode, setMode] = useState<Mode>(initialMode);
  const savedEmail = useSyncExternalStore(subscribeEmail, savedEmailSnapshot, serverEmail);
  const [editedEmail, setEmail] = useState<string | null>(null);
  const email = editedEmail ?? savedEmail;
  const [password, setPassword] = useState("");
  const [previousInitialMode, setPreviousInitialMode] = useState(initialMode);
  const [showPassword, setShowPassword] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(() => callbackErrorNotice(authError));
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [loading, setLoading] = useState(false);
  const callback = (next = safeNextPath) => `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
  // OAuth redirect URLs are checked against Supabase's allow-list as complete URLs.
  // Keep Google on the fixed, approved callback path; the server defaults it to /chat.
  const googleCallback = () => `${window.location.origin}/auth/callback`;
  const isSignup = mode === "signup";
  const isRecovery = mode === "recovery";

  // Synchronize route props before committing children, preserving the email draft.
  if (previousInitialMode !== initialMode) {
    setPreviousInitialMode(initialMode);
    setMode(initialMode);
    setPassword("");
  }

  function changeMode(nextMode: EntryMode) {
    if (nextMode === mode) return;
    setPassword("");
    setNotice(null);
    setFieldErrors({});
    setMode(nextMode);
    router.push(`/auth/${nextMode === "login" ? "login" : "signup"}?next=${encodeURIComponent(safeNextPath)}`);
  }

  function clearField(field: FieldName) {
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
    setNotice(null);
  }

  function validate() {
    const errors: Partial<Record<FieldName, string>> = {};
    if (!emailPattern.test(email.trim())) errors.email = "Enter a valid email address, such as you@example.com.";
    if (!isRecovery) {
      if (!password) errors.password = "Enter your password.";
      else if (isSignup) {
        const issue = getPasswordIssue(password);
        if (issue) errors.password = issue;
      }
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setNotice({ tone: "error", title: "Please review the highlighted fields", detail: "Correct the information below, then try again." });
      return false;
    }
    return true;
  }

  async function google() {
    setLoading(true);
    setNotice(null);
    setFieldErrors({});
    try {
      const { error } = await createClient().auth.signInWithOAuth({ provider: "google", options: { redirectTo: googleCallback(), skipBrowserRedirect: false } });
      if (!error) window.sessionStorage.removeItem("models-suite-auth-email");
      if (error) setNotice(providerErrorNotice(error, "google"));
    } catch (error) {
      setNotice(providerErrorNotice(error, "google"));
    } finally {
      setLoading(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setNotice(null);
    try {
      if (isRecovery) {
        const { error } = await createClient().auth.resetPasswordForEmail(email.trim(), { redirectTo: callback("/auth/update-password") });
        setNotice(error
          ? providerErrorNotice(error, "recovery")
          : { tone: "success", title: "Check your email for a recovery link", detail: "For security, the link will arrive only if this email belongs to an account." });
        return;
      }
      if (isSignup) {
        const { data, error } = await createClient().auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: callback() } });
        if (!error && data.session) {
          const provision = await fetch("/api/auth/provision", { method: "POST" });
          if (!provision.ok) {
            setNotice({ tone: "error", title: "Your account needs one more step", detail: "We could not finish setting up your workspace. Please try signing in again." });
            return;
          }
          window.sessionStorage.removeItem("models-suite-auth-email");
          window.location.assign(safeNextPath);
          return;
        }
        setNotice(error
          ? providerErrorNotice(error, "signup")
          : { tone: "success", title: "Check your email to finish creating your account", detail: "Open the secure verification link, then return here to sign in." });
        return;
      }

      const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.trim(), password }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (result.code === "INVALID_CREDENTIALS") {
          setFieldErrors({ email: "Check your email address and password.", password: "Check your email address and password." });
          setNotice({ tone: "error", title: "Those sign-in details do not match", detail: "Try again, or use “Forgot password?” if you need to reset it." });
        } else if (result.code === "EMAIL_NOT_CONFIRMED") {
          setNotice({ tone: "error", title: "Confirm your email first", detail: "Open the verification email we sent, then return to sign in." });
        } else {
          setNotice({ tone: "error", title: "We could not sign you in", detail: result.error || "Please try again shortly." });
        }
        return;
      }
      window.sessionStorage.removeItem("models-suite-auth-email");
      window.location.assign(safeNextPath);
    } catch {
      setNotice(accountServiceNotice());
    } finally {
      setLoading(false);
    }
  }

  const title = isRecovery ? "Reset your password" : isSignup ? "Create your account" : "Welcome back";
  // Present credential failures once, without suggesting which credential was wrong.
  // Keep all authentication execution handlers and password rules unchanged.
  const credentialsMismatch = notice?.title === "Those sign-in details do not match";
  const visibleErrors = Object.fromEntries(Object.entries(fieldErrors).filter(([, message]) => message !== "Check your email address and password."));
  const visibleNotice = notice?.title === "Please review the highlighted fields" ? null : notice;
  const passwordHint = visibleErrors.password || (password ? getPasswordIssue(password) || "Password ready" : "8+ characters, uppercase, lowercase, number & symbol");

  return <section className="auth-form-panel" aria-labelledby="auth-title">
    {!isRecovery && <div className="auth-mode-toggle" role="group" aria-label="Account access mode">
      <span className={`auth-mode-indicator ${isSignup ? "is-signup" : ""}`} aria-hidden="true" />
      <button type="button" aria-pressed={!isSignup} disabled={loading} onClick={() => changeMode("login")}>Sign in</button>
      <button type="button" aria-pressed={isSignup} disabled={loading} onClick={() => changeMode("signup")}>Create account</button>
    </div>}
    <div id="auth-form-content">
      <header className="auth-form-head"><span aria-hidden="true"><LockKey weight="duotone" /></span><div><h1 id="auth-title">{title}</h1>{isRecovery && <p>We’ll email you a reset link.</p>}</div></header>
      {!isRecovery && <><button className="auth-google" type="button" onClick={google} disabled={loading}><Image src="/google-g.png" width={20} height={20} alt="" unoptimized /><span>{loading ? "Please wait…" : "Continue with Google"}</span></button><div className="auth-divider"><span />or<span /></div></>}
    <form className="auth-form" onSubmit={submit} noValidate aria-busy={loading}>
      <label className={visibleErrors.email ? "has-error" : ""}><span id="auth-email-label">Email</span><input name="email" aria-labelledby="auth-email-label" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} disabled={loading} value={email} onChange={(event) => { setEmail(event.target.value); window.sessionStorage.setItem("models-suite-auth-email", event.target.value); clearField("email"); }} placeholder="you@example.com" aria-invalid={Boolean(visibleErrors.email)} aria-describedby={visibleErrors.email ? "email-error" : undefined} />{visibleErrors.email && <small className="auth-field-error" id="email-error" role="alert"><WarningCircle weight="fill" />Enter a valid email address.</small>}</label>
      {!isRecovery && <label className={visibleErrors.password ? "has-error" : ""}><span id="auth-password-label">Password</span><div className="auth-password"><input name="password" aria-labelledby="auth-password-label" type={showPassword ? "text" : "password"} autoComplete={isSignup ? "new-password" : "current-password"} disabled={loading} value={password} onChange={(event) => { setPassword(event.target.value); clearField("password"); }} placeholder={isSignup ? "Create a password" : "Enter your password"} aria-invalid={Boolean(visibleErrors.password)} aria-describedby={isSignup ? "password-help" : visibleErrors.password ? "password-error" : undefined} /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword}>{showPassword ? <EyeSlash /> : <Eye />}</button></div>{isSignup ? <small className={visibleErrors.password ? "auth-field-error" : password && !getPasswordIssue(password) ? "auth-password-policy is-valid" : "auth-field-help"} id="password-help" aria-live="polite">{passwordHint}</small> : visibleErrors.password && <small className="auth-field-error" id="password-error" role="alert"><WarningCircle weight="fill" />{visibleErrors.password}</small>}</label>}
      {mode === "login" && <button className="auth-forgot" type="button" disabled={loading} onClick={() => { setMode("recovery"); setNotice(null); setFieldErrors({}); }}>Forgot password?</button>}
      {visibleNotice && <div className={`auth-message ${visibleNotice.tone}`} role={visibleNotice.tone === "error" ? "alert" : "status"}>{visibleNotice.tone === "success" ? <Check weight="bold" /> : <WarningCircle weight="fill" />}<div><strong>{credentialsMismatch ? "Email or password is incorrect. Please try again." : visibleNotice.title}</strong>{!credentialsMismatch && <p>{visibleNotice.detail}</p>}</div></div>}
      <button className="auth-submit" disabled={loading}>{loading ? <><i className="auth-spinner" aria-hidden="true" />Please wait…</> : <>{isSignup ? "Create account" : isRecovery ? "Send reset link" : "Sign in"}<ArrowRight weight="bold" /></>}</button>
    </form>
    {isRecovery && <footer className="auth-switch"><button type="button" disabled={loading} onClick={() => { setMode("login"); setNotice(null); setFieldErrors({}); }}>Back to sign in</button></footer>}
    </div>
  </section>;
}


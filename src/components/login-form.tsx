"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Eye, EyeSlash, GoogleLogo, LockKey, ShieldCheck, WarningCircle } from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import { safeAuthenticatedPath } from "@/lib/security/request";

type Mode = "login" | "signup" | "recovery";
type EntryMode = Exclude<Mode, "recovery">;
type FieldName = "email" | "password";
type Notice = { tone: "error" | "success"; title: string; detail: string };

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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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

  useEffect(() => {
    const savedEmail = window.sessionStorage.getItem("models-suite-auth-email");
    if (savedEmail) setEmail(savedEmail);
  }, []);

  useEffect(() => {
    setMode(initialMode);
    setPassword("");
  }, [initialMode]);

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

  const header = isRecovery
    ? { eyebrow: "Account recovery", title: "Reset your password", detail: "We’ll email you a secure recovery link." }
    : isSignup
      ? { eyebrow: "Create your Models Suite account", title: "Create your account", detail: "Start creating with Models Suite." }
      : { eyebrow: "Sign in to Models Suite", title: "Welcome back", detail: "Continue where you left off." };

  return <section className="auth-form-panel" aria-labelledby="auth-title">
    {!isRecovery && <div className="auth-mode-toggle" role="tablist" aria-label="Account access mode">
      <span className={`auth-mode-indicator ${isSignup ? "is-signup" : ""}`} aria-hidden="true" />
      <button type="button" role="tab" aria-selected={!isSignup} aria-controls="auth-form-content" onClick={() => changeMode("login")}>Sign in</button>
      <button type="button" role="tab" aria-selected={isSignup} aria-controls="auth-form-content" onClick={() => changeMode("signup")}>Create account</button>
    </div>}
    <div id="auth-form-content" role="tabpanel">
      <header className="auth-form-head"><span aria-hidden="true"><LockKey weight="duotone" /></span><div><small>{header.eyebrow}</small><h1 id="auth-title">{header.title}</h1><p>{header.detail}</p></div></header>
      {!isRecovery && <><button className="auth-google" type="button" onClick={google} disabled={loading}><GoogleLogo weight="bold" /><span>{loading ? "Connecting to Google…" : "Continue with Google"}</span><ArrowRight aria-hidden="true" /></button><div className="auth-divider"><span />or continue with email<span /></div></>}
    <form className="auth-form" onSubmit={submit} noValidate>
      <label className={fieldErrors.email ? "has-error" : ""}><span>Email address</span><input type="email" autoComplete="email" value={email} onChange={(event) => { setEmail(event.target.value); window.sessionStorage.setItem("models-suite-auth-email", event.target.value); clearField("email"); }} placeholder="you@example.com" aria-invalid={Boolean(fieldErrors.email)} aria-describedby={fieldErrors.email ? "email-error" : "email-help"} /><small className="auth-field-help" id="email-help">We’ll only use this to access your Models Suite account.</small>{fieldErrors.email && <small className="auth-field-error" id="email-error"><WarningCircle weight="fill" />{fieldErrors.email}</small>}</label>
      {!isRecovery && <label className={fieldErrors.password ? "has-error" : ""}><span>{isSignup ? "New password" : "Password"}</span><div className="auth-password"><input type={showPassword ? "text" : "password"} autoComplete={isSignup ? "new-password" : "current-password"} value={password} onChange={(event) => { setPassword(event.target.value); clearField("password"); }} placeholder={isSignup ? "Create a strong password" : "Enter your password"} aria-invalid={Boolean(fieldErrors.password)} aria-describedby={fieldErrors.password ? "password-error" : isSignup ? "password-help password-policy" : undefined} /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeSlash /> : <Eye />}</button></div>{isSignup && <small className="auth-field-help" id="password-help">Use 8+ characters with uppercase, lowercase, a number, and a symbol.</small>}{isSignup && password && <small className={getPasswordIssue(password) ? "auth-password-policy" : "auth-password-policy is-valid"} id="password-policy" aria-live="polite">{getPasswordIssue(password) || "Password meets the account requirements."}</small>}{fieldErrors.password && <small className="auth-field-error" id="password-error"><WarningCircle weight="fill" />{fieldErrors.password}</small>}</label>}
      {mode === "login" && <button className="auth-forgot" type="button" onClick={() => { setMode("recovery"); setNotice(null); setFieldErrors({}); }}>Forgot password?</button>}
      <button className="auth-submit" disabled={loading}>{loading ? <i className="auth-spinner" /> : <>{isSignup ? "Create my account" : isRecovery ? "Email me a recovery link" : "Sign in to workspace"}<ArrowRight weight="bold" /></>}</button>
      {isSignup && <p className="auth-signup-note"><ShieldCheck weight="fill" />Verify your email to activate your account.</p>}
    </form>
    {notice && <div className={`auth-message ${notice.tone}`} role={notice.tone === "error" ? "alert" : "status"} aria-live={notice.tone === "error" ? "assertive" : "polite"}>{notice.tone === "success" ? <Check weight="bold" /> : <WarningCircle weight="fill" />}<div><strong>{notice.title}</strong><p>{notice.detail}</p></div></div>}
    <footer className="auth-switch">{isRecovery ? <>Remembered it? <button type="button" onClick={() => { setMode("login"); setNotice(null); setFieldErrors({}); }}>Back to sign in</button></> : isSignup ? <>Already have an account? <button type="button" onClick={() => changeMode("login")}>Sign in</button></> : <>New to Models Suite? <button type="button" onClick={() => changeMode("signup")}>Create an account</button></>}</footer>
    <p className="auth-legal"><ShieldCheck weight="fill" />Encrypted session · Protected by Supabase Auth</p>
    </div>
  </section>;
}


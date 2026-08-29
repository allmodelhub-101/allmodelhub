"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function LoginForm({ nextPath = "/chat" }: { nextPath?: string }) {
  const [mode, setMode] = useState<"login"|"signup">("login");
  const [email,setEmail] = useState("");
  const [password,setPassword] = useState("");
  const [message,setMessage] = useState("");
  const [loading,setLoading] = useState(false);

  async function google() {
    setLoading(true); setMessage("");
    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`;
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
    if (error) { setMessage(error.message); setLoading(false); }
  }

  async function magicLink() {
    if (!email) { setMessage("Enter your email first."); return; }
    setLoading(true); setMessage("");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}` } });
    setMessage(error ? error.message : "Check your email for your secure sign-in link.");
    setLoading(false);
  }

  async function submit(e: FormEvent) {
    e.preventDefault(); setLoading(true); setMessage("");
    const supabase = createClient();
    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}` } });
      setMessage(error ? error.message : "Check your email to verify your account.");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMessage(error.message); else window.location.href = nextPath;
    }
    setLoading(false);
  }

  return <>
    <button className="btn" type="button" style={{width:"100%"}} onClick={google} disabled={loading}>Continue with Google</button>
    <div className="divider">or use email</div>
    <form onSubmit={submit}>
      <label className="label">Email<input className="input" type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} required /></label>
      <label className="label">Password<input className="input" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={8} value={password} onChange={e=>setPassword(e.target.value)} required /></label>
      <button className="btn btn-primary" disabled={loading}>{loading ? "Please wait…" : mode === "login" ? "Login" : "Create account"}</button>
    </form>
    <button type="button" className="btn btn-ghost" style={{width:"100%",marginTop:8}} onClick={magicLink} disabled={loading}>Email me a sign-in link</button>
    {message && <div className="soft-card small" style={{padding:12,marginTop:14}}>{message}</div>}
    <button className="btn btn-ghost" style={{width:"100%",marginTop:8}} onClick={()=>setMode(mode === "login" ? "signup" : "login")}>{mode === "login" ? "New here? Create an account" : "Already have an account? Login"}</button>
  </>;
}

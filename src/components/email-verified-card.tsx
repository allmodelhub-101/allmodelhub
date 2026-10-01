"use client";

import { ArrowRight, CheckCircle } from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect } from "react";

export function EmailVerifiedCard() {
  useEffect(() => {
    const timer = window.setTimeout(() => window.location.replace("/chat"), 2000);
    return () => window.clearTimeout(timer);
  }, []);

  return <section className="verified-card" aria-labelledby="verified-title">
    <span className="verified-icon" aria-hidden="true"><CheckCircle weight="fill" /></span>
    <small>Secure verification complete</small>
    <h1 id="verified-title">Email verified</h1>
    <p>Your Models Suite account is ready.</p>
    <div className="verified-progress"><i /><span>Preparing your workspace...</span></div>
    <Link href="/chat">Continue to Chat <ArrowRight weight="bold" /></Link>
  </section>;
}


import { Brand } from "@/components/brand";
import Link from "next/link";
import type { ReactNode } from "react";

export function LegalPage({ title, updated = "August 29, 2026", children }: { title: string; updated?: string; children: ReactNode }) {
  const reviewed = process.env.NEXT_PUBLIC_LEGAL_REVIEWED === "true";
  return (
    <main className="legal-page">
      <div className="container legal-wrap">
        <div className="legal-nav"><Link href="/"><Brand /></Link><Link href="/support" className="btn btn-ghost">Support</Link></div>
        {!reviewed && <div className="confirm-box" style={{ marginBottom: 18 }}><b>Launch gate:</b> this policy is a technical starter template and must be reviewed for your final business entity, supplier agreements and applicable law before accepting paid customers.</div>}
        <div className="kicker">All Model Hub policy</div>
        <h1 className="page-title">{title}</h1>
        <p className="muted">Last updated {updated}</p>
        <article className="legal-copy">{children}</article>
      </div>
    </main>
  );
}

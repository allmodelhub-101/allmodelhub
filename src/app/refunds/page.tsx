import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { LEGAL_DOCUMENTS } from "@/lib/legal-documents";

export const metadata: Metadata = { title: "Credits & Refund Policy", description: LEGAL_DOCUMENTS.refunds.description };

export default function RefundsPage() {
  return <LegalPage document={LEGAL_DOCUMENTS.refunds} />;
}

import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { LEGAL_DOCUMENTS } from "@/lib/legal-documents";

export const metadata: Metadata = { title: "Terms of Service", description: LEGAL_DOCUMENTS.terms.description };

export default function TermsPage() {
  return <LegalPage document={LEGAL_DOCUMENTS.terms} />;
}

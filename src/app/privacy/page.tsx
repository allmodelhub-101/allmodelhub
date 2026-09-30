import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { LEGAL_DOCUMENTS } from "@/lib/legal-documents";

export const metadata: Metadata = { title: "Privacy Policy", description: LEGAL_DOCUMENTS.privacy.description };

export default function PrivacyPage() {
  return <LegalPage document={LEGAL_DOCUMENTS.privacy} />;
}

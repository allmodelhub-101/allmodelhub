import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { LEGAL_DOCUMENTS } from "@/lib/legal-documents";

export const metadata: Metadata = { title: "Acceptable Use Policy", description: LEGAL_DOCUMENTS["acceptable-use"].description };

export default function AcceptableUsePage() {
  return <LegalPage document={LEGAL_DOCUMENTS["acceptable-use"]} />;
}

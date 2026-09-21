import { AppShell } from "@/components/app-shell";
import { HistoryClient } from "@/components/history-client";
import { isFeatureEnabled } from "@/lib/feature-flags";

export const dynamic="force-dynamic";

export default async function HistoryPage(){
  const crossModalityHandoffs=await isFeatureEnabled("cross_modality_handoffs");
  return <AppShell><HistoryClient crossModalityHandoffs={crossModalityHandoffs}/></AppShell>;
}

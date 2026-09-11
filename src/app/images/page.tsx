import { AppShell } from "@/components/app-shell";
import { ImageStudio } from "@/components/image-studio";
import { isFeatureEnabled } from "@/lib/feature-flags";

export const dynamic = "force-dynamic";

export default async function Page() {
  const crossModalityHandoffs=await isFeatureEnabled("cross_modality_handoffs");
  return <AppShell><ImageStudio crossModalityHandoffs={crossModalityHandoffs} /></AppShell>;
}


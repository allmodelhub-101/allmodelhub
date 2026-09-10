import { AppShell } from "@/components/app-shell";
import { ImageStudio } from "@/components/image-studio";

export const dynamic = "force-dynamic";

export default function Page() {
  return <AppShell><ImageStudio /></AppShell>;
}


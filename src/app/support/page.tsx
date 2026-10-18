import {SupportWorkspace} from "@/components/support-workspace";
import { AppShell } from "@/components/app-shell";
import { SupportClient } from "@/components/simple-forms";

export const dynamic = "force-dynamic";

export default function Page() {
  return <AppShell><SupportWorkspace><SupportClient /></SupportWorkspace></AppShell>;
}



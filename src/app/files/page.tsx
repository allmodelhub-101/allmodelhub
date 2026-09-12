import { Files } from "@phosphor-icons/react/dist/ssr";
import { AppShell } from "@/components/app-shell";
import { FilesClient } from "@/components/files-client";
import { WorkspacePageHeader } from "@/components/workspace-page-header";
import "./files.css";

export const dynamic = "force-dynamic";

export default function Page() {
  return <AppShell><div className="workspace-page files-page"><WorkspacePageHeader eyebrow="Knowledge" title="Files" description="Secure source material, measured storage, and reusable context for every workspace." icon={<Files weight="fill" aria-hidden="true" />} /><FilesClient /></div></AppShell>;
}


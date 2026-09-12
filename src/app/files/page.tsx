import { Files } from "@phosphor-icons/react";import { AppShell } from "@/components/app-shell";import { FilesClient } from "@/components/simple-forms";import { WorkspacePageHeader } from "@/components/workspace-page-header";export const dynamic="force-dynamic";export default function Page(){return <AppShell><div className="workspace-page"><WorkspacePageHeader eyebrow="Knowledge" title="Files" description="Upload private source material and reuse it safely across project-aware creation." icon={Files}/><FilesClient/></div></AppShell>}




import { Files } from "@phosphor-icons/react/dist/ssr";import { AppShell } from "@/components/app-shell";import { FilesClient } from "@/components/simple-forms";import { WorkspacePageHeader } from "@/components/workspace-page-header";export const dynamic="force-dynamic";export default function Page(){return <AppShell><div className="workspace-page"><WorkspacePageHeader eyebrow="Knowledge" title="Files" description="Upload private source material and reuse it safely across project-aware creation." icon={<Files weight="fill" aria-hidden="true"/>}/><FilesClient/></div></AppShell>}



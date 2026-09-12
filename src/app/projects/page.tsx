import { FolderOpen } from "@phosphor-icons/react/dist/ssr";import { AppShell } from "@/components/app-shell";import { ProjectsClient } from "@/components/simple-forms";import { WorkspacePageHeader } from "@/components/workspace-page-header";export const dynamic="force-dynamic";export default function Page(){return <AppShell><div className="projects-page workspace-page"><WorkspacePageHeader eyebrow="Workspace" title="Projects" description="Keep instructions, conversations, and selected knowledge together for focused work." icon={<FolderOpen weight="fill" aria-hidden="true"/>}/><ProjectsClient/></div></AppShell>}




import { Lifebuoy } from "@phosphor-icons/react";import { AppShell } from "@/components/app-shell";import { SupportClient } from "@/components/simple-forms";import { WorkspacePageHeader } from "@/components/workspace-page-header";export const dynamic="force-dynamic";export default function Page(){return <AppShell><div className="workspace-page"><WorkspacePageHeader eyebrow="Help center" title="Support" description="Get help with payments, generations, your account, or a technical problem." icon={Lifebuoy}/><SupportClient/></div></AppShell>}




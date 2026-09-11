import { AppShell } from "@/components/app-shell";import { ProjectsClient } from "@/components/simple-forms";export const dynamic="force-dynamic";export default function Page(){return <AppShell><div className="projects-page"><div><div className="kicker">Workspace</div><h1 className="page-title">Projects</h1></div><ProjectsClient/></div></AppShell>}


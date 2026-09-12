import type { ReactNode } from "react";

export function WorkspacePageHeader({ eyebrow, title, description, icon }: { eyebrow: string; title: string; description: string; icon: ReactNode }) {
  return <header className="workspace-page-header">
    <span className="workspace-page-icon">{icon}</span>
    <div><span className="kicker">{eyebrow}</span><h1 className="page-title">{title}</h1><p className="muted">{description}</p></div>
  </header>;
}


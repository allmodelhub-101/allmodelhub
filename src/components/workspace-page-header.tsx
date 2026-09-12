import type { Icon } from "@phosphor-icons/react";

export function WorkspacePageHeader({ eyebrow, title, description, icon: Icon }: { eyebrow: string; title: string; description: string; icon: Icon }) {
  return <header className="workspace-page-header">
    <span className="workspace-page-icon"><Icon weight="fill" aria-hidden="true" /></span>
    <div><span className="kicker">{eyebrow}</span><h1 className="page-title">{title}</h1><p className="muted">{description}</p></div>
  </header>;
}


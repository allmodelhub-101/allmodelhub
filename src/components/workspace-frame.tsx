import "./workspace-shell.css";
import type { ReactNode } from "react";

// Layout only. Authentication and data access stay in the server AppShell.
export function WorkspaceFrame({ children, sidebar, topbar, auxiliary, lowBandwidth = false }: {
  children: ReactNode; sidebar: ReactNode; topbar: ReactNode; auxiliary?: ReactNode; lowBandwidth?: boolean;
}) {
  return <div className={`app-shell premium-workstation-shell responsive-workspace ${lowBandwidth ? "low-bandwidth" : ""}`}>
    {sidebar}<main className="app-main">{topbar}<div className="app-content">{children}</div></main>{auxiliary}
  </div>;
}

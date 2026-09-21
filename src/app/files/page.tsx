import { CloudArrowUp, FileText, Files, LockKey, Sparkle } from "@phosphor-icons/react/dist/ssr";
import { AppShell } from "@/components/app-shell";
import { FilesClient } from "@/components/files-client";
import "./files.css";

export const dynamic = "force-dynamic";

export default function Page() {
  return <AppShell><main className="workspace-page files-page files-redesign-page"><header className="files-hero"><div className="files-hero-copy"><span className="files-hero-icon"><Files weight="fill" /></span><div><div className="kicker">Knowledge</div><h1>Files</h1><p>Secure source material, measured storage, and reusable context for every workspace.</p></div></div><div className="files-hero-art" aria-hidden="true"><i><FileText weight="duotone" /></i><i><Files weight="duotone" /></i><i><Sparkle weight="fill" /></i><strong>Your knowledge<br/>powers better AI.<small>Upload, organize, and use your files across all workspaces.</small></strong></div></header><div className="files-benefits"><span><LockKey weight="fill"/>Secure &amp; encrypted</span><span><CloudArrowUp weight="fill"/>Reuse across workspaces</span><span><FileText weight="fill"/>Supports all major file types</span><span><Sparkle weight="fill"/>Built for AI workflows</span></div><FilesClient /></main></AppShell>;
}


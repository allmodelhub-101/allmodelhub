import {FilesWorkspace} from "@/components/files-workspace";
import { AppShell } from "@/components/app-shell";
import { FilesClient } from "@/components/files-client";
import "./files.css";

export const dynamic = "force-dynamic";

export default function Page() {
  return <AppShell><FilesWorkspace><FilesClient /></FilesWorkspace></AppShell>;
}


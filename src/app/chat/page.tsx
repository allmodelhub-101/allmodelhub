import { AppShell } from "@/components/app-shell";
import { ChatClient } from "@/components/chat-client";
import { listRuntimeModels } from "@/lib/model-store";

export const dynamic = "force-dynamic";
export default async function ChatPage(){
  const initialModels = await listRuntimeModels({ modality: "text" });
  return <AppShell><ChatClient initialModels={initialModels}/></AppShell>
}

import { AppShell } from "@/components/app-shell";
import { ChatClient } from "@/components/chat-client";

export const dynamic = "force-dynamic";
export default function ChatPage(){return <AppShell><ChatClient/></AppShell>}

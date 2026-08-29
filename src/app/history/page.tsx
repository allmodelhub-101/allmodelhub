import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { HistoryClient } from "@/components/history-client";
export const dynamic="force-dynamic";
export default function HistoryPage(){return <AppShell><div className="page-head"><div><div className="kicker">History</div><h1 className="page-title">Your conversations</h1><p className="muted">Search, pin, reopen or delete saved conversations. Private chats never appear here.</p></div><Link className="btn btn-primary" href="/chat">New chat</Link></div><HistoryClient/></AppShell>}

import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { HistoryClient } from "@/components/history-client";
export const dynamic="force-dynamic";
export default function HistoryPage(){return <AppShell><div className="library-page"><div className="page-head"><div><div className="kicker">Library</div><h1 className="page-title">Everything you create.</h1><p className="muted">Chats, generated media and uploaded files—searchable and reusable across every workspace.</p></div><Link className="btn btn-primary" href="/chat">New creation</Link></div><HistoryClient/></div></AppShell>}


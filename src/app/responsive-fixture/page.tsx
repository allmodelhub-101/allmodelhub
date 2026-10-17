import { localResponsiveFixtureAllowed } from "@/lib/responsive-fixture-access";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { ChatFixture } from "@/components/chat-fixture";
import { ResponsiveFixture } from "@/components/responsive-fixture";
import {AdminFixture} from "@/components/admin-fixture";
import {WorkspaceDataFixture} from "@/components/workspace-data-fixture";
import {StudioFixture} from "@/components/studio-fixtures";

export default async function Page({ searchParams }: { searchParams: Promise<{ chrome?: string; chat?: string; surface?:string; studio?:string; state?:string }> }) {
  const host = (await headers()).get("host") || "";
  // All gates are required. This renders synthetic data, never a session or auth bypass.
  if (!localResponsiveFixtureAllowed({ mode:process.env.NODE_ENV, flag:process.env.LOCAL_RESPONSIVE_FIXTURES, vercel:process.env.VERCEL, host })) notFound();
  const params = await searchParams;
  if(params.surface==="admin")return <AdminFixture/>;
  if(params.surface)return <WorkspaceDataFixture surface={params.surface} state={params.state}/>;
  if(params.studio)return <StudioFixture studio={params.studio} state={params.state}/>;
  if (params.chat) return <ChatFixture state={params.chat} />;
  return <ResponsiveFixture chatChrome={params.chrome === "chat"} />;
}

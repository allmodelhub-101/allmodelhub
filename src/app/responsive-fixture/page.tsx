import { localResponsiveFixtureAllowed } from "@/lib/responsive-fixture-access";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { ResponsiveFixture } from "@/components/responsive-fixture";

export default async function Page({ searchParams }: { searchParams: Promise<{ chrome?: string }> }) {
  const host = (await headers()).get("host") || "";
  // All gates are required. This renders synthetic data, never a session or auth bypass.
  if (!localResponsiveFixtureAllowed({ mode:process.env.NODE_ENV, flag:process.env.LOCAL_RESPONSIVE_FIXTURES, vercel:process.env.VERCEL, host })) notFound();
  return <ResponsiveFixture chatChrome={(await searchParams).chrome === "chat"} />;
}

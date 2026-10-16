import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { ResponsiveFixture } from "@/components/responsive-fixture";

export default async function Page() {
  const host = (await headers()).get("host") || "";
  // All gates are required. This renders synthetic data, never a session or auth bypass.
  if (process.env.NODE_ENV !== "development" || process.env.LOCAL_RESPONSIVE_FIXTURES !== "1" ||
      process.env.VERCEL || !/^(127\.0\.0\.1|localhost|\[::1\])(?::\d+)?$/.test(host)) notFound();
  return <ResponsiveFixture />;
}

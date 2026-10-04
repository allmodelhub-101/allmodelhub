import { notFound } from "next/navigation";
import {
  VideoStudio,
  type VideoStudioFixtureState,
} from "@/components/video-studio";

const states = new Set<VideoStudioFixtureState>([
  "idle",
  "queued",
  "submitted",
  "processing",
  "settling",
  "completed",
  "failed",
  "cancelled",
  "expired",
]);

export default async function VideoStudioFixture({
  searchParams,
}: {
  searchParams: Promise<{ state?: string; theme?: string }>;
}) {
  // This isolated fixture is intentionally unavailable in deployed environments.
  if (process.env.NODE_ENV === "production") notFound();

  const { state, theme } = await searchParams;
  const fixtureState = states.has(state as VideoStudioFixtureState)
    ? (state as VideoStudioFixtureState)
    : "idle";

  return (
    <VideoStudio
      fixtureState={fixtureState}
      fixtureTheme={theme === "dark" ? "dark" : "light"}
    />
  );
}

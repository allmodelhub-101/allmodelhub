import { AppShell } from "@/components/app-shell";import { VideoStudio } from "@/components/video-studio";import { FeatureUnavailable } from "@/components/feature-unavailable";import { isFeatureEnabled } from "@/lib/feature-flags";export const dynamic="force-dynamic";export default async function Page(){const enabled=await isFeatureEnabled("video_studio");return <AppShell>{enabled?<VideoStudio/>:<FeatureUnavailable title="Video Studio"/>}</AppShell>}




import type { MetadataRoute } from "next";
import { BRAND } from "@/lib/brand";
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: BRAND.name,
    short_name: BRAND.shortName,
    description: BRAND.tagline,
    lang: "en",
    start_url: "/chat",
    scope: "/",
    display: "standalone",
    background_color: "#05070a",
    theme_color: "#05070a",
    icons: [
      { src: "/pwa/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    categories: ["productivity", "utilities"],
    prefer_related_applications: false,
  };
}

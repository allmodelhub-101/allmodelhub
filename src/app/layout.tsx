import type { Metadata } from "next";
import "./globals.css";
import { PwaRegister } from "@/components/pwa-register";
import { BRAND } from "@/lib/brand";
import Script from "next/script";

export const metadata: Metadata = {
  title: { default: `${BRAND.name} — ${BRAND.tagline}`, template: `%s | ${BRAND.name}` },
  description: "Use leading AI chat, image, video and audio models from one premium PKR-first workspace.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  icons: { icon: BRAND.logoPath, apple: BRAND.logoPath },
  openGraph: { title: `${BRAND.name} — ${BRAND.tagline}`, siteName: BRAND.name, images: [BRAND.logoPath] }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning><body><Script id="models-suite-theme" strategy="beforeInteractive">{`try{document.documentElement.dataset.theme=localStorage.getItem("amh-theme")==="dark"?"dark":"light"}catch{document.documentElement.dataset.theme="light"}`}</Script><PwaRegister/>{children}</body></html>;
}

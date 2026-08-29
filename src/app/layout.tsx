import type { Metadata } from "next";
import "./globals.css";
import { PwaRegister } from "@/components/pwa-register";

export const metadata: Metadata = {
  title: { default: "All Model Hub — Every Leading AI. One PKR Wallet.", template: "%s | All Model Hub" },
  description: "Use leading AI chat, image, video and audio models from one premium PKR-first workspace.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000")
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning><body><PwaRegister/>{children}</body></html>;
}

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { AndroidInstallButton } from "@/components/android-install-button";
import release from "../../../android/release.json";
import styles from "./android.module.css";

export const metadata: Metadata = {
  title: "Models Suite for Android",
  description: "Your premium AI workspace on Android. Install Models Suite from Chrome or learn about the Android app.",
  alternates: { canonical: "https://www.modelssuite.com/android" },
};

export default function AndroidPage() {
  // No download CTA until a signed release is deliberately published and its
  // immutable URL, checksum and size are recorded by the release script.
  const download = release.distribution;
  const available = download.published && typeof download.apkUrl === "string" && /^https:\/\//.test(download.apkUrl) && typeof download.sha256 === "string" && /^[a-f0-9]{64}$/.test(download.sha256) && Number(download.bytes) > 0;
  return <main className={styles.page}>
    <header className={styles.header}><Brand /><div><ThemeToggle /><Link href="/chat">Open workspace <span aria-hidden="true">↗</span></Link></div></header>
    <section className={styles.hero} aria-labelledby="android-title">
      <div className={styles.copy}><span className={styles.eyebrow}>MODELS SUITE FOR ANDROID</span><h1 id="android-title">Your AI workspace.<br /><em>Always within reach.</em></h1><p>Chat, create images, explore video and work with audio. The Models Suite experience you know, with a place on your home screen.</p><div className={styles.install}><AndroidInstallButton /></div><div className={styles.meta}><span>Android app v{release.versionName}</span><span>Android 7.0+</span><span>Internet required</span></div></div>
      <div className={styles.appCard}><div className={styles.halo} /><Image src="/pwa/icon-512.png" alt="Models Suite app icon" width={160} height={160} priority /><strong>Models Suite</strong><span>Every Leading AI. One PKR Wallet.</span><div className={styles.pills}><span>Chat</span><span>Image</span><span>Video</span><span>Audio</span></div><small>Your existing account. Your familiar workspace.</small></div>
    </section>
    <section className={styles.features} aria-label="App highlights"><article><span>01</span><h2>Made for your day</h2><p>Launch directly from your home screen in a dedicated app window.</p></article><article><span>02</span><h2>One familiar workspace</h2><p>Use the same models, projects and account across your phone and computer.</p></article><article><span>03</span><h2>Connected by design</h2><p>AI creation runs online. A clear offline screen helps you reconnect safely.</p></article></section>
    <section id="install-guide" className={styles.guide}><div><span className={styles.eyebrow}>TWO WAYS TO GET STARTED</span><h2>A home for your ideas.</h2><p>Choose Chrome installation now, or use a signed Android download when it becomes available.</p></div><div className={styles.steps}><article><h3>Install from Chrome</h3><ol><li>Open this website in Chrome on your Android phone.</li><li>Tap <strong>Install from Chrome</strong> above when offered, or open Chrome’s ⋮ menu.</li><li>Choose <strong>Install app</strong> or <strong>Add to Home screen</strong>, then confirm.</li></ol><p>The menu wording and availability depend on Chrome and your device.</p></article><article><h3>Android APK</h3>{available ? <><a className={styles.download} href={download.apkUrl!}>Download APK · v{release.versionName}</a><p>After downloading, allow installation for your browser only when Android asks. Turn that permission off afterward. Install updates from this page using the same signing identity.</p><details><summary>Verify your download</summary><code>SHA-256: {download.sha256}</code><p>{Number(download.bytes).toLocaleString("en-US")} bytes · {release.applicationId}</p></details></> : <><span className={styles.pending}>Direct download is being prepared</span><p>A download button will appear here after a signed APK is published. You can install the web app from Chrome today.</p></>}</article></div></section>
    <footer className={styles.footer}><span>Models Suite · Android</span><nav aria-label="Android page footer"><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/support">Support</Link></nav></footer>
  </main>;
}

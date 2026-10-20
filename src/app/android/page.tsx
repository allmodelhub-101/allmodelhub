import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { AndroidLogo, ArrowDown, ArrowUpRight, ChatCircleDots, GlobeSimple, ImageSquare, ShieldCheck, VideoCamera, Waveform } from "@phosphor-icons/react/dist/ssr";
import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { AndroidInstallButton } from "@/components/android-install-button";
import { AndroidAppPreview } from "@/components/android-app-preview";
import release from "../../../android/release.json";
import styles from "./android.module.css";

export const metadata: Metadata = {
  title: "Models Suite for Android",
  description: "Your premium AI workspace, in your pocket. Explore Models Suite for Android and install the web app from Chrome.",
  alternates: { canonical: "https://www.modelssuite.com/android" },
};

const features = [
  { id: "chat", title: "A conversation away.", name: "Chat", icon: ChatCircleDots, description: "Find your next idea. Write, reason and explore with the models available in your workspace." },
  { id: "image", title: "Imagine the possibilities.", name: "Image", icon: ImageSquare, description: "Turn a prompt into a visual direction. Bring references and explore image creation tools." },
  { id: "video", title: "Give your story motion.", name: "Video", icon: VideoCamera, description: "Shape a scene, choose an available model and create from your existing Video Studio." },
  { id: "audio", title: "Find your signature sound.", name: "Audio", icon: Waveform, description: "Explore speech, music and sound effects in the same familiar creative workspace." },
] as const;

export default function AndroidPage() {
  // Preserve verified-download gating: no APK CTA until approved public hosting
  // has an immutable HTTPS URL, validated checksum and positive byte count.
  const download = release.distribution;
  const available = download.published && typeof download.apkUrl === "string" && /^https:\/\//.test(download.apkUrl) && typeof download.sha256 === "string" && /^[a-f0-9]{64}$/.test(download.sha256) && Number(download.bytes) > 0;

  return <main className={styles.page}>
    <div className={styles.topGlow} aria-hidden="true" />
    <div className={styles.shell}>
      <header className={styles.header}>
        <Brand />
        <div className={styles.headerActions}><ThemeToggle /><Link href="/chat" className={styles.workspaceLink}>Open workspace<ArrowUpRight size={15} aria-hidden="true" /></Link></div>
      </header>

      <section className={styles.hero} aria-labelledby="android-title">
        <div className={styles.copy}>
          <div className={styles.appIdentity}>
            <div className={styles.iconWell}><Image src="/pwa/icon-192.png" alt="Official Models Suite app icon" width={56} height={56} /></div>
            <div><span className={styles.eyebrow}>MODELS SUITE</span><span className={styles.androidBadge}><AndroidLogo size={14} weight="fill" aria-hidden="true" />Made for Android</span></div>
          </div>
          <h1 id="android-title">Your AI universe.<br /><span>In your pocket.</span></h1>
          <p className={styles.intro}>Chat, create and explore with your favorite AI tools. Your Models Suite workspace, beautifully at home on Android.</p>
          <div className={styles.install}><AndroidInstallButton download={available ? { url: download.apkUrl!, version: release.versionName } : undefined} /></div>
          <ul className={styles.meta} aria-label="App compatibility and version"><li>Version {release.versionName}</li><li>Android 7.0+</li><li>Internet required</li></ul>
          <a className={styles.exploreLink} href="#the-experience">Meet your mobile workspace<ArrowDown size={14} aria-hidden="true" /></a>
        </div>
        <AndroidAppPreview />
      </section>

      <div className={styles.reassurance} aria-label="The Models Suite experience">
        <span><ShieldCheck size={18} weight="duotone" aria-hidden="true" />Your existing account</span>
        <span><GlobeSimple size={18} weight="duotone" aria-hidden="true" />Connected across devices</span>
        <span><AndroidLogo size={18} weight="duotone" aria-hidden="true" />A home-screen experience</span>
      </div>

      <section className={styles.experience} id="the-experience" aria-labelledby="experience-title">
        <div className={styles.sectionHeading}>
          <div><span className={styles.eyebrow}>ONE WORKSPACE. FOUR DIRECTIONS.</span><h2 id="experience-title">Made for your next<br /><span>“what if?”</span></h2></div>
          <p>From a spark of an idea to something you can share. The tools you know, ready to go wherever you do.</p>
        </div>
        <div className={styles.features}>
          {features.map(({ id, title, name, icon: Icon, description }, index) => <article className={styles.feature} key={id}>
            <div className={styles.featureTop}><span className={styles.featureIcon}><Icon size={22} weight="duotone" aria-hidden="true" /></span><span>{`0${index + 1}`} / {name}</span></div>
            <h3>{title}</h3><p>{description}</p>
            <div className={styles.featurePreview} aria-hidden="true">
              <Image className={styles.screenDark} src={`/android/previews/${id}-dark.webp`} alt="" width={390} height={844} unoptimized />
              <Image className={styles.screenLight} src={`/android/previews/${id}-light.webp`} alt="" width={390} height={844} unoptimized />
            </div>
          </article>)}
        </div>
        <p className={styles.previewDisclaimer}>Existing workspace interfaces with example content. Model availability and feature access depend on your account. Some tools require Credits.</p>
      </section>

      <section id="install-guide" className={styles.guide} aria-labelledby="install-title">
        <div className={styles.guideIntro}>
          <span className={styles.eyebrow}>A FEW TAPS. A NEW POSSIBILITY.</span><h2 id="install-title">Make room for<br /><span>your next idea.</span></h2>
          <p>Choose the way that works for you. Same Models Suite. Same account. A little closer.</p>
          <div className={styles.guideMark}><Image src="/pwa/icon-192.png" alt="" width={40} height={40} /><span>Models Suite<strong>v{release.versionName} · Android 7.0+</strong></span></div>
        </div>
        <div className={styles.steps}>
          <article className={styles.chromeCard}>
            <div className={styles.methodHeading}><span className={styles.methodIcon}><GlobeSimple size={22} aria-hidden="true" /></span><div><span className={styles.methodKicker}>BROWSER INSTALLATION</span><h3>Install from Chrome</h3></div><span className={styles.recommended}>Web app</span></div>
            <ol>
              <li><span>01</span><div><strong>Open in Chrome</strong><p>Visit this page in Chrome on your Android phone.</p></div></li>
              <li><span>02</span><div><strong>Make it yours</strong><p>Tap the install button when offered, or choose <b>Install app</b> or <b>Add to Home screen</b> from Chrome’s ⋮ menu.</p></div></li>
              <li><span>03</span><div><strong>You’re ready to explore</strong><p>Confirm, then open Models Suite from your home screen and sign in.</p></div></li>
            </ol>
            <p className={styles.methodNote}>Browser wording and availability vary. On other browsers or devices, use Chrome on an Android phone. AI features need an internet connection.</p>
          </article>
          <article className={styles.apkCard}>
            <div className={styles.methodHeading}><span className={styles.methodIcon}><AndroidLogo size={22} aria-hidden="true" /></span><div><span className={styles.methodKicker}>DIRECT INSTALLATION</span><h3>Signed Android APK</h3></div><span className={styles.releasePill}>{available ? `v${release.versionName}` : "Coming soon"}</span></div>
            {available ? <><a className={styles.download} href={download.apkUrl!}>Download APK · v{release.versionName}<ArrowDown size={18} aria-hidden="true" /></a><p>Download the signed file, then allow your browser to install it when Android asks. Turn that permission off afterward. Always update from this page.</p><details><summary>Version and download integrity</summary><code>SHA-256: {download.sha256}</code><p>{Number(download.bytes).toLocaleString("en-US")} bytes · {release.applicationId}</p></details></> : <p>The signed Android package is prepared and awaiting publication approval. There’s no APK download available yet. You can use the Chrome web app in the meantime.</p>}
          </article>
        </div>
      </section>

      <footer className={styles.footer}>
        <div><Brand /><p>Your ideas deserve a beautiful workspace.</p></div>
        <nav aria-label="Android page footer"><Link href="/privacy">Privacy</Link><Link href="/support">Support<ArrowUpRight size={12} aria-hidden="true" /></Link><Link href="/terms">Terms</Link></nav>
        <div className={styles.footerMeta}><span>Models Suite for Android · v{release.versionName}</span><span>Every Leading AI. One PKR Wallet.</span></div>
      </footer>
    </div>
  </main>;
}

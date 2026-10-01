import {
  ArrowRight,
  CheckCircle,
  ClockCounterClockwise,
  FileText,
  HandHeart,
  List,
  LockKey,
  ShieldCheck,
  Sparkle,
  Warning,
} from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import Image from "next/image";
import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import type { LegalDocument, LegalDocumentKind } from "@/lib/legal-documents";
import { BRAND } from "@/lib/brand";
import styles from "./legal-page.module.css";

const policyLinks: readonly { kind: LegalDocumentKind; label: string; href: string }[] = [
  { kind: "terms", label: "Terms of Service", href: "/terms" },
  { kind: "privacy", label: "Privacy Policy", href: "/privacy" },
  { kind: "acceptable-use", label: "Acceptable Use", href: "/acceptable-use" },
  { kind: "refunds", label: "Credits & Refunds", href: "/refunds" },
];

const kindIcons = {
  terms: FileText,
  privacy: ShieldCheck,
  "acceptable-use": CheckCircle,
  refunds: ClockCounterClockwise,
} as const;

const sectionIcons = [ShieldCheck, Sparkle, LockKey, HandHeart, FileText, CheckCircle, ClockCounterClockwise] as const;

export function LegalPage({ document }: { document: LegalDocument }) {
  const reviewed = process.env.LEGAL_REVIEWED === "true";
  const HeroIcon = kindIcons[document.kind];

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Brand />
          <nav className={styles.primaryNav} aria-label="Primary navigation">
            <Link href="/#models">Models</Link>
            <Link href="/#create">Create</Link>
            <Link href="/#credits">Credits</Link>
            <Link className={styles.activeNav} href="/privacy">Policies</Link>
            <Link href="/#faq">FAQ</Link>
          </nav>
          <div className={styles.headerActions}>
            <ThemeToggle />
            <Link className={styles.loginLink} href="/auth/login">Login</Link>
            <Link className={styles.startLink} href="/auth/login">Start Free</Link>
          </div>
        </div>
      </header>

      <section className={styles.hero} aria-labelledby="legal-title">
        <div className={styles.heroGlow} aria-hidden="true" />
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}><span />{document.eyebrow}</p>
          <h1 id="legal-title">{document.title}</h1>
          <p className={styles.description}>{document.description}</p>
          <div className={styles.heroMeta}>
            <span>Last updated {document.updated}</span>
            <span aria-hidden="true">•</span>
            <span>Plain-language summary with full policy details</span>
          </div>
        </div>
        <div className={styles.heroVisual} aria-hidden="true">
          <div className={styles.trustPanel}>
            <Image src={BRAND.logoPath} alt="" width={96} height={96} priority />
            <div><p>Models Suite policies</p><strong>Trust, made readable.</strong></div>
          </div>
          <div className={styles.trustRow}><HeroIcon size={20} weight="duotone" /><span><strong>Clear terms</strong><small>Plain language first</small></span></div>
          <div className={styles.trustRow}><LockKey size={20} weight="duotone" /><span><strong>Your control</strong><small>Choices explained</small></span></div>
          <div className={styles.trustRow}><CheckCircle size={20} weight="duotone" /><span><strong>Transparent policies</strong><small>Details when you need them</small></span></div>
        </div>
      </section>

      <nav className={styles.policySwitcher} aria-label="Legal policies">
        {policyLinks.map((item) => {
          const Icon = kindIcons[item.kind];
          const active = document.kind === item.kind;
          return <Link className={active ? styles.policyActive : undefined} href={item.href} key={item.kind} aria-current={active ? "page" : undefined}>
            <Icon size={20} weight={active ? "fill" : "regular"} aria-hidden="true" />
            <span>{item.label}</span>
          </Link>;
        })}
      </nav>

      {!reviewed && <aside className={styles.reviewNotice} aria-label="Policy review notice">
        <Warning size={22} weight="fill" aria-hidden="true" />
        <div><strong>Pre-launch review required</strong><p>This policy is a technical starter template and must be reviewed for the final business entity, supplier agreements, and applicable law before accepting paid customers.</p></div>
      </aside>}

      <section className={styles.mobileContents}>
        <details>
          <summary><List size={20} weight="bold" aria-hidden="true" />On this page</summary>
          <nav aria-label="Page sections">{document.sections.map((section, index) => <a href={`#${section.id}`} key={section.id}><span>{String(index + 1).padStart(2, "0")}</span>{section.title}</a>)}</nav>
        </details>
      </section>

      <div className={styles.contentGrid}>
        <aside className={styles.contents}>
          <p>On this page</p>
          <nav aria-label="Page sections">
            {document.sections.map((section, index) => <a href={`#${section.id}`} key={section.id}><span>{String(index + 1).padStart(2, "0")}</span>{section.title}</a>)}
          </nav>
        </aside>

        <article className={styles.article}>
          <section className={styles.glance} aria-labelledby="at-a-glance">
            <div className={styles.glanceHeading}>
              <p className={styles.miniKicker}>At a glance</p>
              <h2 id="at-a-glance">The essentials, before the detail.</h2>
            </div>
            <div className={styles.highlightGrid}>
              {document.highlights.map((highlight, index) => {
                const Icon = sectionIcons[index];
                return <div className={styles.highlight} key={highlight.title}><span><Icon size={21} weight="duotone" aria-hidden="true" /></span><div><h3>{highlight.title}</h3><p>{highlight.detail}</p></div></div>;
              })}
            </div>
          </section>

          <div className={styles.sectionList}>
            {document.sections.map((section, index) => {
              const Icon = sectionIcons[index % sectionIcons.length];
              return <section className={styles.policySection} id={section.id} key={section.id}>
                <div className={styles.sectionNumber}>{String(index + 1).padStart(2, "0")}</div>
                <div className={styles.sectionIcon}><Icon size={23} weight="duotone" aria-hidden="true" /></div>
                <div className={styles.sectionCopy}>
                  <h2>{section.title}</h2>
                  <p className={styles.sectionSummary}>{section.summary}</p>
                  {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                  {section.bullets && <ul>{section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>}
                </div>
              </section>;
            })}
          </div>
        </article>

        <aside className={styles.supportCard}>
          <span><HandHeart size={25} weight="duotone" aria-hidden="true" /></span>
          <p className={styles.miniKicker}>Need help?</p>
          <h2>Policy questions deserve a clear answer.</h2>
          <p>Contact Models Suite Support for questions about your account, billing, privacy, or platform rules.</p>
          <Link href="/support">Contact Support <ArrowRight size={17} weight="bold" aria-hidden="true" /></Link>
        </aside>
      </div>

      <footer className={styles.footer}>
        <div className={styles.footerBrand}><Brand /><p>Every leading AI. One PKR wallet.</p></div>
        <nav aria-label="Footer policies">{policyLinks.map((item) => <Link href={item.href} key={item.kind}>{item.label}</Link>)}</nav>
        <p>© 2026 Models Suite. All rights reserved.</p>
      </footer>
    </main>
  );
}

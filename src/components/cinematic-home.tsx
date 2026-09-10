import Link from "next/link";
import { HomeNav } from "./home-nav";
import { HomeReveal } from "./home-reveal";
import styles from "./cinematic-home.module.css";

const models = ["GPT", "Claude", "Gemini", "Grok", "DeepSeek", "Llama", "Image AI", "Video AI", "Voice AI"];
const features = [
  { number: "01", icon: "✦", title: "One prompt. The right model.", body: "Auto Best weighs quality, speed, price and availability, then routes your work without making you learn every model first.", tag: "Smart routing", featured: true },
  { number: "02", icon: "⇄", title: "Compare before you decide.", body: "Run the same prompt through two or three models and inspect their answers side by side with Model Battle.", tag: "Model Battle" },
  { number: "03", icon: "◫", title: "Create beyond text.", body: "Move naturally between chat, images, video, voice and music inside one focused production space.", tag: "5 creative modes" },
  { number: "04", icon: "₨", title: "Costs that read like money.", body: "One credit equals one rupee, with clear estimates and receipts instead of mysterious token calculations.", tag: "PKR wallet" },
  { number: "05", icon: "⌁", title: "Context that stays useful.", body: "Organize work into projects, attach documents and keep conversations connected to the material that matters.", tag: "Projects + files" },
];
const useCases = [
  ["Freelancers", "Draft proposals, compare research, build client assets and keep every project in one place."],
  ["Students", "Understand difficult topics, work through documents and switch naturally between English and Urdu."],
  ["Creators", "Turn an idea into copy, visuals, voice and video without juggling separate subscriptions."],
  ["Businesses", "Give teams practical AI access with transparent local costs and auditable usage."],
];
const faqs = [
  ["What is one All Model Hub credit worth?", "One credit equals PKR 1. Purchased credits do not expire under the current product policy."],
  ["Do I have to know which AI model to choose?", "No. Auto Best can route each task using quality, speed, cost and availability. Advanced users can still choose an exact model."],
  ["Can I use several models on the same question?", "Yes. Model Battle sends one prompt to two or three selected models so you can compare answers in one view."],
  ["Does it support images, video and voice?", "Yes. All Model Hub brings chat, image, video, voice and music workflows into one account and one wallet."],
  ["How do local payments work?", "At launch, customers can submit Easypaisa or Meezan payment details for review. Credits are added after approval."],
  ["Will it work on my phone and slower internet?", "The interface is fully responsive and includes practical low-bandwidth behavior for users on slower connections."],
];

export function CinematicHome() {
  return <main className={styles.site}>
    <HomeReveal />
    <HomeNav />

    <section className={styles.hero} aria-labelledby="hero-title">
      <div className={styles.noise} aria-hidden="true" />
      <div className={styles.heroGlow} aria-hidden="true" />
      <div className={styles.heroGrid} aria-hidden="true" />
      <div className={styles.container}>
        <div className={styles.heroCopy}>
          <div className={styles.eyebrow}><i /> The AI workspace built for Pakistan <span>New</span></div>
          <h1 id="hero-title">Every leading AI.<br/><em>One clear workspace.</em></h1>
          <p>Chat, reason and create with the world&apos;s best AI models—without separate subscriptions, confusing USD pricing or a dozen open tabs.</p>
          <div className={styles.heroActions}>
            <Link className={styles.primaryButton} href="/auth/login">Start creating free <span aria-hidden="true">↗</span></Link>
            <a className={styles.secondaryButton} href="#product"><span className={styles.playIcon} aria-hidden="true">▶</span> See how it works</a>
          </div>
          <div className={styles.heroMeta}>
            <span><b>10</b> welcome credits</span><i/><span>No card required</span><i/><span>English · اردو · Roman Urdu</span>
          </div>
        </div>

        <div className={styles.commandCenter} aria-label="All Model Hub product preview">
          <div className={styles.windowBar}><div><i/><i/><i/></div><span><b>●</b> All systems ready</span><em>allmodelhub.app</em></div>
          <div className={styles.previewBody}>
            <aside className={styles.previewSidebar} aria-hidden="true">
              <div className={styles.miniLogo}>A</div>
              {["✦","◫","▶","♫","⇄"].map((item, index) => <span className={index === 0 ? styles.active : ""} key={item}>{item}</span>)}
              <span className={styles.sideBottom}>⚙</span>
            </aside>
            <div className={styles.previewMain}>
              <div className={styles.previewTop}><div><small>NEW CONVERSATION</small><strong>Auto Best <i>Recommended</i></strong></div><span>Balance <b>2,500</b></span></div>
              <div className={styles.promptCard}><span>YOU</span><p>Build a launch strategy for a Pakistan-first fashion brand. Compare the strongest approaches.</p></div>
              <div className={styles.routing}><div className={styles.routeTitle}><span className={styles.spark}>✦</span><div><small>AUTO BEST</small><strong>Routing across leading models</strong></div><em>0.8s</em></div>
                <div className={styles.modelResults}>
                  <article><header><i className={styles.openaiDot}>O</i><b>GPT</b><span>Strategy</span></header><div/><div/><div className={styles.short}/></article>
                  <article className={styles.winner}><header><i className={styles.claudeDot}>C</i><b>Claude</b><span>Best match</span></header><div/><div/><div className={styles.short}/></article>
                  <article><header><i className={styles.geminiDot}>G</i><b>Gemini</b><span>Research</span></header><div/><div/><div className={styles.short}/></article>
                </div>
              </div>
              <div className={styles.composer}><span>Ask anything. Create anything.</span><div><i>＋</i><i>⌘</i><button aria-label="Send prompt">↑</button></div></div>
            </div>
          </div>
        </div>
        <a className={styles.scrollCue} href="#models"><span>Explore</span><i /></a>
      </div>
    </section>

    <section className={styles.modelRail} id="models" aria-label="Supported AI capabilities">
      <p>One account for the models moving AI forward</p>
      <div className={styles.marquee}><div>{[...models, ...models].map((model, index) => <span key={`${model}-${index}`}><i>{model.charAt(0)}</i>{model}</span>)}</div></div>
    </section>

    <section className={styles.product} id="product">
      <div className={styles.container}>
        <div className={styles.sectionHeading} data-reveal>
          <span className={styles.kicker}>01 — One intelligent workspace</span>
          <h2>Less switching.<br/><em>More creating.</em></h2>
          <p>All Model Hub brings the strongest AI capabilities into a single calm, connected system.</p>
        </div>
        <div className={styles.bentoGrid}>
          {features.map((feature, index) => <article className={`${styles.featureCard} ${feature.featured ? styles.featuredCard : ""}`} style={{"--delay": `${index * 70}ms`} as React.CSSProperties} data-reveal key={feature.number}>
            <div className={styles.featureTop}><span>{feature.number}</span><i>{feature.icon}</i></div>
            {feature.featured && <div className={styles.routeMap} aria-hidden="true"><span>Prompt</span><i/><i/><i/><b>G</b><b>C</b><b>G</b></div>}
            <div className={styles.featureCopy}><small>{feature.tag}</small><h3>{feature.title}</h3><p>{feature.body}</p></div>
          </article>)}
        </div>
      </div>
    </section>

    <section className={styles.workflow}>
      <div className={styles.container}>
        <div className={styles.workflowGrid}>
          <div className={styles.sectionHeading} data-reveal><span className={styles.kicker}>02 — From thought to finished work</span><h2>Everything flows.<br/><em>Nothing gets lost.</em></h2><p>Begin with a rough idea. Refine it with the right intelligence. Turn it into any format—all without breaking focus.</p><Link className={styles.textLink} href="/auth/login">Open your workspace <span>→</span></Link></div>
          <div className={styles.steps} data-reveal>
            <article><span>01</span><div><small>START</small><h3>Bring the idea</h3><p>Type a prompt, upload a document or begin inside a project.</p></div><i>⌁</i></article>
            <article><span>02</span><div><small>ROUTE</small><h3>Choose—or let Auto Best decide</h3><p>Use one exact model or compare the strongest options.</p></div><i>✦</i></article>
            <article><span>03</span><div><small>CREATE</small><h3>Ship it in any format</h3><p>Continue into copy, imagery, video, voice or music.</p></div><i>↗</i></article>
          </div>
        </div>
      </div>
    </section>

    <section className={styles.audience}>
      <div className={styles.container}>
        <div className={styles.audienceIntro} data-reveal><span className={styles.kicker}>03 — Built for real work</span><h2>One platform.<br/><em>Many ambitions.</em></h2></div>
        <div className={styles.audienceGrid}>{useCases.map(([title, body], index) => <article data-reveal style={{"--delay": `${index * 70}ms`} as React.CSSProperties} key={title}><span>0{index + 1}</span><h3>{title}</h3><p>{body}</p><Link href="/auth/login" aria-label={`Start with All Model Hub for ${title}`}>Explore <b>↗</b></Link></article>)}</div>
      </div>
    </section>

    <section className={styles.pricing} id="pricing">
      <div className={styles.container}>
        <div className={styles.pricingCard} data-reveal>
          <div><span className={styles.kicker}>04 — Radical clarity</span><h2>AI pricing that finally<br/><em>makes sense.</em></h2><p>No conversion math. No recurring model subscriptions. Add credits when you need them and see the estimate before higher-cost generations.</p><Link className={styles.primaryButton} href="/auth/login">Claim 10 free credits <span>↗</span></Link></div>
          <div className={styles.creditVisual}><div className={styles.creditOrb}><small>ONE CREDIT</small><strong>₨1</strong><span>Pakistani rupee</span></div><div className={styles.receiptRows}><p><span>Purchased credits</span><b>Never expire</b></p><p><span>Cost estimates</span><b>Before you create</b></p><p><span>History</span><b>Clear receipts</b></p></div></div>
        </div>
      </div>
    </section>

    <section className={styles.pakistan} id="pakistan">
      <div className={styles.container}>
        <div className={styles.pakistanGrid}>
          <div className={styles.pkVisual} data-reveal aria-hidden="true"><div className={styles.pkMap}>PK<span/><span/><span/></div><p>Local access<br/><b>Global intelligence</b></p><div className={styles.pkOrbit}/></div>
          <div className={styles.sectionHeading} data-reveal><span className={styles.kicker}>05 — Pakistan first. Global ready.</span><h2>World-class AI.<br/><em>Built around you.</em></h2><p>Designed for how Pakistan studies, earns, creates and grows—with local payments, familiar languages and a product that stays useful on every screen.</p><ul><li><i>✓</i><span><b>Speak naturally</b>English, Urdu and Roman Urdu workflows.</span></li><li><i>✓</i><span><b>Pay locally</b>Easypaisa and Meezan top-ups at launch.</span></li><li><i>✓</i><span><b>Work reliably</b>Responsive, low-bandwidth-aware experience.</span></li></ul></div>
        </div>
      </div>
    </section>

    <section className={styles.trust}>
      <div className={styles.container}><div className={styles.trustRow} data-reveal><div><i>◎</i><span><b>Your work stays yours</b>Private projects and protected files</span></div><div><i>◇</i><span><b>Spend with confidence</b>Wallet holds prevent surprise charges</span></div><div><i>✓</i><span><b>Always in control</b>Export and deletion tools built in</span></div></div></div>
    </section>

    <section className={styles.faq} id="faq">
      <div className={styles.container}><div className={styles.faqGrid}>
        <div className={styles.sectionHeading} data-reveal><span className={styles.kicker}>Questions, clearly answered</span><h2>Good to know<br/><em>before you begin.</em></h2><p>Still unsure about something?</p><a className={styles.textLink} href="mailto:support@allmodelhub.app">Talk to our team <span>→</span></a></div>
        <div className={styles.faqList} data-reveal>{faqs.map(([question, answer], index) => <details key={question} open={index === 0}><summary><span>0{index + 1}</span>{question}<i>+</i></summary><p>{answer}</p></details>)}</div>
      </div></div>
    </section>

    <section className={styles.finalCta}>
      <div className={styles.finalGrid} aria-hidden="true"/><div className={styles.finalGlow} aria-hidden="true"/>
      <div className={styles.container} data-reveal><span className={styles.kicker}>Your next idea is waiting</span><h2>Start with one prompt.<br/><em>Go anywhere.</em></h2><p>Every leading AI, every creative direction and one clear PKR wallet.</p><Link className={styles.primaryButton} href="/auth/login">Start creating free <span>↗</span></Link><small>10 welcome credits · No card required</small></div>
    </section>

    <footer className={styles.footer}><div className={styles.container}>
      <div className={styles.footerTop}><div><Link href="/" className={styles.brand}><span className={styles.brandMark}><i/><i/><i/></span><span>All Model Hub</span></Link><p>Every leading AI.<br/>One PKR wallet.</p></div><div className={styles.footerLinks}><nav><b>Product</b><a href="#product">Features</a><a href="#models">Models</a><a href="#pricing">Pricing</a><a href="#pakistan">For Pakistan</a></nav><nav><b>Company</b><a href="mailto:support@allmodelhub.app">Support</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/acceptable-use">Acceptable use</a></nav><nav><b>Get started</b><Link href="/auth/login">Log in</Link><Link href="/auth/login">Create account</Link><a href="#faq">FAQ</a><a href="/refunds">Refund policy</a></nav></div></div>
      <div className={styles.footerBottom}><small>© 2026 All Model Hub. All rights reserved.</small><span><i/> Built for Pakistan</span></div>
    </div></footer>
  </main>;
}


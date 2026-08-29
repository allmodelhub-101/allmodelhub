import Link from "next/link";
import { MarketingNav } from "@/components/marketing-nav";

const models = ["GPT 5.6 Sol","Claude Opus 5","Gemini Pro","DeepSeek V4","GPT Image 2","Kling V3","VEO 3.1","ElevenLabs","Suno","Qwen Image"];

export default function HomePage() {
  return <>
    <MarketingNav />
    <section className="hero">
      <div className="hero-grid" /><div className="hero-orbit" />
      <div className="hero-copy">
        <div className="kicker">Pakistan-first AI operating platform</div>
        <h1>Every Leading AI.<br/><span className="gradient-text">One PKR Wallet.</span></h1>
        <p>Chat, reason, create images, generate videos and produce voice with leading AI models without juggling separate subscriptions or USD pricing.</p>
        <div className="hero-actions"><Link className="btn btn-primary" href="/auth/login">Start Creating →</Link><a className="btn" href="#models">Explore Models</a></div>
        <div className="hero-trust"><span className="trust-chip">1 Credit = PKR 1</span><span className="trust-chip">Purchased credits never expire</span><span className="trust-chip">Auto Best model routing</span><span className="trust-chip">Built for Pakistan</span></div>
      </div>
    </section>

    <div className="model-strip" id="models"><div className="model-track">{[...models,...models].map((m,i)=><span className="model-pill" key={`${m}-${i}`}>{m}</span>)}</div></div>

    <section className="section" id="create"><div className="container">
      <div className="section-head"><div className="kicker">One intelligent workspace</div><h2>Stop buying AI subscriptions one by one.</h2><p>All Model Hub gives you a single workspace, one wallet and a curated model catalog. Use Auto Best when you want simplicity or choose the exact model when you want full control.</p></div>
      <div className="feature-grid">
        <article className="card feature-card"><div className="feature-icon">✦</div><h3>All Model Hub Auto</h3><p>Tell us the task. The AMH Intelligence Router chooses a sensible model based on quality, cost, complexity and availability.</p></article>
        <article className="card feature-card"><div className="feature-icon">◎</div><h3>Model Battle</h3><p>Run the same prompt across two or three AI models, compare answers side by side and continue with the winner.</p></article>
        <article className="card feature-card"><div className="feature-icon">₨</div><h3>Transparent PKR Wallet</h3><p>One Credit equals one rupee. Every completed request gets a clear receipt and purchased credits do not expire.</p></article>
        <article className="card feature-card"><div className="feature-icon">▧</div><h3>Image Studio</h3><p>Generate, edit and upscale with curated image models instead of learning a different interface for every provider.</p></article>
        <article className="card feature-card"><div className="feature-icon">▶</div><h3>Video Studio</h3><p>Create text-to-video and image-to-video content with strong cost warnings and wallet locks before expensive jobs.</p></article>
        <article className="card feature-card"><div className="feature-icon">♫</div><h3>Audio Studio</h3><p>Produce voice, sound effects and music from the same account, with more Urdu-focused voice workflows planned.</p></article>
      </div>
    </div></section>

    <section className="section"><div className="container">
      <div className="section-head"><div className="kicker">Product experience</div><h2>Simple enough for a beginner. Powerful enough for an agency.</h2></div>
      <div className="demo-window">
        <div className="demo-bar"><span className="demo-dot"/><span className="demo-dot"/><span className="demo-dot"/><span className="muted small" style={{marginLeft:10}}>All Model Hub · Chat</span></div>
        <div className="demo-body"><div className="demo-sidebar"><div className="brand"><span className="brand-mark"/>AMH</div><div className="sidebar-section">Create</div><div className="sidebar-nav"><span className="sidebar-link">New Chat</span><span className="sidebar-link">Images</span><span className="sidebar-link">Video</span><span className="sidebar-link">Audio</span></div></div>
        <div className="demo-content"><div className="demo-bubble user">Create a premium launch campaign for a Pakistani skincare brand.</div><div className="demo-bubble"><b>Auto Best · Balanced</b><br/><br/>I’ll structure the campaign around a clear offer, trust signals, short-form creative and a practical launch sequence.</div><div className="soft-card" style={{padding:14,color:"var(--muted)",fontSize:13}}>0.86 Credits used · View receipt</div></div></div>
      </div>
    </div></section>

    <section className="section"><div className="container"><div className="section-head"><div className="kicker">Intelligence levels</div><h2>Choose capability, not confusing token charts.</h2></div>
      <div className="tier-grid"><div className="card tier"><strong>Budget</strong><p>Fast, capable models for everyday work and high-volume usage.</p></div><div className="card tier featured"><strong>Balanced</strong><p>Best everyday mix of intelligence, quality, speed and price.</p></div><div className="card tier"><strong>Premium</strong><p>Higher-end reasoning, writing, coding and professional analysis.</p></div><div className="card tier"><strong>Flagship</strong><p>Maximum available capability for the tasks where quality matters most.</p></div></div>
    </div></section>

    <section className="section" id="credits"><div className="container"><div className="card pricing-card">
      <div><div className="kicker">Pricing that makes sense</div><h2 style={{marginBottom:20}}>AI spending in rupees, not mystery points.</h2><div className="credit-number gradient-text">₨1 = 1</div><h3 style={{fontSize:24}}>Credit</h3><p className="muted" style={{lineHeight:1.7}}>Purchased credits never expire. Normal text requests run without repetitive payment popups, while expensive image, video and audio operations clearly show their cost before generation.</p></div>
      <div className="wallet-packs">{[500,1000,2500,5000,10000].map(v=><div className="soft-card wallet-pack" key={v}><b>{v.toLocaleString()} Credits</b><div className="muted small">PKR {v.toLocaleString()}</div></div>)}<div className="soft-card wallet-pack"><b>Custom</b><div className="muted small">Minimum PKR 500</div></div></div>
    </div></div></section>

    <section className="section" id="pakistan"><div className="container"><div className="section-head"><div className="kicker">Built for Pakistan</div><h2>Local where it matters. Global where it counts.</h2><p>PKR-first billing, Easypaisa and Meezan manual top-ups at launch, Roman Urdu-friendly workflows, mobile-first performance and templates for Pakistani freelancers, students, creators and businesses.</p></div>
      <div className="feature-grid"><article className="card feature-card"><div className="feature-icon">PK</div><h3>Roman Urdu Friendly</h3><p>Ask naturally in English, Urdu or Roman Urdu and save your preferred response style.</p></article><article className="card feature-card"><div className="feature-icon">↯</div><h3>Low-Bandwidth Mode</h3><p>Reduce visual overhead and heavy previews on slower connections without losing the core AI experience.</p></article><article className="card feature-card"><div className="feature-icon">⌁</div><h3>Pakistan Workflows</h3><p>Upwork proposals, Fiverr gigs, Daraz listings, WhatsApp promotions, study notes, Urdu voiceovers and more.</p></article></div>
    </div></section>

    <section className="section" id="faq"><div className="container"><div className="section-head"><div className="kicker">FAQ</div><h2>Clear answers before you spend.</h2></div><div className="faq">
      <details><summary>What is one All Model Hub Credit worth?</summary><p>One Credit equals PKR 1. Purchased credits are designed not to expire.</p></details>
      <details><summary>Do I need to choose the exact AI model?</summary><p>No. Auto Best can choose a suitable model for the task, while advanced users can select exact models.</p></details>
      <details><summary>How are expensive video generations protected?</summary><p>The app shows the estimated maximum cost and reserves the required credits before sending an expensive generation.</p></details>
      <details><summary>How do payments work at launch?</summary><p>V1 uses manual Easypaisa and Meezan Bank top-ups with a unique payment order, transaction reference, proof upload and admin verification.</p></details>
    </div></div></section>

    <section className="section"><div className="container"><div className="card" style={{padding:"58px 28px",textAlign:"center"}}><div className="kicker">One workspace. Every direction.</div><h2>Start with one prompt.</h2><p className="muted" style={{maxWidth:620,margin:"0 auto 24px",lineHeight:1.7}}>Use the model you want, or let All Model Hub choose intelligently for you.</p><Link className="btn btn-primary" href="/auth/login">Create Your Account →</Link></div></div></section>

    <footer className="footer"><div className="container footer-inner"><div><b style={{color:"var(--text)"}}>All Model Hub</b><div className="small" style={{marginTop:8}}>Every Leading AI. One PKR Wallet.</div></div><div className="small">© 2026 All Model Hub · <a href="/terms">Terms</a> · <a href="/privacy">Privacy</a> · <a href="/acceptable-use">Acceptable Use</a> · <a href="/refunds">Refunds</a></div></div></footer>
  </>;
}

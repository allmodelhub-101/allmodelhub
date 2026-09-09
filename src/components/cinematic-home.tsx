import Link from "next/link";
import { MarketingNav } from "@/components/marketing-nav";
import { CinematicStoryController } from "@/components/cinematic-story-controller";

const modelNodes = [
  { name: "GPT", className: "cin-node-one" },
  { name: "Claude", className: "cin-node-two" },
  { name: "Gemini", className: "cin-node-three" },
  { name: "Grok", className: "cin-node-four" },
  { name: "DeepSeek", className: "cin-node-five" },
  { name: "More", className: "cin-node-six" },
];

const creationModes = ["Chat", "Images", "Video", "Voice", "Music"];

const storyScenes = [
  {
    eyebrow: "One connected AI workspace",
    title: "Leading models move as one.",
    body: "Choose the exact model you want, or let Auto Best route each task by quality, speed, cost and availability.",
  },
  {
    eyebrow: "Model Battle",
    title: "Compare intelligence side by side.",
    body: "Send one prompt to two or three models, review their answers together and continue with the strongest result.",
  },
  {
    eyebrow: "Multimodal creation",
    title: "Move from an idea to any format.",
    body: "Write, design, generate video, produce voice and create music from the same focused workspace.",
  },
  {
    eyebrow: "Transparent PKR wallet",
    title: "Know what every creation costs.",
    body: "One credit equals one Pakistani rupee. Clear estimates, wallet holds and receipts remove confusing token calculations.",
  },
  {
    eyebrow: "Built for Pakistan",
    title: "Local access to global AI.",
    body: "Use English, Urdu or Roman Urdu with local payment workflows and practical tools for work, study and business.",
  },
];

const faqs = [
  ["What is one All Model Hub Credit worth?", "One credit equals PKR 1. Purchased credits do not expire under the current product policy."],
  ["Do I need to select an AI model?", "No. Auto Best can route your task automatically, while advanced users can choose an exact model."],
  ["Can I compare answers from different models?", "Yes. Model Battle runs the same prompt through two or three selected models for a direct comparison."],
  ["How are expensive media generations protected?", "The workspace shows the estimated cost and reserves the required credits before starting eligible video or media jobs."],
];

export function CinematicHome() {
  return (
    <main className="cin-site">
      <MarketingNav />

      <section className="cin-hero" aria-labelledby="cin-hero-title">
        <div className="cin-aurora cin-aurora-one" aria-hidden="true" />
        <div className="cin-aurora cin-aurora-two" aria-hidden="true" />
        <div className="cin-grid" aria-hidden="true" />
        <div className="container cin-hero-layout">
          <div className="cin-hero-copy">
            <span className="cin-overline"><i /> Pakistan-first AI workspace</span>
            <h1 id="cin-hero-title">Every leading AI.<span>One PKR wallet.</span></h1>
            <p>Chat, reason, create images, generate videos and produce voice with leading AI models without separate subscriptions or confusing USD pricing.</p>
            <div className="cin-actions">
              <Link className="btn btn-primary cin-primary" href="/auth/login">Start creating <span aria-hidden="true">↗</span></Link>
              <a className="btn cin-secondary" href="#cinematic-story">Explore the experience</a>
            </div>
            <ul className="cin-proof" aria-label="Product highlights">
              <li><strong>₨1</strong><span>One credit</span></li>
              <li><strong>Auto</strong><span>Best routing</span></li>
              <li><strong>5-in-1</strong><span>Creative workspace</span></li>
            </ul>
          </div>

          <div className="cin-hub-wrap" aria-hidden="true">
            <div className="cin-hub-glow" />
            <div className="cin-orbit cin-orbit-outer" />
            <div className="cin-orbit cin-orbit-inner" />
            <div className="cin-hub-core"><span>AMH</span><small>Auto Best</small></div>
            {modelNodes.map((node) => <div className={`cin-model-node ${node.className}`} key={node.name}><i />{node.name}</div>)}
          </div>
        </div>
        <a className="cin-scroll-cue" href="#cinematic-story"><span>Scroll to explore</span><i /></a>
      </section>

      <section className="cin-model-rail" id="models" aria-label="Available AI capabilities">
        <div className="cin-model-track">
          {["GPT", "Claude", "Gemini", "Grok", "DeepSeek", "Image AI", "Video AI", "Voice AI", "GPT", "Claude", "Gemini", "Grok", "DeepSeek", "Image AI", "Video AI", "Voice AI"].map((model, index) => (
            <span key={`${model}-${index}`}><i />{model}</span>
          ))}
        </div>
      </section>

      <section className="cin-story" id="cinematic-story" data-scene="0" aria-labelledby="cin-story-title">
        <CinematicStoryController sceneCount={storyScenes.length} />
        <div className="cin-story-sticky">
          <div className="container cin-story-layout">
            <div className="cin-scene-copy">
              <p className="cin-section-number">01 / 05</p>
              <h2 id="cin-story-title" className="cin-sr-only">Explore the All Model Hub product experience</h2>
              {storyScenes.map((scene, index) => (
                <article className="cin-story-card" data-scene-index={index} key={scene.title}>
                  <span className="cin-overline"><i />{scene.eyebrow}</span>
                  <h3>{scene.title}</h3>
                  <p>{scene.body}</p>
                  {index === 4 && <Link href="/auth/login" className="cin-text-link">Enter the workspace <span aria-hidden="true">→</span></Link>}
                </article>
              ))}
              <div className="cin-progress" aria-hidden="true"><span /></div>
            </div>

            <div className="cin-product-stage" aria-label="Animated preview of All Model Hub">
              <div className="cin-stage-glow" aria-hidden="true" />
              <div className="cin-app-window">
                <header className="cin-app-top"><div className="cin-mini-brand"><i />All Model Hub</div><div className="cin-window-actions"><span /><span /><span /></div></header>
                <aside className="cin-app-nav" aria-hidden="true">
                  <b>AMH</b>
                  {creationModes.map((mode, index) => <span className={index === 0 ? "active" : ""} key={mode}>{mode.slice(0, 1)}</span>)}
                </aside>

                <div className="cin-preview cin-preview-models" data-preview="0">
                  <div className="cin-preview-label">Auto Best routing</div>
                  <div className="cin-routing-core"><span>Prompt</span></div>
                  <div className="cin-routing-model model-a">GPT</div>
                  <div className="cin-routing-model model-b">Claude</div>
                  <div className="cin-routing-model model-c">Gemini</div>
                  <div className="cin-routing-line line-a"/><div className="cin-routing-line line-b"/><div className="cin-routing-line line-c"/>
                </div>

                <div className="cin-preview cin-preview-battle" data-preview="1">
                  <div className="cin-preview-label">Model Battle</div>
                  {["GPT", "Claude", "Gemini"].map((model, index) => <div className={`cin-answer answer-${index + 1}`} key={model}><strong><i />{model}</strong><span /><span /><span className="short" />{index === 1 && <em>Best match</em>}</div>)}
                </div>

                <div className="cin-preview cin-preview-create" data-preview="2">
                  <div className="cin-preview-label">Create in every direction</div>
                  <div className="cin-create-canvas"><div className="cin-generated-orb" /></div>
                  <div className="cin-mode-row">{creationModes.map((mode, index) => <span className={index === 1 ? "active" : ""} key={mode}>{mode}</span>)}</div>
                </div>

                <div className="cin-preview cin-preview-wallet" data-preview="3">
                  <div className="cin-preview-label">Transparent PKR wallet</div>
                  <div className="cin-credit-orb"><small>1 Credit</small><strong>PKR 1</strong></div>
                  <div className="cin-receipt"><span>Image generation</span><strong>− 8.40 credits</strong><small>Balance updated instantly</small></div>
                </div>

                <div className="cin-preview cin-preview-pakistan" data-preview="4">
                  <div className="cin-preview-label">Built for Pakistan</div>
                  <div className="cin-pk-mark">PK</div>
                  <div className="cin-use-cases"><span>Freelance</span><span>Study</span><span>Marketing</span><span>Business</span></div>
                  <div className="cin-language-chip">English · اردو · Roman Urdu</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="cin-create" id="create" aria-labelledby="cin-create-title">
        <div className="container">
          <div className="cin-section-head">
            <span className="cin-overline"><i />One prompt, every direction</span>
            <h2 id="cin-create-title">Your complete creative stack.</h2>
            <p>Five focused studios share one account, one history and one transparent wallet.</p>
          </div>
          <div className="cin-capability-grid">
            {[
              ["01", "Chat and reason", "Write, research, code and solve complex work with the right intelligence level."],
              ["02", "Create images", "Generate, edit and upscale visuals through a focused production workflow."],
              ["03", "Generate video", "Move from text or a reference image to motion with clear cost protection."],
              ["04", "Produce voice", "Create natural speech and audio without moving between separate accounts."],
              ["05", "Battle models", "Compare two or three answers and continue the conversation with your winner."],
            ].map(([number, title, body]) => <article key={number}><span>{number}</span><div><h3>{title}</h3><p>{body}</p></div><i aria-hidden="true">↗</i></article>)}
          </div>
        </div>
      </section>

      <section className="cin-wallet-section" id="credits" aria-labelledby="cin-wallet-title">
        <div className="container cin-wallet-layout">
          <div>
            <span className="cin-overline"><i />Pricing without mystery</span>
            <h2 id="cin-wallet-title">AI spending that reads like money.</h2>
            <p>Purchased credits do not expire. Routine text requests run without repetitive payment popups, while higher-cost media jobs show an estimate before generation.</p>
            <div className="cin-actions"><Link className="btn btn-primary cin-primary" href="/auth/login">Buy credits <span aria-hidden="true">↗</span></Link><a className="cin-text-link" href="#faq">Read pricing answers</a></div>
          </div>
          <div className="cin-wallet-card">
            <div className="cin-wallet-top"><span>Available balance</span><i>PKR</i></div>
            <strong>2,500.00</strong><small>2,500 credits</small>
            <div className="cin-wallet-bars"><i/><i/><i/><i/><i/><i/><i/></div>
            <div className="cin-wallet-row"><span>Simple conversion</span><b>₨1 = 1 credit</b></div>
            <div className="cin-wallet-row"><span>Purchased credits</span><b>Never expire</b></div>
          </div>
        </div>
      </section>

      <section className="cin-pakistan" id="pakistan" aria-labelledby="cin-pakistan-title">
        <div className="container cin-pakistan-layout">
          <div className="cin-pakistan-visual" aria-hidden="true"><div className="cin-pk-rings"/><strong>PK</strong><span>Local access<br/>Global intelligence</span></div>
          <div>
            <span className="cin-overline"><i />Designed for the way Pakistan works</span>
            <h2 id="cin-pakistan-title">Global AI without the global payment friction.</h2>
            <p>Built for freelancers, students, creators and businesses who want modern AI tools with familiar language and local-first billing.</p>
            <ul className="cin-check-list"><li>English, Urdu and Roman Urdu workflows</li><li>Manual Easypaisa and Meezan top-ups at launch</li><li>Low-bandwidth options for slower connections</li><li>Templates for work, study, selling and promotion</li></ul>
          </div>
        </div>
      </section>

      <section className="cin-faq" id="faq" aria-labelledby="cin-faq-title">
        <div className="container cin-faq-layout">
          <div className="cin-section-head"><span className="cin-overline"><i />Clear before you create</span><h2 id="cin-faq-title">Questions, answered.</h2></div>
          <div className="cin-faq-list">{faqs.map(([question, answer], index) => <details key={question} open={index === 0}><summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p></details>)}</div>
        </div>
      </section>

      <section className="cin-final-cta" aria-labelledby="cin-final-title">
        <div className="cin-final-glow" aria-hidden="true" />
        <div className="container"><span className="cin-overline"><i />One workspace. Every direction.</span><h2 id="cin-final-title">Start with one prompt.</h2><p>Use the model you want, or let All Model Hub choose intelligently for you.</p><Link className="btn btn-primary cin-primary" href="/auth/login">Create your account <span aria-hidden="true">↗</span></Link></div>
      </section>

      <footer className="cin-footer"><div className="container"><div><strong>All Model Hub</strong><span>Every Leading AI. One PKR Wallet.</span></div><nav aria-label="Legal"><a href="/terms">Terms</a><a href="/privacy">Privacy</a><a href="/acceptable-use">Acceptable Use</a><a href="/refunds">Refunds</a></nav><small>© 2026 All Model Hub</small></div></footer>
    </main>
  );
}

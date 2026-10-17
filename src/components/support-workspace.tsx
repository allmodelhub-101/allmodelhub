import type {ReactNode} from "react";
import {Lifebuoy} from "@phosphor-icons/react/dist/ssr";
import styles from "./account-workspace.module.css";
export function SupportWorkspace({children}:{children:ReactNode}){return <div className={`${styles.surface} ${styles.support} workspace-page support-page support-redesign-page`}>
    <header className="support-hero">
      <div className="support-hero-copy"><span className="support-hero-icon"><Lifebuoy weight="fill" aria-hidden="true" /></span><div><span className="kicker">Help center</span><h1>Support</h1><p>Get help with payments, generations, your account, or a technical problem.</p></div></div>
      <div className="support-hero-art" aria-hidden="true"><strong>We&apos;re here to help.</strong><span>Real people. Faster answers.<br />A more creative you.</span><i /><i /><i /></div>
    </header>
    {children}
  </div>;}

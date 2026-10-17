import type {ReactNode} from "react";
import {SlidersHorizontal} from "@phosphor-icons/react/dist/ssr";
import styles from "./account-workspace.module.css";
export function SettingsWorkspace({children}:{children:ReactNode}){return <div className={`${styles.surface} ${styles.settings} workspace-page settings-page settings-redesign-page`}>
    <header className="settings-hero">
      <div className="settings-hero-copy">
        <span className="settings-hero-icon"><SlidersHorizontal weight="bold" aria-hidden="true" /></span>
        <div><span className="kicker">Preferences &amp; safety</span><h1>Settings</h1><p>Control language, appearance, privacy, bandwidth, and personal spending protections.</p></div>
      </div>
      <div className="settings-hero-art" aria-hidden="true"><strong>Your AI space.<br />Your rules.</strong><i /><i /><i /></div>
    </header>
    {children}
  </div>;}

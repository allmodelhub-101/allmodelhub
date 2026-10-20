"use client";

import Link from "next/link";
import { AndroidLogo, ArrowUpRight } from "@phosphor-icons/react";
import { useAndroidInstallEnvironment } from "@/lib/android-install-environment";
import styles from "./android-promotion.module.css";

/** Normal-flow public entry point. No announcement, popup or storage mutation. */
export function AndroidAppLink() {
  const environment = useAndroidInstallEnvironment();
  if (environment === "standalone") return null;
  return <div className={styles.discovery} data-android={environment.startsWith("android")}>
    <Link href="/android" className={styles.link}>
      <AndroidLogo size={19} weight="duotone" aria-hidden="true" />
      <span>Get Android App</span>
      <ArrowUpRight size={14} aria-hidden="true" />
    </Link>
    <span className={styles.note}>Your workspace, to go.</span>
  </div>;
}

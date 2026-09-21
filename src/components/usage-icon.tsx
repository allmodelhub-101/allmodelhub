"use client";

import { ChartBar, Coins, FileText, GearSix, ImageSquare, Receipt, ShieldCheck, Wallet } from "@phosphor-icons/react";

const icons = { chart: ChartBar, coins: Coins, file: FileText, gear: GearSix, image: ImageSquare, receipt: Receipt, shield: ShieldCheck, wallet: Wallet };

export function UsageIcon({ name }: { name: keyof typeof icons }) {
  const Icon = icons[name];
  return <Icon weight="fill" aria-hidden="true" />;
}

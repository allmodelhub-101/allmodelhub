import Link from "next/link";
import Image from "next/image";
import { BRAND } from "@/lib/brand";

export function Brand({ compact = false }: { compact?: boolean }) {
  return <Link href="/" className="brand" aria-label={BRAND.name}>
    <Image className="brand-logo" src={BRAND.logoPath} alt="" width={48} height={48} priority />
    {!compact && BRAND.name}
  </Link>;
}

import Link from "next/link";

export function Brand({ compact = false }: { compact?: boolean }) {
  return <Link href="/" className="brand"><span className="brand-mark" />{compact ? "AMH" : "All Model Hub"}</Link>;
}

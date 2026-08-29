import Link from "next/link";
import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";

export function MarketingNav() {
  return <nav className="marketing-nav"><div className="container marketing-nav-inner">
    <Brand />
    <div className="nav-links"><a href="#models">Models</a><a href="#create">Create</a><a href="#credits">Credits</a><a href="#pakistan">Pakistan</a><a href="#faq">FAQ</a></div>
    <div className="nav-actions"><ThemeToggle /><Link className="btn btn-ghost" href="/auth/login">Login</Link><Link className="btn btn-primary" href="/auth/login">Start Free</Link></div>
  </div></nav>;
}

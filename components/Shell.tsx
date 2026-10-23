"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

const ICONS: Record<string, string> = {
  home: "M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  cal: "M3 5h18v16H3zM3 10h18M8 3v4M16 3v4",
  log: "M12 16V4M7 9l5-5 5 5M4 20h16",
  zones: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  prog: "M3 17l6-6 4 4 8-8M15 7h6v6",
  people: "M16 11a4 4 0 1 0-8 0M3 21a9 9 0 0 1 18 0",
};
type Item = { href: string; label: string; icon: string; match?: (p: string) => boolean };
const ATHLETE: Item[] = [
  { href: "/athlete", label: "Home", icon: "home", match: p => p === "/athlete" || p.startsWith("/athlete/session") },
  { href: "/athlete/calendar", label: "Calendar", icon: "cal" },
  { href: "/athlete/progress", label: "Progress", icon: "prog" },
  { href: "/athlete/zones", label: "Zones", icon: "zones" },
];
const COACH: Item[] = [{ href: "/coach", label: "Athletes", icon: "people", match: p => p.startsWith("/coach") }];

export default function Shell({ role, who, children }: { role: "coach" | "athlete"; who?: string; children: React.ReactNode }) {
  const path = usePathname(), router = useRouter();
  const items = role === "coach" ? COACH : ATHLETE;
  const on = (i: Item) => (i.match ? i.match(path) : path === i.href);
  async function out() { await supabase().auth.signOut(); router.replace("/login"); router.refresh(); }
  return (
    <>
      <header className="top">
        <div className="in">
          <Link href="/" aria-label="Home"><img src="/BPL-Horizontal-Reverse.svg" alt="Bryce Performance Lab" /></Link>
          <nav aria-label="Main">{items.map(i => <Link key={i.href} href={i.href} aria-current={on(i) ? "page" : undefined}>{i.label}</Link>)}</nav>
          <div className="who">{who && <span>{who}{role === "coach" ? " · Coach" : ""}</span>}<button type="button" onClick={out}>Sign out</button></div>
        </div>
      </header>
      <main className="page">{children}</main>
      {role === "athlete" && (
        <nav className="tabs" aria-label="Main">
          {items.map(i => (
            <Link key={i.href} href={i.href} aria-current={on(i) ? "page" : undefined}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d={ICONS[i.icon]} /></svg>{i.label}
            </Link>
          ))}
        </nav>
      )}
    </>
  );
}

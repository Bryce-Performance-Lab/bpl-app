import { redirect } from "next/navigation";
import { currentProfile } from "@/lib/supabase/server";
import Shell from "@/components/Shell";

export default async function AthleteLayout({ children }: { children: React.ReactNode }) {
  const p = await currentProfile();
  if (!p) redirect("/login");
  if (p.role === "coach") redirect("/coach");
  return <Shell role="athlete" who={p.full_name || p.email}>{children}</Shell>;
}

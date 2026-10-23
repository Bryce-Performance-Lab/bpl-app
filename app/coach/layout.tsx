import { redirect } from "next/navigation";
import { currentProfile } from "@/lib/supabase/server";
import Shell from "@/components/Shell";

export default async function CoachLayout({ children }: { children: React.ReactNode }) {
  const p = await currentProfile();
  if (!p) redirect("/login");
  if (p.role !== "coach") redirect("/athlete");
  return <Shell role="coach" who={p.full_name || p.email}>{children}</Shell>;
}

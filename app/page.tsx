import { redirect } from "next/navigation";
import { currentProfile } from "@/lib/supabase/server";

export default async function Home() {
  const p = await currentProfile();
  if (!p) redirect("/login");
  redirect(p.role === "coach" ? "/coach" : "/athlete");
}

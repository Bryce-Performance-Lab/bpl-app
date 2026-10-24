// Garmin Connect Personal API: server-side only. The key lives in a Vercel environment variable, never in the browser.
// Personal keys are for the key owner's own data, so this is switched on for one athlete record only (GARMIN_ATHLETE_EMAIL).
import { serverSupabase } from "./supabase/server";

const BASE = "https://personal.connectapi.garmin.com";
let cached: { token: string; until: number } | null = null;

async function token() {
  if (cached && cached.until > Date.now()) return cached.token;
  const key = process.env.GARMIN_PERSONAL_API_KEY;
  if (!key) throw new Error("not_configured");
  const r = await fetch(`${BASE}/personalapitoken-service/personal-api/personal-api-key/token`, { method: "POST", headers: { Authorization: `ApiKey ${key}` }, cache: "no-store" });
  if (!r.ok) throw new Error("token_failed_" + r.status);
  const t = (await r.text()).trim().replace(/^"|"$/g, "");
  cached = { token: t, until: Date.now() + 20 * 3600e3 }; // tokens last 24 h
  return t;
}

export async function garminGet(path: string) {
  const t = await token();
  const r = await fetch(BASE + path, { headers: { Authorization: `Bearer ${t}` }, cache: "no-store" });
  if (r.status === 401) { cached = null; const t2 = await token(); return fetch(BASE + path, { headers: { Authorization: `Bearer ${t2}` }, cache: "no-store" }); }
  return r;
}

/** Only the coach, and only for the one athlete record linked to the key. */
export async function allowed(athleteId: string | null) {
  const email = (process.env.GARMIN_ATHLETE_EMAIL || "").trim().toLowerCase();
  if (!process.env.GARMIN_PERSONAL_API_KEY || !email || !athleteId) return false;
  const sb = await serverSupabase();
  const { data: { user } } = await sb.auth.getUser(); if (!user) return false;
  const { data: prof } = await sb.from("profiles").select("role").eq("id", user.id).single();
  if (prof?.role !== "coach") return false;
  const { data: a } = await sb.from("athletes").select("email").eq("id", athleteId).single();
  return a?.email === email;
}

"use client";
import { compactPart, parseFIT } from "./engine.js";
import { fetchWeather } from "./weather";
import { supabase } from "./supabase/client";
import type { Activity, Plan } from "./data";

const tried = new Set<string>();

/**
 * Adds weather to a run saved before weather existed: reads the original .FIT from storage for the start point
 * (falling back to where the athlete's other runs started), looks the weather up and saves it on the run.
 */
export async function backfillWeather(act: Activity, plans: Plan[]): Promise<Activity | null> {
  if (!act || act.weather || tried.has(act.id) || !act.parts?.length) return null;
  tried.add(act.id);
  const parts = act.parts.slice().sort((a: any, b: any) => a.first - b.first);
  let pos: any = parts.find((p: any) => p.pos)?.pos || null, approx = false;
  const sb = supabase();
  for (const f of act.files || []) {
    if (pos) break;
    const { data } = await sb.storage.from("fit-files").download(f);
    if (!data) continue;
    try { pos = compactPart(parseFIT(await data.arrayBuffer()), f).pos; } catch { /* not readable */ }
  }
  if (!pos) {
    const other = plans.map(p => p.activity?.weather).filter((w: any) => w && !w.approx).sort((a: any, b: any) => b.start.localeCompare(a.start))[0];
    if (other) { pos = { lat: other.lat, lon: other.lon }; approx = true; }
  }
  if (!pos) return null;
  const w: any = await fetchWeather(pos, parts[0].first, parts[parts.length - 1].last);
  if (!w) return null;
  if (approx) w.approx = true;
  const { data, error } = await sb.from("activities").update({ weather: w }).eq("id", act.id).select().single();
  return error ? { ...act, weather: w } : (data as Activity);
}

/** Fills in weather for recent logged runs one at a time (last 60 days), calling back as each one is done. */
export async function backfillRecent(plans: Plan[], onEach: (planId: string, act: Activity) => void) {
  const since = new Date(Date.now() - 60 * 864e5).toISOString().slice(0, 10);
  for (const p of plans.filter(x => x.activity && !x.activity.weather && x.date >= since).sort((a, b) => b.date.localeCompare(a.date))) {
    const x = await backfillWeather(p.activity!, plans);
    if (x) onEach(p.id, x);
  }
}

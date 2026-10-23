import { supabase } from "./supabase/client";

export type Zone = { code: string; fast: number | null; slow: number | null; hr?: string };
export type Athlete = { id: string; coach_id: string; user_id: string | null; name: string; email: string; event: string | null; test_date: string | null; lt1: number | null; lt2: number | null; zones: Zone[] };
export type Step = { label?: string; reps: number; amount: number; unit: "min" | "sec" | "km" | "m"; zone: string; recAmount?: number; recUnit?: string; recZone?: string };
export type Session = { id: string; athlete_id: string; date: string; title: string; tag: string; setting: string | null; steps: Step[]; notes: string | null };
export type Activity = { id: string; athlete_id: string; session_id: string | null; date: string; km: number | null; duration_sec: number | null; rpe: number | null; comment: string | null; coach_comment: string | null; lactate: { at: string; v: number | string }[]; parts: any[]; analysis: any; files: string[]; weather?: any };
/** A session with its logged run attached (the shape the analysis engine compares). */
export type Plan = Session & { activity: Activity | null; analysis: any; actual: { rpe: number | null; lactate: any[] } };

export function joinPlans(sessions: Session[], acts: Activity[]): Plan[] {
  const bySes = new Map(acts.filter(a => a.session_id).map(a => [a.session_id, a]));
  return sessions.map(s => {
    const a = bySes.get(s.id) || null;
    return { ...s, activity: a, analysis: a?.analysis || null, actual: { rpe: a?.rpe ?? null, lactate: a?.lactate || [] } };
  });
}

export async function loadPlans(athleteId: string, from?: string, to?: string): Promise<Plan[]> {
  const sb = supabase();
  let q1 = sb.from("sessions").select("*").eq("athlete_id", athleteId).order("date");
  let q2 = sb.from("activities").select("*").eq("athlete_id", athleteId);
  if (from) { q1 = q1.gte("date", from); q2 = q2.gte("date", from); }
  if (to) { q1 = q1.lte("date", to); q2 = q2.lte("date", to); }
  const [s, a] = await Promise.all([q1, q2]);
  if (s.error) throw s.error; if (a.error) throw a.error;
  return joinPlans(s.data as Session[], a.data as Activity[]);
}

/** The athlete record for the signed-in athlete. */
export async function myAthlete(): Promise<Athlete | null> {
  const sb = supabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data } = await sb.from("athletes").select("*").eq("user_id", user.id).maybeSingle();
  return data as Athlete | null;
}

export const TAG_COLOUR: Record<string, string> = {
  Easy: "var(--z2)", "Long run": "var(--z2)", Recovery: "var(--z1)", Tempo: "var(--z3)", Threshold: "var(--z4)", VO2max: "var(--z5)",
  "Speed endurance": "var(--z5)", "Speed development": "var(--z5)", Hills: "var(--z3)", Race: "var(--red)", Strength: "var(--slate)", Rest: "var(--line)",
};

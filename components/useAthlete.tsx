"use client";
import { useCallback, useEffect, useState } from "react";
import { loadPlans, myAthlete, type Athlete, type Plan } from "@/lib/data";

/** The signed-in athlete's record and all their sessions with runs attached. */
export function useAthlete() {
  const [athlete, setAthlete] = useState<Athlete | null | undefined>(undefined);
  const [plans, setPlans] = useState<Plan[]>([]), [err, setErr] = useState("");
  const load = useCallback(async () => {
    try {
      const a = await myAthlete(); setAthlete(a);
      if (a) setPlans(await loadPlans(a.id));
    } catch (e: any) { setErr(e.message || "Couldn't load your training."); }
  }, []);
  useEffect(() => { load(); }, [load]);
  return { athlete, plans, err, reload: load };
}

export function NotLinked() {
  return (
    <div className="card stack">
      <h2>You're not linked to a coach yet</h2>
      <p className="note" style={{ margin: 0 }}>Your coach needs to add you with the email you signed up with. Once they do, your sessions appear here.</p>
    </div>
  );
}

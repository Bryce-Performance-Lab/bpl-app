"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import type { Athlete } from "@/lib/data";
import { fmt } from "@/lib/engine.js";
import AthleteForm from "@/components/AthleteForm";
import Dialog from "@/components/Dialog";
import { useToast } from "@/components/Toast";
import Invite from "@/components/Invite";

type Row = Athlete & { last?: string | null; done7?: number };

export default function CoachHome() {
  const [rows, setRows] = useState<Row[] | null>(null), [adding, setAdding] = useState(false), [err, setErr] = useState("");
  const [invite, setInvite] = useState<Athlete | null>(null);
  const toast = useToast();
  async function load() {
    const sb = supabase();
    const [a, acts] = await Promise.all([sb.from("athletes").select("*").order("name"), sb.from("activities").select("athlete_id,date").order("date", { ascending: false }).limit(500)]);
    if (a.error) { setErr(a.error.message); return; }
    const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
    setRows((a.data as Athlete[]).map(x => {
      const mine = (acts.data || []).filter(r => r.athlete_id === x.id);
      return { ...x, last: mine[0]?.date || null, done7: mine.filter(r => r.date >= weekAgo).length };
    }));
  }
  useEffect(() => { load(); }, []);
  return (
    <>
      <div className="row"><h1 style={{ flex: 1 }}>Athletes</h1><button className="btn primary" onClick={() => setAdding(true)}>+ Add athlete</button></div>
      {err && <p className="err">{err}</p>}
      {rows && !rows.length && (
        <div className="card stack">
          <h2>Add your first athlete</h2>
          <p className="note" style={{ margin: 0 }}>Add their name, email and test paces. They then create an account at the sign-up page with that email and see the sessions you plan.</p>
          <div><button className="btn primary" onClick={() => setAdding(true)}>+ Add athlete</button></div>
        </div>
      )}
      {rows && rows.length > 0 && (
        <div className="card" style={{ padding: 0 }}>
          <div className="rtab-wrap"><table className="rtab">
            <thead><tr><th>ATHLETE</th><th>EVENT</th><th>LT1 / LT2</th><th>ACCOUNT</th><th>LAST RUN</th><th>RUNS (7 DAYS)</th></tr></thead>
            <tbody>{rows.map(r => (
              <tr key={r.id}>
                <td><Link href={`/coach/athletes/${r.id}`} style={{ fontWeight: 700 }}>{r.name}</Link><div className="note">{r.email}</div></td>
                <td>{r.event || "–"}</td>
                <td>{r.lt1 ? `${fmt(r.lt1)} / ${fmt(r.lt2)}` : <span className="note">No test yet</span>}</td>
                <td>{r.user_id ? <span className="pill p-ok">Linked</span> : <span className="row" style={{ gap: 6 }}><span className="pill p-miss">Not signed up</span><button className="btn sm" onClick={() => setInvite(r)}>Invite</button></span>}</td>
                <td>{r.last ? new Date(r.last + "T00:00").toLocaleDateString("en-AU", { day: "numeric", month: "short" }) : "–"}</td>
                <td>{r.done7}</td>
              </tr>
            ))}</tbody>
          </table></div>
        </div>
      )}
      <Dialog open={adding} onClose={() => setAdding(false)} title="Add athlete" sub="They'll sign up with this email and be linked to you">
        <AthleteForm onCancel={() => setAdding(false)} onSaved={a => { setAdding(false); setInvite(a); load(); }} />
      </Dialog>
      <Dialog open={!!invite} onClose={() => setInvite(null)} title={invite ? "Invite " + invite.name : "Invite"} sub="Athlete saved. Now send their sign-up email">
        {invite && <Invite athlete={invite} />}
      </Dialog>
      {toast.node}
    </>
  );
}

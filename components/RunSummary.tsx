"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase/client";
import type { Activity } from "@/lib/data";

/** Athlete's RPE, lactate and note, plus the coach's reply (editable by the coach). */
export default function RunSummary({ act, coach, onSaved, session = true }: { act: Activity; coach?: boolean; onSaved?: (a: Activity) => void; session?: boolean }) {
  const [reply, setReply] = useState(act.coach_comment || ""), [busy, setBusy] = useState(false), [msg, setMsg] = useState("");
  async function save() {
    setBusy(true); setMsg("");
    const { data, error } = await supabase().from("activities").update({ coach_comment: reply.trim() || null }).eq("id", act.id).select().single();
    setBusy(false); if (error) setMsg(error.message); else { setMsg("Saved"); onSaved?.(data as Activity); }
  }
  return (
    <div className="stack" style={{ gap: 10 }}>
      <div className="tiles">
        <div className="tile"><span>RPE</span><b>{act.rpe ?? "–"}</b></div>
        {(session || act.lactate?.length > 0) && <div className="tile"><span>Peak lactate</span><b>{act.lactate?.length ? Math.max(...act.lactate.map(l => +l.v)).toFixed(1) + " mmol/L" : "–"}</b></div>}
      </div>
      {act.lactate?.length > 0 && <div className="note">Lactate: {act.lactate.map(l => `${l.at || "–"} ${(+l.v).toFixed(1)}`).join(" · ")}</div>}
      {act.comment && <div className="card" style={{ padding: 10, borderLeft: "4px solid var(--sky)" }}><div className="lab">Athlete's note</div>{act.comment}</div>}
      {coach ? (
        <div className="stack" style={{ gap: 6 }}>
          <label className="f">YOUR REPLY TO THE ATHLETE<textarea value={reply} onChange={e => setReply(e.target.value)} placeholder="Feedback they'll see on this session" /></label>
          <div className="row"><span className="note">{msg}</span><span className="sp" /><button type="button" className="btn primary sm" disabled={busy} onClick={save}>Save reply</button></div>
        </div>
      ) : act.coach_comment ? (
        <div className="card" style={{ padding: 10, borderLeft: "4px solid var(--royal)" }}><div className="lab">From your coach</div>{act.coach_comment}</div>
      ) : null}
    </div>
  );
}

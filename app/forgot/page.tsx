"use client";
import { useState } from "react";
import AuthBox from "@/components/AuthBox";
import { supabase } from "@/lib/supabase/client";

export default function Forgot() {
  const [email, setEmail] = useState(""), [sent, setSent] = useState(false), [err, setErr] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr("");
    const { error } = await supabase().auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: location.origin + "/auth/callback?next=/reset" });
    if (error) setErr(error.message); else setSent(true);
  }
  return (
    <AuthBox title="Reset your password">
      {sent ? <p className="note" role="status" style={{ textAlign: "center" }}>If there's an account for that email, a reset link is on its way.</p> : (
        <form className="stack" onSubmit={submit}>
          <label className="f">EMAIL<input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} /></label>
          {err && <p className="err" role="alert" style={{ margin: 0 }}>{err}</p>}
          <button className="btn primary">Send reset link</button>
        </form>
      )}
      <p className="note" style={{ margin: 0, textAlign: "center" }}><a href="/login">Back to sign in</a></p>
    </AuthBox>
  );
}

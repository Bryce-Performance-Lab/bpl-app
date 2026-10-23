"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import AuthBox from "@/components/AuthBox";
import { supabase } from "@/lib/supabase/client";

export default function Signup() {
  const router = useRouter();
  const [name, setName] = useState(""), [email, setEmail] = useState(""), [password, setPassword] = useState("");
  const [err, setErr] = useState(""), [msg, setMsg] = useState(""), [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(""); setMsg("");
    if (password.length < 8) { setErr("Use at least 8 characters for your password."); return; }
    setBusy(true);
    const sb = supabase(), em = email.trim().toLowerCase();
    const { data: allowed } = await sb.rpc("can_sign_up", { p_email: em });
    if (!allowed) { setBusy(false); setErr("This email hasn't been added yet. Ask your coach to add you, using this exact email."); return; }
    const { data, error } = await sb.auth.signUp({ email: em, password, options: { data: { full_name: name.trim() }, emailRedirectTo: location.origin + "/auth/callback" } });
    setBusy(false);
    if (error) { setErr(/already registered/i.test(error.message) ? "There's already an account for this email. Sign in instead." : error.message); return; }
    if (!data.session) { setMsg("Check your email to confirm your account, then sign in."); return; }
    router.replace("/"); router.refresh();
  }
  return (
    <AuthBox title="Create your account">
      <p className="note" style={{ margin: 0, textAlign: "center" }}>Use the email your coach added you with.</p>
      <form className="stack" onSubmit={submit}>
        <label className="f">YOUR NAME<input autoComplete="name" required value={name} onChange={e => setName(e.target.value)} /></label>
        <label className="f">EMAIL<input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} /></label>
        <label className="f">PASSWORD<input type="password" autoComplete="new-password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)} /><span className="note" style={{ fontWeight: 400, letterSpacing: 0 }}>At least 8 characters</span></label>
        {err && <p className="err" role="alert" style={{ margin: 0 }}>{err}</p>}
        {msg && <p className="note" role="status" style={{ margin: 0, color: "var(--good)" }}>{msg}</p>}
        <button className="btn primary" disabled={busy}>{busy ? "Creating…" : "Create account"}</button>
      </form>
      <p className="note" style={{ margin: 0, textAlign: "center" }}><a href="/login">Already have an account? Sign in</a></p>
    </AuthBox>
  );
}

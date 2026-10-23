"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import AuthBox from "@/components/AuthBox";
import { supabase } from "@/lib/supabase/client";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState(""), [password, setPassword] = useState("");
  const [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(""); setBusy(true);
    const { error } = await supabase().auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) { setErr(error.message === "Invalid login credentials" ? "That email and password don't match." : error.message); return; }
    router.replace("/"); router.refresh();
  }
  return (
    <AuthBox title="Sign in">
      <form className="stack" onSubmit={submit}>
        <label className="f">EMAIL<input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} /></label>
        <label className="f">PASSWORD<input type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} /></label>
        {err && <p className="err" role="alert" style={{ margin: 0 }}>{err}</p>}
        <button className="btn primary" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
      </form>
      <div className="row note" style={{ justifyContent: "space-between" }}>
        <a href="/signup">New here? Create your account</a>
        <a href="/forgot">Forgot password?</a>
      </div>
    </AuthBox>
  );
}

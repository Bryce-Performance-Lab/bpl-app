"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import AuthBox from "@/components/AuthBox";
import { supabase } from "@/lib/supabase/client";

export default function Reset() {
  const router = useRouter();
  const [password, setPassword] = useState(""), [err, setErr] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr("");
    if (password.length < 8) { setErr("Use at least 8 characters."); return; }
    const { error } = await supabase().auth.updateUser({ password });
    if (error) { setErr(error.message); return; }
    router.replace("/"); router.refresh();
  }
  return (
    <AuthBox title="Choose a new password">
      <form className="stack" onSubmit={submit}>
        <label className="f">NEW PASSWORD<input type="password" autoComplete="new-password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)} /></label>
        {err && <p className="err" role="alert" style={{ margin: 0 }}>{err}</p>}
        <button className="btn primary">Save password</button>
      </form>
    </AuthBox>
  );
}

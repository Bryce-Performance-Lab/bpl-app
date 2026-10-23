"use client";
import { useCallback, useRef, useState } from "react";
export function useToast() {
  const [msg, setMsg] = useState(""); const t = useRef<any>(null);
  const show = useCallback((m: string) => { setMsg(m); clearTimeout(t.current); t.current = setTimeout(() => setMsg(""), 2200); }, []);
  const node = msg ? <div className="toast" role="status" aria-live="polite">{msg}</div> : null;
  return { show, node };
}

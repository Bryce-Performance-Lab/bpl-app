"use client";
import { useEffect, useRef } from "react";

export default function Dialog({ open, onClose, title, sub, children, footer }: { open: boolean; onClose: () => void; title: string; sub?: string; children: React.ReactNode; footer?: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const d = ref.current; if (!d) return; if (open && !d.open) d.showModal(); if (!open && d.open) d.close(); }, [open]);
  return (
    <dialog ref={ref} className="dlg" onClose={onClose} aria-label={title}>
      {open && <>
        <div className="hd"><div style={{ flex: 1 }}><h2>{title}</h2>{sub && <div className="note">{sub}</div>}</div><button type="button" className="btn sm" onClick={onClose}>Close</button></div>
        <div className="bd">{children}</div>
        {footer && <div className="ft">{footer}</div>}
      </>}
    </dialog>
  );
}

"use client";
import { useState } from "react";
import type { Athlete } from "@/lib/data";

/** Ready-to-send invite email for an athlete, sent from the coach's own email. */
export function inviteText(a: Athlete, coach?: string) {
  const link = (typeof location !== "undefined" ? location.origin : "") + "/signup";
  const first = a.name.split(" ")[0] || a.name;
  const subject = "Your Bryce Performance Lab training account";
  const body =
`Hi ${first},

I've set you up on the Bryce Performance Lab training app. It's where you'll see your sessions and target paces, and upload your runs after training.

To get started:
1. Go to ${link}
2. Create your account with this email: ${a.email}
3. Choose a password (at least 10 characters)

Once you're in, you'll see this week's sessions on the Home page. After each run, open the session and add your watch's .FIT file (the app shows you how to get it from Garmin, COROS or Strava).

Any questions, just reply to this email.

${coach || "Riley"}
Bryce Performance Lab`;
  return { subject, body, link };
}

export default function Invite({ athlete, coach }: { athlete: Athlete; coach?: string }) {
  const { subject, body } = inviteText(athlete, coach);
  const [copied, setCopied] = useState(false);
  const enc = encodeURIComponent;
  const gmail = `https://mail.google.com/mail/?view=cm&fs=1&to=${enc(athlete.email)}&su=${enc(subject)}&body=${enc(body)}`;
  const mail = `mailto:${athlete.email}?subject=${enc(subject)}&body=${enc(body)}`;
  return (
    <div className="stack">
      <p className="note" style={{ margin: 0 }}>Send this from your email so {athlete.name.split(" ")[0]} knows how to sign up. It opens ready to send. Just press Send.</p>
      <div className="row">
        <a className="btn primary" href={gmail} target="_blank" rel="noopener noreferrer">Send with Gmail</a>
        <a className="btn" href={mail}>Send with Mail app</a>
        <button type="button" className="btn" onClick={async () => { try { await navigator.clipboard.writeText(body); setCopied(true); } catch { setCopied(false); } }}>{copied ? "Copied ✓" : "Copy message"}</button>
      </div>
      <div className="card" style={{ background: "var(--sunk)", whiteSpace: "pre-wrap", fontSize: 12.5 }}>
        <div className="lab" style={{ marginBottom: 6 }}>To: {athlete.email} · Subject: {subject}</div>{body}
      </div>
    </div>
  );
}

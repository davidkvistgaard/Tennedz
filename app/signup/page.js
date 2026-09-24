"use client";
import { useState } from "react";
import Link from "next/link";
import WelcomeFrame from "../components/WelcomeFrame";
import { api } from "../../lib/api";
import { signalAuthChange } from "../components/AuthProvider";
export default function SignupPage() {
  const [email,setEmail] = useState(""); const [password,setPassword] = useState("");
  const [busy,setBusy] = useState(false); const [error,setError] = useState(""); const [confirm,setConfirm] = useState(false);
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const result = await api("/api/auth/signup",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,password})});
      setPassword("");
      if (result.needs_confirmation) setConfirm(true);
      else { signalAuthChange(); window.location.assign("/onboarding"); }
    } catch(e) { setError(e.message); } finally { setBusy(false); }
  }
  return <WelcomeFrame eyebrow="STEP 1 OF 2 · YOUR ACCOUNT" title="Welcome to the peloton" intro="Create your account. Then name your team and meet your first 16 riders.">
    {confirm ? <div role="status"><h3>Check your inbox</h3><p>If this address can be registered, you will receive a confirmation email. Open the link in the same browser. If you already have an account, sign in below.</p></div> :
      <form onSubmit={submit} className="welcome-fields">
        <label>Email<input type="email" autoComplete="email" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)}/></label>
        <label>Password<input type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={password} onChange={e=>setPassword(e.target.value)} aria-describedby="password-hint"/></label>
        <p id="password-hint" className="small">At least 12 characters. A long, unique passphrase works well.</p>
        {error && <p role="alert" className="welcome-error">{error}</p>}
        <button className="btn primary" disabled={busy}>{busy ? "Creating account…" : "Create account →"}</button>
      </form>}
    <p className="welcome-footer">Already have an account? <Link href="/login">Sign in</Link></p>
    <p className="small">Pelotonia is in development. More races and features are on the way.</p>
  </WelcomeFrame>;
}

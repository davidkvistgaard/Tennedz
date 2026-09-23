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
  return <WelcomeFrame eyebrow="TRIN 1 AF 2 · DIN KONTO" title="Velkommen til feltet" intro="Opret din konto. Derefter vælger du navn til dit hold og møder dine første 16 ryttere.">
    {confirm ? <div role="status"><h3>Tjek din indbakke</h3><p>Hvis adressen kan registreres, modtager du en bekræftelse. Åbn linket i samme browser. Har du allerede en konto, kan du logge ind nedenfor.</p></div> :
      <form onSubmit={submit} className="welcome-fields">
        <label>E-mail<input type="email" autoComplete="email" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)}/></label>
        <label>Kodeord<input type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={password} onChange={e=>setPassword(e.target.value)} aria-describedby="password-hint"/></label>
        <p id="password-hint" className="small">Mindst 12 tegn. Brug gerne en lang, unik sætning.</p>
        {error && <p role="alert" className="welcome-error">{error}</p>}
        <button className="btn primary" disabled={busy}>{busy ? "Opretter konto…" : "Opret konto →"}</button>
      </form>}
    <p className="welcome-footer">Har du allerede en konto? <Link href="/login">Log ind</Link></p>
    <p className="small">Pelotonia er under udvikling. Nye løb og funktioner kommer løbende.</p>
  </WelcomeFrame>;
}

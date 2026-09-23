"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import WelcomeFrame from "../components/WelcomeFrame";
import { signalAuthChange, useAuth } from "../components/AuthProvider";
import { api } from "../../lib/api";
export default function OnboardingPage() {
  const [name,setName] = useState(""); const [ready,setReady] = useState(false);
  const [busy,setBusy] = useState(false); const [error,setError] = useState("");
  const {logout,session,error:authError,loading} = useAuth();
  useEffect(()=>{
    let active=true;
    setReady(false);
    if (loading) return ()=>{active=false;};
    api("/api/onboarding").then(result=>{
      if (!active) return;
      if(result.has_team) window.location.replace("/team"); else {setReady(true);setError("");}
    }).catch(e=>{if(active)setError(e.message);});
    return ()=>{active=false;};
  },[session?.user?.id,authError?.code,loading]);
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      await api("/api/onboarding",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name})});
      signalAuthChange(); window.location.assign("/team");
    } catch(e) {setError(e.message);setBusy(false);}
  }
  return <WelcomeFrame eyebrow="TRIN 2 AF 2 · DIT HOLD" title="Giv ambitionerne et navn" intro="Dit første hold består af 8 mænd og 8 kvinder. To separate løbskalendere, én fælles ambition.">
    <div className="starter-summary"><div><strong>16</strong><span>ryttere</span></div><div><strong>8 + 8</strong><span>mænd og kvinder</span></div><div><strong>100.000</strong><span>coins</span></div></div>
    <p className="welcome-intro">Du får sprintere, klatrere, klassikerryttere og tempospecialister. Alle starter med 0 resultatpoint.</p>
    {ready && <form onSubmit={submit} className="welcome-fields"><label>Holdnavn<input autoComplete="off" minLength={3} maxLength={40} required value={name} placeholder="Fx Nordlys Cycling" onChange={e=>setName(e.target.value)}/></label><button className="btn primary" disabled={busy}>{busy ? "Samler dit hold…" : "Opret mit hold →"}</button></form>}
    {error ? <p role="alert" className="welcome-error">{error}</p> : !ready && <p role="status">Tjekker din konto…</p>}
    <p className="welcome-footer"><Link href="/login">Til login</Link> · <button className="welcome-text-button" onClick={()=>logout().catch(e=>setError(e.message))}>Log ud</button></p>
  </WelcomeFrame>;
}

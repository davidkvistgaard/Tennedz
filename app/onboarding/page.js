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
  return <WelcomeFrame eyebrow="STEP 2 OF 2 · YOUR TEAM" title="Give your ambitions a name" intro="Your first team has 8 men and 8 women. Two separate race calendars, one shared ambition.">
    <div className="starter-summary"><div><strong>16</strong><span>riders</span></div><div><strong>8 + 8</strong><span>men and women</span></div><div><strong>100,000</strong><span>coins</span></div></div>
    <p className="welcome-intro">Your squad includes sprinters, climbers, classics riders, and time trial specialists. Everyone starts with 0 race points.</p>
    {ready && <form onSubmit={submit} className="welcome-fields"><label>Team name<input autoComplete="off" minLength={3} maxLength={40} required value={name} placeholder="e.g. Northern Lights Cycling" onChange={e=>setName(e.target.value)}/></label><button className="btn primary" disabled={busy}>{busy ? "Assembling your team…" : "Create my team →"}</button></form>}
    {error ? <p role="alert" className="welcome-error">{error}</p> : !ready && <p role="status">Checking your account…</p>}
    <p className="welcome-footer"><Link href="/login">Sign in</Link> · <button className="welcome-text-button" onClick={()=>logout().catch(e=>setError(e.message))}>Sign out</button></p>
  </WelcomeFrame>;
}

"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import WelcomeFrame from "../components/WelcomeFrame";
import { signalAuthChange } from "../components/AuthProvider";
export default function LoginPage() {
  const [loginName, setLoginName] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let mounted = true;
    if (new URLSearchParams(window.location.search).get("confirmation") === "failed") setError("The confirmation link could not be used in this browser. Try signing in with your email and password.");
    fetch("/api/auth/me", { cache: "no-store" }).then(r => r.json()).then(data => {
      if (mounted && data?.logged_in) window.location.href = "/team";
    }).catch(() => {});
    return () => { mounted = false; };
  }, []);
  async function handleLogin(event) {
    event.preventDefault(); setBusy(true); setError(""); setStatus("Signing in…");
    try {
      const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ login_name: loginName.trim(), password }) });
      const data = await response.json();
      if (!response.ok || !data?.ok) throw new Error(data?.error || "Sign-in failed. Please try again.");
      signalAuthChange(); setStatus("Signed in. Opening your team…"); window.location.href = "/onboarding";
    } catch (err) { setError(err?.message || "Could not connect. Please try again."); setStatus(""); }
    finally { setBusy(false); }
  }
  return <WelcomeFrame eyebrow="BACK IN THE TEAM OFFICE" title="Welcome back, manager." intro="Your riders. Your next race. Your next great decision.">
    <form onSubmit={handleLogin} className="welcome-fields" aria-busy={busy}>
      <label htmlFor="login_name">Email or username<input id="login_name" type="text" autoComplete="username" autoCapitalize="none" spellCheck={false} required value={loginName} onChange={e => setLoginName(e.target.value)} placeholder="you@example.com" /></label>
      <label htmlFor="password">Password<input id="password" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} /></label>
      <p className="small">Existing managers can also use their original username.</p>
      {error && <p role="alert" className="welcome-error">{error}</p>}
      <button type="submit" className="btn primary" disabled={busy}>{busy ? "Signing in…" : "Sign in"}<span aria-hidden="true"> ↗</span></button>
      <p role="status" className="welcome-status">{status}</p>
    </form>
    <p className="welcome-footer">New to the peloton? <Link href="/signup">Create your team</Link></p>
    <Link className="welcome-back" href="/">← Back to home</Link>
  </WelcomeFrame>;
}

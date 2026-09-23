"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { api } from "../../lib/api";

const AuthContext = createContext(null);
const signalKey = "pelotonia:auth-change";
export function signalAuthChange() {
  try { localStorage.setItem(signalKey, crypto.randomUUID()); } catch { /* Focus and polling remain available. */ }
  window.dispatchEvent(new Event(signalKey));
}

export function AuthProvider({ children }) {
  const [state, setState] = useState({ loading: true, session: null, error: null });
  const sequence = useRef(0);
  const refresh = useCallback(async (clear = false) => {
    const request = ++sequence.current;
    if (clear) setState({ loading: true, session: null, error: null });
    try {
      const session = await api("/api/auth/me");
      if (request === sequence.current) setState({ loading: false, session, error: null });
      return session;
    } catch (error) {
      if (request === sequence.current) setState({ loading: false, session: null, error });
      return null;
    }
  }, []);
  useEffect(() => {
    refresh(true);
    const changed = () => refresh(true);
    const storage = event => { if (event.key === signalKey) changed(); };
    const visible = () => { if (document.visibilityState === "visible") refresh(); };
    window.addEventListener(signalKey, changed);
    window.addEventListener("storage", storage);
    window.addEventListener("focus", visible);
    document.addEventListener("visibilitychange", visible);
    const timer = setInterval(visible, 30000);
    return () => {
      sequence.current++;
      clearInterval(timer);
      window.removeEventListener(signalKey, changed);
      window.removeEventListener("storage", storage);
      window.removeEventListener("focus", visible);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [refresh]);
  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    sequence.current++;
    setState({ loading: false, session: null, error: null });
    signalAuthChange();
    window.location.assign("/login");
  }
  return <AuthContext.Provider value={{ ...state, refresh, logout }}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);

export function RequireTeam({ children }) {
  const { loading, session, error, refresh, logout } = useAuth();
  const [logoutError, setLogoutError] = useState("");
  if (loading) return <p role="status">Tjekker login…</p>;
  if (!session) return <section className="card" style={{ padding: 24 }}>
    <h1>{error?.status === 401 ? "Log ind for at se dit hold" : "Dit hold kunne ikke åbnes"}</h1>
    <p role="alert">{error?.message || "Du skal logge ind."}</p>
    {error?.code === "TEAM_NOT_LINKED" && <p><a className="btn primary" href="/onboarding">Opret dit første hold</a></p>}
    <a href="/login">Gå til login</a>{" "}
    <button onClick={() => refresh(true)}>Prøv igen</button>{" "}
    <button onClick={() => logout().catch(e => setLogoutError(e.message))}>Log ud</button>
    {logoutError && <p role="alert">{logoutError}</p>}
  </section>;
  // Remount page state when the account changes, including across browser tabs.
  return <div key={session.user.id + ":" + session.team.id}>{children}</div>;
}

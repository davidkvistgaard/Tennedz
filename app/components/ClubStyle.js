"use client";
import { createContext, useContext, useEffect, useState, useId, useRef, useCallback } from "react";
import { useAuth } from "./AuthProvider";

import { CLUB_PALETTES, defaultKit, validateTeamKit, teamKitOptions } from "../../lib/riders/club-kit.mjs";
import KitPattern from "./KitPattern";
import { api } from "../../lib/api";
export { CLUB_PALETTES } from "../../lib/riders/club-kit.mjs";
const DEFAULT = defaultKit(null);
const Context = createContext({ kit: DEFAULT, choices: teamKitOptions(null), loading: false, saving: false, error: "", save: async () => false });
export function ClubStyleProvider({ children }) {
  const { session } = useAuth();
  const teamId = session?.team?.id;
  return <TeamClubStyle key={teamId || "guest"} teamId={teamId}>{children}</TeamClubStyle>;
}
function TeamClubStyle({ teamId, children }) {
  const [kit, setKit] = useState(() => defaultKit(teamId));
  const [loading, setLoading] = useState(!!teamId), [saving, setSaving] = useState(false), [error, setError] = useState("");
  const sequence = useRef(0), busy = useRef(false), mounted = useRef(false);
  const refresh = useCallback(async () => {
    if (!teamId || busy.current) return;
    const request = ++sequence.current;
    try {
      const result = await api(`/api/team/identity?team_id=${encodeURIComponent(teamId)}`);
      if (mounted.current && request === sequence.current && result.team_id === teamId) { setKit(validateTeamKit(result.kit, teamId)); setError(""); }
    } catch (e) { if (mounted.current && request === sequence.current) setError(e.message); }
    finally { if (mounted.current && request === sequence.current) setLoading(false); }
  }, [teamId]);
  useEffect(() => {
    mounted.current = true; refresh();
    const visible = () => { if (document.visibilityState === "visible") refresh(); };
    const changed = e => { if (e.key === `pelotonia:kit-change:${teamId}`) refresh(); };
    window.addEventListener("focus", visible); window.addEventListener("storage", changed);
    document.addEventListener("visibilitychange", visible);
    const timer = setInterval(visible, 30000);
    return () => { mounted.current = false; sequence.current++; clearInterval(timer); window.removeEventListener("focus", visible); window.removeEventListener("storage", changed); document.removeEventListener("visibilitychange", visible); };
  }, [refresh, teamId]);
  async function save(value) {
    if (!teamId || busy.current || loading) return false;
    busy.current = true; sequence.current++; setSaving(true); setError("");
    try {
      const result = await api("/api/team/identity", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ team_id: teamId, kit: value }) });
      if (!mounted.current || result.team_id !== teamId) return false;
      setKit(validateTeamKit(result.kit, teamId));
      try { localStorage.setItem(`pelotonia:kit-change:${teamId}`, crypto.randomUUID()); } catch { /* Focus/polling still synchronize devices. */ }
      return true;
    } catch (e) { if (mounted.current) setError(e.message); return false; }
    finally { busy.current = false; if (mounted.current) setSaving(false); }
  }
  return <Context.Provider value={{ kit, choices: teamKitOptions(teamId), loading, saving, error, refresh, save }}>{children}</Context.Provider>;
}
export const useClubStyle = () => useContext(Context);
export function Jersey({ kit, name = "Team jersey", customColors }) {
  const clip = useId().replace(/:/g, "");
  const colors = customColors || CLUB_PALETTES[kit.palette] || CLUB_PALETTES.forest;
  return <svg viewBox="0 0 240 240" role="img" aria-label={name} className="studio-jersey">
    <path d="M75 35L95 25Q120 45 145 25L165 35L213 84L180 113L163 95V214Q120 226 77 214V95L60 113L27 84Z" fill={colors.primary} stroke="#253e33" strokeWidth="3" strokeLinejoin="round"/>
    <defs><clipPath id={clip}><path d="M78 52H162V214Q120 226 78 214Z"/></clipPath></defs>
    <g clipPath={`url(#${clip})`}><g transform="translate(78 52) scale(.84 1.65)"><KitPattern pattern={kit.pattern} color={colors.accent}/></g></g>
    <path d="M96 27Q120 52 144 27M35 79L63 102M177 102L205 79" fill="none" stroke={colors.accent} strokeWidth="9"/>
    <path d="M120 43V211" stroke="#fff7dd" strokeWidth="2" opacity=".5"/>
    <path d="M83 55L103 57M159 60L141 75" stroke="#fff" strokeWidth="8" opacity=".08"/>
    <circle cx="143" cy="77" r="8" fill={colors.accent}/>
  </svg>;
}

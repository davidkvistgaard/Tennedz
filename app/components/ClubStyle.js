"use client";
import { createContext, useContext, useEffect, useState, useId } from "react";
import { useAuth } from "./AuthProvider";

import { CLUB_PALETTES, defaultKit, validateTeamKit, teamKitOptions } from "../../lib/riders/club-kit.mjs";
import KitPattern from "./KitPattern";
export { CLUB_PALETTES } from "../../lib/riders/club-kit.mjs";
const DEFAULT = defaultKit(null);
const Context = createContext({ kit: DEFAULT, choices: teamKitOptions(null), save: () => false });
export function ClubStyleProvider({ children }) {
  const { session } = useAuth();
  const teamId = session?.team?.id;
  const choices = teamKitOptions(teamId);
  const fallback = defaultKit(teamId);
  const key = session?.team?.id ? `pelotonia:kit-preview:${session.team.id}` : null;
  const [saved, setSaved] = useState({ key: null, kit: DEFAULT });
  useEffect(() => {
    const read = () => { try { setSaved({ key, kit: validateTeamKit(JSON.parse(localStorage.getItem(key)), teamId) }); } catch { setSaved({ key, kit: defaultKit(teamId) }); } };
    read();
    const changed = event => { if (event.key === key || event.key === null) read(); };
    window.addEventListener("storage", changed);
    return () => window.removeEventListener("storage", changed);
  }, [key, teamId]);
  const kit = saved.key === key ? saved.kit : fallback;
  function save(value) {
    if (!key) return false;
    try { const next = validateTeamKit(value, teamId); localStorage.setItem(key, JSON.stringify(next)); setSaved({ key, kit: next }); return true; } catch { return false; }
  }
  return <Context.Provider value={{ kit, choices, save }}>{children}</Context.Provider>;
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

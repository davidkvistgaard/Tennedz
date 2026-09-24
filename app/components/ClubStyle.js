"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "./AuthProvider";

export const CLUB_PALETTES = {
  forest: { name: "Forest & honey", primary: "#285440", accent: "#dfb665" },
  ocean: { name: "Ocean & coral", primary: "#305c73", accent: "#edaa87" },
  plum: { name: "Plum & cream", primary: "#69475e", accent: "#e9d7b0" },
  ember: { name: "Ember & midnight", primary: "#994b35", accent: "#f0cc83" },
};
const DEFAULT = { palette: "forest", pattern: "band" };
const Context = createContext({ kit: DEFAULT, save: () => false });
function validate(value) {
  return value && Object.hasOwn(CLUB_PALETTES, value.palette) &&
    ["band", "diagonal", "plain"].includes(value.pattern)
    ? { palette: value.palette, pattern: value.pattern } : DEFAULT;
}
export function ClubStyleProvider({ children }) {
  const { session } = useAuth();
  const key = session?.team?.id ? `pelotonia:kit-preview:${session.team.id}` : null;
  const [saved, setSaved] = useState({ key: null, kit: DEFAULT });
  useEffect(() => {
    const read = () => { try { setSaved({ key, kit: validate(JSON.parse(localStorage.getItem(key))) }); } catch { setSaved({ key, kit: DEFAULT }); } };
    read();
    const changed = event => { if (event.key === key || event.key === null) read(); };
    window.addEventListener("storage", changed);
    return () => window.removeEventListener("storage", changed);
  }, [key]);
  const kit = saved.key === key ? saved.kit : DEFAULT;
  function save(value) {
    if (!key) return false;
    try { const next = validate(value); localStorage.setItem(key, JSON.stringify(next)); setSaved({ key, kit: next }); return true; } catch { return false; }
  }
  return <Context.Provider value={{ kit, save }}>{children}</Context.Provider>;
}
export const useClubStyle = () => useContext(Context);
export function Jersey({ kit, name = "Team jersey" }) {
  const colors = CLUB_PALETTES[kit.palette] || CLUB_PALETTES.forest;
  return <svg viewBox="0 0 240 240" role="img" aria-label={name} className="studio-jersey">
    <path d="M75 35L95 25Q120 45 145 25L165 35L213 84L180 113L163 95V214Q120 226 77 214V95L60 113L27 84Z" fill={colors.primary} stroke="#253e33" strokeWidth="3" strokeLinejoin="round"/>
    {kit.pattern === "band" && <path d="M78 120H162V151H78Z" fill={colors.accent}/>}
    {kit.pattern === "diagonal" && <path d="M78 160L162 85V119L78 194Z" fill={colors.accent}/>}
    <path d="M96 27Q120 52 144 27M35 79L63 102M177 102L205 79" fill="none" stroke={colors.accent} strokeWidth="9"/>
    <path d="M120 43V211" stroke="#fff7dd" strokeWidth="2" opacity=".5"/>
    <path d="M83 55L103 57M159 60L141 75" stroke="#fff" strokeWidth="8" opacity=".08"/>
    <circle cx="143" cy="77" r="8" fill={colors.accent}/>
  </svg>;
}

"use client";
import { CLUB_PALETTES, useClubStyle } from "./ClubStyle";

export default function ClubBadge({ name = "Pelotonia", decorative = false }) {
  const { kit } = useClubStyle();
  const colors = CLUB_PALETTES[kit.palette];
  const initials = name.trim().split(/\s+/u).slice(0, 2).map(word => Array.from(word)[0]).join("").toLocaleUpperCase("en");
  return <svg className="club-badge" viewBox="0 0 64 72" role={decorative ? undefined : "img"} aria-hidden={decorative || undefined} aria-label={decorative ? undefined : `${name} club colours`}>
    <path d="M5 5Q32-1 59 5V39Q57 57 32 68Q7 57 5 39Z" fill={colors.primary} stroke={colors.accent} strokeWidth="4"/>
    <path d="M12 14H52M22 53H42" stroke={colors.accent} strokeWidth="3"/>
    <text x="32" y="41" textAnchor="middle" fontFamily="Bricolage,sans-serif" fontSize="22" fontWeight="700" fill={colors.accent}>{initials || "P"}</text>
  </svg>;
}

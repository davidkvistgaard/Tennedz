"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "./AuthProvider";

export default function TeamShell({ title, children, compact = false }) {
  const { session } = useAuth(),
    pathname = usePathname();
  const [gameDate, setGameDate] = useState(null);
  useEffect(() => {
    let active = true;
    fetch("/api/game-date")
      .then((r) => r.json())
      .then((j) => {
        if (active && j.ok) setGameDate(j.game_date);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  const links = [
    ["/team", "Mit hold"],
    ["/team/run", "Kalender & løb"],
    ["/team/portraits", "Ryttere"],
    ["/team/leaderboards", "Ranglister"],
    ["/team/history", "Historik"],
  ];
  if (session?.is_admin) links.push(["/admin", "Admin"]);
  return (
    <div className="game-shell">
      <header className="game-header">
        <Link
          href="/team"
          className="game-brand"
          aria-label="Pelotonia – mit hold"
        >
          <span className="brand-mark">
            <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true">
              <path
                d="M5 25L14 8H22L13 25M9 17H24"
                stroke="currentColor"
                strokeWidth="3"
                fill="none"
                strokeLinecap="round"
              />
              <circle cx="23" cy="8" r="3" fill="currentColor" />
            </svg>
          </span>
          <span className="brand-word">
            pelotonia<small>Cycling Manager</small>
          </span>
        </Link>
        <nav className="game-nav" aria-label="Hovednavigation">
          {links.map(([href, label]) => (
            <Link
              href={href}
              key={href}
              aria-current={pathname === href ? "page" : undefined}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="game-date">
          {session?.team?.name}
          <br />
          {gameDate
            ? `Spildag ${new Date(gameDate + "T12:00:00Z").toLocaleDateString("da-DK")}`
            : "Henter spildag…"}
        </div>
      </header>
      {!compact && (
        <div className="page-heading">
          <h1>{title || "Mit hold"}</h1>
        </div>
      )}
      <div>{children}</div>
    </div>
  );
}

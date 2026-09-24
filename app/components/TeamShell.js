"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "./AuthProvider";
import ClubBadge from "./ClubBadge";

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
    ["/team", "My team"],
    ["/team/run", "Calendar & races"],
    ["/team/portraits", "Riders"],
    ["/team/leaderboards", "Rankings"],
    ["/team/history", "History"],
    ["/team/atlas", "Atlas"],
  ];
  if (session?.is_admin) links.push(["/admin", "Admin"]);
  return (
    <div className="game-shell">
      <a className="studio-skip" href="#team-page-content">Skip to content</a>
      <header className="game-header">
        <Link
          href="/team"
          className="game-brand"
          aria-label="Pelotonia – my team"
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
        <nav className="game-nav" aria-label="Main navigation">
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
        <div className="game-date"><ClubBadge name={session?.team?.name} decorative/><div>
          {session?.team?.name}
          <br />
          {gameDate
            ? `Game date ${new Date(gameDate + "T12:00:00Z").toLocaleDateString("en-GB", { timeZone: "UTC" })}`
            : "Loading game date…"}
        </div></div>
      </header>
      {!compact && (
        <div className="page-heading">
          <h1>{title || "My team"}</h1>
        </div>
      )}
      <div id="team-page-content" tabIndex={-1}>{children}</div>
    </div>
  );
}

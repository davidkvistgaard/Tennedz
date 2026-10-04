"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
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
    ["/team/settings", "Settings"],
    ["/team/calendar", "Calendar & races"],
    ["/team/defaults", "Default teams"],
    ["/team/motor-lab", "Motor Lab"],
    ["/team/portraits", "Riders"],
    ["/team/identity", "Club identity"],
    ["/team/staff", "Staff"],
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
          <Image src="/brand/pelotonia-horizontal.svg" alt="" width={190} height={48} priority />
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

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
  const [localDate, setLocalDate] = useState(null);
  useEffect(() => {
    const updateDate = () => setLocalDate(new Date().toLocaleDateString("en-GB"));
    updateDate();
    const timer = window.setInterval(updateDate, 30_000);
    window.addEventListener("focus", updateDate);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", updateDate);
    };
  }, []);
  const teamId = session?.team?.id;
  const links = [
    ["/team", "My team"],
    ...(teamId ? [[`/team/clubs/${encodeURIComponent(teamId)}`, "My Club"]] : []),
    ["/team/portraits", "Riders"],
    ["/team/economy", "Economy"],
    ["/team/calendar", "Calendar & races"],
    ["/team/history", "History"],
    ["/team/identity", "Club identity"],
    ["/team/leaderboards", "Rankings"],
    ["/team/marketplace", "Marketplace"],
    ["/team/clubs", "Clubs"],
    ["/team/atlas", "Atlas"],
    ["/team/settings", "Settings"],
    ...(session?.is_admin ? [["/admin", "Admin"]] : []),
    ["/team/motor-lab", "Motor Lab"],
  ];
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
          {localDate}
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

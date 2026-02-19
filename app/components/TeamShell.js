"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

function NavLink({ href, label }) {
  const pathname = usePathname();
  const active = pathname === href;

  return (
    <Link
      href={href}
      style={{
        textDecoration: "none",
        padding: "8px 10px",
        borderRadius: 10,
        border: "1px solid #e8e8e8",
        background: active ? "#111" : "white",
        color: active ? "white" : "#111",
        fontWeight: 700,
        fontSize: 13
      }}
    >
      {label}
    </Link>
  );
}

export default function TeamShell({ title, children }) {
  const [gameDate, setGameDate] = useState(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/game-date")
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return;
        if (j?.ok) setGameDate(j.game_date);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div style={{ padding: 16 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "baseline",
          flexWrap: "wrap",
          marginBottom: 10
        }}
      >
        <div>
          <div style={{ fontSize: 12, opacity: 0.7, fontWeight: 700 }}>Tennedz</div>
          <h2 style={{ margin: 0 }}>{title || "Mit hold"}</h2>
        </div>

        <div style={{ opacity: 0.8, fontSize: 13 }}>
          {gameDate ? (
            <>
              Game date: <b>{gameDate}</b>
            </>
          ) : null}
        </div>
      </div>

      {/* Navigation */}
      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          marginBottom: 14
        }}
      >
        <NavLink href="/team" label="Hold" />
        <NavLink href="/team/run" label="Kør løb" />
        <NavLink href="/team/leaderboards" label="Ranglister" />
        <NavLink href="/team/presets" label="Taktik-presets" />
        <NavLink href="/team/history" label="Tidligere løb" />
        {/* Admin ligger separat, men link er rart når du tester */}
        <NavLink href="/admin" label="Admin" />
      </div>

      <div>{children}</div>
    </div>
  );
}

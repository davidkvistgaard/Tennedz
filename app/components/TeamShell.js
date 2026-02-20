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
        textDecoration: "none"
      }}
    >
      <span
        className="pillBtn"
        style={{
          background: active ? "linear-gradient(90deg, rgba(124,255,107,0.22), rgba(77,214,255,0.18))" : undefined,
          borderColor: active ? "rgba(124,255,107,0.35)" : undefined
        }}
      >
        {label}
      </span>
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
    return () => (alive = false);
  }, []);

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div className="card" style={{ padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div className="badge" style={{ marginBottom: 10 }}>
              <span style={{ color: "var(--accent)", fontWeight: 1000 }}>TEN</span>
              <span style={{ color: "var(--muted)" }}>nedz</span>
              <span style={{ marginLeft: 8, opacity: 0.85 }}>Cycling Manager</span>
            </div>

            <div className="h1">{title || "Mit hold"}</div>
            <div className="small" style={{ marginTop: 6 }}>
              {gameDate ? (
                <>
                  Game date: <b style={{ color: "var(--text)" }}>{gameDate}</b> · Year = 90 days
                </>
              ) : (
                "…"
              )}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <NavLink href="/team" label="Hold" />
            <NavLink href="/team/run" label="Kør løb" />
            <NavLink href="/team/leaderboards" label="Ranglister" />
            <NavLink href="/team/presets" label="Presets" />
            <NavLink href="/team/history" label="Historik" />
            <NavLink href="/admin" label="Admin" />
          </div>
        </div>
      </div>

      <div>{children}</div>
    </div>
  );
}

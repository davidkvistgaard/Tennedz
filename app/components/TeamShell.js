"use client";

import { useEffect, useState } from "react";

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
    return () => { alive = false; };
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
          marginBottom: 12
        }}
      >
        <h2 style={{ margin: 0 }}>{title || "Tennedz"}</h2>
        <div style={{ opacity: 0.75 }}>
          {gameDate ? (
            <>
              Game date: <b>{gameDate}</b>
            </>
          ) : null}
        </div>
      </div>

      <div>{children}</div>
    </div>
  );
}

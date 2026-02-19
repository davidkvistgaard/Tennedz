"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function NavItem({ href, label }) {
  const pathname = usePathname();
  const active = pathname === href;

  return (
    <Link
      href={href}
      style={{
        display: "block",
        padding: "10px 12px",
        borderRadius: 12,
        textDecoration: "none",
        border: "1px solid #eee",
        background: active ? "#111" : "white",
        color: active ? "white" : "black"
      }}
    >
      {label}
    </Link>
  );
}

export default function TeamShell({ children, headerRight }) {
  return (
    <div style={{ padding: 18, fontFamily: "system-ui, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <div>
          <div style={{ fontWeight: 900, fontSize: 20 }}>Tennedz</div>
          <div style={{ opacity: 0.75 }}>Manager spil · prototype</div>
        </div>
        <div>{headerRight}</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 14, marginTop: 16 }}>
        <aside style={{ display: "grid", gap: 10, alignContent: "start" }}>
          <NavItem href="/team" label="Mit hold" />
          <NavItem href="/team/run" label="Kør løb" />
          <NavItem href="/team/presets" label="Taktik-presets" />
          <NavItem href="/team/leaderboards" label="Ranglister" />
          <NavItem href="/team/history" label="Tidligere løb" />

          <div style={{ marginTop: 8, opacity: 0.65, fontSize: 12 }}>
            (Træning, transfer, lobby/custom races kommer senere)
          </div>
        </aside>

        <section style={{ minWidth: 0 }}>{children}</section>
      </div>
    </div>
  );
}

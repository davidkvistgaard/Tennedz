"use client";

import Link from "next/link";
import SmallButton from "./components/SmallButton";

export default function Home() {
  return (
    <main style={{ display: "grid", gap: 14 }}>
      <div className="card" style={{ padding: 22 }}>
        <div className="badge" style={{ marginBottom: 12 }}>
          <span style={{ color: "var(--accent)", fontWeight: 1000 }}>TEN</span>
          <span style={{ color: "var(--muted)" }}>nedz</span>
          <span style={{ marginLeft: 8, opacity: 0.85 }}>Cycling Manager</span>
        </div>

        <div className="h1" style={{ fontSize: 34, lineHeight: 1.05 }}>
          Byg dit hold. Sæt taktik. Vind løb.
        </div>

        <p style={{ color: "var(--muted)", maxWidth: 720, marginTop: 10, lineHeight: 1.55 }}>
          Tennedz er et online managerspil i cykling, inspireret af klassiske manager-spil:
          fokus på strategi, forberedelse og et løb du kan følge i en viewer. Ingen fordel ved at være online
          i løbsøjeblikket — ordrer låses ved deadline.
        </p>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
          <Link href="/team" style={{ textDecoration: "none" }}>
            <SmallButton className="primary">Gå til mit hold</SmallButton>
          </Link>
          <Link href="/team/run" style={{ textDecoration: "none" }}>
            <SmallButton>Kør løb</SmallButton>
          </Link>
          <Link href="/admin" style={{ textDecoration: "none" }}>
            <SmallButton>Admin</SmallButton>
          </Link>
        </div>
      </div>

      <div className="kpi">
        <div className="k card" style={{ padding: 14 }}>
          <div className="small">Føles som et spil</div>
          <b>Live feed + viewer</b>
          <div className="small" style={{ marginTop: 6 }}>Masser af tekstvariation og navne i feedet.</div>
        </div>
        <div className="k card" style={{ padding: 14 }}>
          <div className="small">Fairness</div>
          <b>Deadline lock</b>
          <div className="small" style={{ marginTop: 6 }}>Ordrer kan ikke ændres efter deadline.</div>
        </div>
        <div className="k card" style={{ padding: 14 }}>
          <div className="small">Progression</div>
          <b>Form + fatigue</b>
          <div className="small" style={{ marginTop: 6 }}>Game-år = 90 dage (hurtigere karrierer).</div>
        </div>
      </div>
    </main>
  );
}

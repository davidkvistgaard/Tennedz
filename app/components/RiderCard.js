"use client";

import { countryLabel } from "../../lib/riders/identity.mjs";
import RiderAvatar from "./RiderAvatar";

function fmtNat(n) {
  if (!n) return "";
  return countryLabel(n);
}

export default function RiderCard({ r, selected, onClick, disabled }) {
  const genderIcon = r.gender === "F" ? "♀" : "♂";

  return (
    <button
      onClick={() => !disabled && onClick?.(r)}
      className="card"
      style={{
        padding: 12,
        textAlign: "left",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.85 : 1,
        outline: selected ? "2px solid rgba(0,230,118,0.55)" : "none",
        display: "grid",
        gridTemplateColumns: "84px 1fr",
        gap: 12,
        alignItems: "center"
      }}
      disabled={disabled}
    >
      <div style={{ width: 76, height: 76 }}>
        <RiderAvatar rider={r} size={76} />
      </div>

      <div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, lineHeight: 1.1 }}>
              {r.display_name || r.name} <span style={{ opacity: 0.65 }}>{genderIcon}</span>{" "}
              <span style={{ opacity: 0.75, fontSize: 13 }}>
                ({fmtNat(r.nationality)})
              </span>
            </div>
            <div className="small" style={{ marginTop: 4, opacity: 0.8 }}>
              Age {r.age ?? "?"} · Form {r.form ?? 0} · Fatigue {r.fatigue ?? 0}
            </div>
          </div>

          <div style={{ textAlign: "right" }}>
            <div className="small" style={{ opacity: 0.8 }}>Rating</div>
            <div style={{ fontWeight: 800 }}>{r.rating ?? 0}</div>
          </div>
        </div>

        <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
          <span className="pill">{(r.sprint ?? 0) >= 40 ? "Sprinter" : "Rider"}</span>
          {(r.cobbles ?? 0) >= 40 ? <span className="pill">Cobbles</span> : null}
          {(r.mountain ?? 0) >= 40 ? <span className="pill">Mountains</span> : null}
          {(r.timetrial ?? 0) >= 40 ? <span className="pill">TT</span> : null}
        </div>
      </div>
    </button>
  );
}

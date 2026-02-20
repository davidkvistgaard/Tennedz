"use client";

export default function Loading({ text = "Loader…" }) {
  return (
    <div className="card" style={{ padding: 14 }}>
      <div className="badge">
        <span style={{ width: 10, height: 10, borderRadius: 999, background: "var(--accent2)" }} />
        {text}
      </div>
    </div>
  );
}

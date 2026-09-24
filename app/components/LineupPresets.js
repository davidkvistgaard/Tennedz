"use client";

import { useEffect, useMemo, useState } from "react";
import SmallButton from "./SmallButton";
import { Pill } from "./ui";

function storageKey(teamId) {
  return `tennedz_lineup_presets_v1_${teamId}`;
}

function loadPresets(teamId) {
  try {
    const raw = localStorage.getItem(storageKey(teamId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function savePresets(teamId, presets) {
  localStorage.setItem(storageKey(teamId), JSON.stringify(presets));
}

export default function LineupPresets({
  teamId,
  riders,
  selectedIds,
  setSelectedIds,
  captainId,
  setCaptainId
}) {
  const [presets, setPresets] = useState([]);
  const [newName, setNewName] = useState("");

  useEffect(() => {
    if (!teamId) return;
    setPresets(loadPresets(teamId));
  }, [teamId]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  function applyPreset(p) {
    const ids = (p?.riderIds || []).filter((id) => riders.some((r) => r.id === id));
    if (ids.length !== 8) {
      alert("This preset no longer matches your squad (riders are missing). Save it again.");
      return;
    }
    setSelectedIds(ids);
    // kaptajn: behold hvis mulig, ellers første
    if (!ids.includes(captainId)) setCaptainId(ids[0] || "");
  }

  function deletePreset(name) {
    const next = presets.filter((p) => p.name !== name);
    setPresets(next);
    savePresets(teamId, next);
  }

  function saveCurrent() {
    if (!teamId) return;
    if (selectedIds.length !== 8) {
      alert("Select exactly 8 riders before saving a preset.");
      return;
    }
    const name = newName.trim();
    if (!name) {
      alert("Enter a preset name (e.g. 'Mountain team').");
      return;
    }

    const next = [
      ...presets.filter((p) => p.name !== name),
      { name, riderIds: selectedIds.slice(0, 8), createdAt: new Date().toISOString() }
    ].sort((a, b) => a.name.localeCompare(b.name));

    setPresets(next);
    savePresets(teamId, next);
    setNewName("");
  }

  return (
    <div className="card" style={{ padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div>
          <div className="h2" style={{ fontWeight: 1000 }}>Lineup presets</div>
          <div className="small" style={{ marginTop: 4 }}>
            Save and load eight-rider lineups (e.g. Mountain/Wind/Sprint). Stored in your browser.
          </div>
        </div>
        <Pill tone="info">{presets.length} presets</Pill>
      </div>

      <div className="hr" />

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <input
          className="input"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder='Preset name (e.g. "Mountain team")'
          style={{ maxWidth: 360 }}
        />
        <SmallButton className="primary" onClick={saveCurrent}>
          Save current eight
        </SmallButton>
      </div>

      <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
        {presets.length === 0 ? (
          <div className="small">No presets yet. Select 8 riders and save a preset.</div>
        ) : (
          presets.map((p) => {
            const matches = (p.riderIds || []).filter((id) => selectedSet.has(id)).length;
            return (
              <div
                key={p.name}
                style={{
                  padding: 12,
                  borderRadius: 16,
                  border: "1px solid var(--border)",
                  background: "rgba(0,0,0,0.25)",
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 10,
                  flexWrap: "wrap",
                  alignItems: "center"
                }}
              >
                <div>
                  <div style={{ fontWeight: 1000 }}>{p.name}</div>
                  <div className="small" style={{ marginTop: 4 }}>
                    {p.riderIds?.length || 0} riders · matching current selection: {matches}/8
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <SmallButton onClick={() => applyPreset(p)}>Load</SmallButton>
                  <SmallButton className="danger" onClick={() => deletePreset(p.name)}>Delete</SmallButton>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

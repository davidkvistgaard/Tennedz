"use client";

import { useEffect, useMemo, useState } from "react";
import SmallButton from "./SmallButton";
import { Pill } from "./ui";
import {api} from '../../lib/api';

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
  gender,
  riders,
  selectedIds,
  setSelectedIds,
  captainId,
  setCaptainId
}) {
  const [presets, setPresets] = useState([]);
  const [newName, setNewName] = useState("");
  const [serverDefault,setServerDefault]=useState(null);
  const [defaultMessage,setDefaultMessage]=useState('');

  useEffect(() => {
    if (!teamId) return;
    setPresets(loadPresets(teamId));
  }, [teamId]);
  useEffect(()=>{
    if(!teamId||!['M','F'].includes(gender))return;
    let active=true;
    api(`/api/team/default-race-plan?gender=${gender}`)
      .then(result=>{if(active)setServerDefault(result.lineup);})
      .catch(error=>{if(active)setDefaultMessage(error.message);});
    return()=>{active=false;};
  },[teamId,gender]);

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

  async function saveServerDefault(){
    if(selectedIds.length!==8||!selectedIds.includes(captainId)){
      setDefaultMessage('Choose eight riders and their captain first.');
      return;
    }
    try{
      await api('/api/team/default-race-plan',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({kind:'lineup',gender,
          selected_riders:selectedIds,captain_id:captainId})});
      setServerDefault({selected_riders:[...selectedIds],
        captain_id:captainId});
      setDefaultMessage('Your default one-day team is saved.');
    }catch(error){setDefaultMessage(error.message);}
  }

  function loadServerDefault(){
    const ids=serverDefault?.selected_riders;
    if(!Array.isArray(ids)||ids.length!==8||
      ids.some(id=>!riders.some(rider=>rider.id===id))){
      setDefaultMessage('Your saved default team is not eligible here.');
      return;
    }
    setSelectedIds(ids);
    setCaptainId(serverDefault.captain_id);
    setDefaultMessage('Your default team is loaded.');
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

      <div className="small">Your default one-day team is saved to your
        account for this category. It is used only after you enter a race
        and leave its lineup incomplete.</div>
      <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:10}}>
        <SmallButton onClick={saveServerDefault}>
          Save selected eight as default</SmallButton>
        {serverDefault?<SmallButton onClick={loadServerDefault}>
          Load my default team</SmallButton>:null}
      </div>
      {defaultMessage?<p role="status" className="small">
        {defaultMessage}</p>:null}

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

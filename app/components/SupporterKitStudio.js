"use client";
import { useState } from "react";
import { Jersey } from "./ClubStyle";
import { KIT_PATTERNS } from "../../lib/riders/club-kit.mjs";

export default function SupporterKitStudio() {
  const [colors,setColors]=useState({primary:"#285440",accent:"#dfb665"});
  const [pattern,setPattern]=useState("band");
  return <details className="supporter-kit-studio"><summary>Supporter studio · design preview</summary>
    <p>Choose your own colours and any of the 25 layouts. This previews a future supporter feature; supporter access and applying custom designs are not available yet. Your experiment resets when you leave this page.</p>
    <Jersey kit={{pattern}} customColors={colors} name="Custom supporter jersey preview"/>
    <div className="studio-custom-colors">{[["primary","Main colour"],["accent","Accent colour"]].map(([key,label])=><label key={key}>{label}<input type="color" value={colors[key]} onChange={e=>setColors({...colors,[key]:e.target.value})}/></label>)}</div>
    <label className="studio-field">Custom jersey layout<select value={pattern} onChange={e=>setPattern(e.target.value)}>{Object.entries(KIT_PATTERNS).map(([id,p])=><option key={id} value={id}>{p.name}</option>)}</select></label>
    <p className="studio-caption">Cosmetic only. Your standard team kit stays unchanged.</p>
  </details>;
}

"use client";
import {PLANS,ROLES,EFFORTS,planOrders} from "../../lib/race/orders.mjs";
export default function RaceOrders({orders,riders,onChange,disabled}){
  function edit(id,key,value){onChange({...orders,riders:{...orders.riders,[id]:{...orders.riders[id],[key]:value}}});}
  return <fieldset className="race-orders" disabled={disabled}>
    <legend>Your race orders</legend>
    <p>Saved with your lineup and locked at the deadline. You control the plan, not the riders during playback.</p>
    <label>Team plan<select aria-label="Team plan" value={orders.plan} onChange={e=>onChange(planOrders(riders.map(r=>r.id),riders.find(r=>orders.riders[r.id].role==="captain")?.id,e.target.value))}>{Object.entries(PLANS).map(([key,label])=><option value={key} key={key}>{label}</option>)}</select></label>
    <p className="small">Choosing a team plan resets roles to its suggested setup. You can then adjust each rider. Helpers sacrifice their finish and spend extra energy supporting your captain. Attackers are more likely to join an early break and spend extra energy trying. Aggressive effort adds speed and fatigue; careful effort and saving energy trade speed for recovery. Your captain determines the team result.</p>
    {riders.map(r=>{const order=orders.riders[r.id];return <div className="race-order-row" key={r.id}><strong>{r.name}</strong><label>Role for {r.name}<select aria-label={`Role for ${r.name}`} disabled={order.role==="captain"} value={order.role} onChange={e=>edit(r.id,"role",e.target.value)}>{order.role==="captain"?<option value="captain">Captain</option>:Object.entries(ROLES).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label><label>Effort for {r.name}<select aria-label={`Effort for ${r.name}`} value={order.effort} onChange={e=>edit(r.id,"effort",e.target.value)}>{Object.entries(EFFORTS).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label></div>;})}
    <p className="small">First tactical edition: no terrain-specific attack windows or custom conditional orders yet.</p>
  </fieldset>;
}

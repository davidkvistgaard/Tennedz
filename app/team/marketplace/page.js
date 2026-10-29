"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import TeamShell from "../../components/TeamShell";
import { useAuth } from "../../components/AuthProvider";
import { api } from "../../../lib/api";
import { MARKET_SKILLS } from "../../../lib/marketplace/validation.mjs";
import "./marketplace.css";

const emptyFilters={q:"",gender:"",country:"",minAge:"",maxAge:"",
  skill:"",minSkill:"",minPrice:"",maxPrice:"",sort:"newest"};
const money=value=>Number(value||0).toLocaleString("en-GB");
const label=key=>key==="timetrial"?"Time trial":key[0].toUpperCase()+key.slice(1);
function displayName(rider){return rider?.display_name||rider?.name||"Unnamed rider";}
function strengths(rider){
  return MARKET_SKILLS.map(key=>[key,Number(rider[key]??0)])
    .sort((a,b)=>b[1]-a[1]).slice(0,3);
}
function MarketCard({item,own,coins,busy,onAction}){
  const rider=item.rider;
  return <article className="market-card">
    <div className="market-card-head">
      <span className="market-initials" aria-hidden="true">{displayName(rider).split(" ").map(part=>part[0]).slice(0,2).join("")}</span>
      <div><h3>{displayName(rider)}</h3><p>{rider.gender==="F"?"Women":"Men"} · {rider.nationality||"Unknown"} · Age {rider.age??"–"}</p></div>
    </div>
    <dl className="market-strengths">{strengths(rider).map(([key,value])=><div key={key}><dt>{label(key)}</dt><dd>{value}</dd></div>)}</dl>
    <div className="market-card-foot"><div><strong>{money(item.price)} coins</strong><small>Listed by {own?"your team":item.seller_name}</small></div>
      {own?<button className="btn" disabled={busy} onClick={()=>onAction("cancel",item)}>Cancel listing</button>
        :<button className="btn primary" disabled={busy||Number(coins)<item.price}
          onClick={()=>onAction("buy",item)}>{Number(coins)<item.price?"Not enough coins":"Buy rider"}</button>}
    </div>
  </article>;
}
export default function MarketplacePage(){
  const {session,refresh}=useAuth();
  const [filters,setFilters]=useState(emptyFilters),[applied,setApplied]=useState(emptyFilters);
  const [offset,setOffset]=useState(0),[market,setMarket]=useState(null);
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
  const [error,setError]=useState(""),[status,setStatus]=useState("");
  const [riderId,setRiderId]=useState(""),[price,setPrice]=useState("");
  const team=session?.team;
  const load=useCallback(async()=>{
    setLoading(true);setError("");
    try{
      const params=new URLSearchParams();
      for(const [key,value] of Object.entries(applied)) if(value!=="") params.set(key,value);
      params.set("offset",String(offset));
      setMarket(await api(`/api/marketplace?${params}`));
    }catch(e){setError(e.message);}finally{setLoading(false);}
  },[applied,offset]);
  useEffect(()=>{load();},[load]);
  const listedIds=new Set(market?.my_listings?.map(item=>item.rider_id)||[]);
  const saleRiders=useMemo(()=>(session?.riders||[]).filter(r=>!listedIds.has(r.id))
    .sort((a,b)=>displayName(a).localeCompare(displayName(b))),[session?.riders,market?.my_listings]);
  async function act(action,item){
    if(action==="buy"&&!window.confirm(`Buy ${displayName(item.rider)} for ${money(item.price)} coins?`))return;
    setBusy(true);setError("");setStatus("");
    try{
      const body=action==="list"?{action,riderId,price:Number(price)}:{action,listingId:item.id};
      await api("/api/marketplace",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify(body)});
      await refresh();
      setStatus(action==="list"?"Rider listed.":action==="buy"?"Rider bought and added to your team.":"Listing cancelled.");
      if(action==="list"){setRiderId("");setPrice("");}
      await load();
    }catch(e){setError(e.message);}finally{setBusy(false);}
  }
  if(!team)return null;
  return <TeamShell title="Rider marketplace">
    <p className="page-intro">Find a rider who fits your team, or offer one of your own at a fixed price. Transfers use coins and preserve the rider’s identity and race history.</p>
    <p className="market-balance">Your coins <strong>{money(market?.coins??team.coins)}</strong></p>
    <p role="status" aria-live="polite">{status}</p>{error&&<p role="alert" className="market-error">{error}</p>}
    <section className="market-section" aria-labelledby="market-search-title">
      <h2 id="market-search-title">Search listings</h2>
      <form className="market-filters" onSubmit={event=>{event.preventDefault();setOffset(0);setApplied({...filters});}}>
        <label>Name<input type="search" value={filters.q} maxLength={80} onChange={e=>setFilters({...filters,q:e.target.value})}/></label>
        <label>Category<select value={filters.gender} onChange={e=>setFilters({...filters,gender:e.target.value})}><option value="">All</option><option value="M">Men</option><option value="F">Women</option></select></label>
        <label>Country code<input type="text" maxLength={3} placeholder="e.g. DEN" value={filters.country} onChange={e=>setFilters({...filters,country:e.target.value.toUpperCase()})}/></label>
        <label>Minimum age<input type="number" min="16" max="70" value={filters.minAge} onChange={e=>setFilters({...filters,minAge:e.target.value})}/></label>
        <label>Maximum age<input type="number" min="16" max="70" value={filters.maxAge} onChange={e=>setFilters({...filters,maxAge:e.target.value})}/></label>
        <label>Skill<select value={filters.skill} onChange={e=>setFilters({...filters,skill:e.target.value,minSkill:"",sort:e.target.value?filters.sort:"newest"})}><option value="">Any</option>{MARKET_SKILLS.map(skill=><option key={skill} value={skill}>{label(skill)}</option>)}</select></label>
        <label>Minimum skill<input type="number" min="0" max="100" value={filters.minSkill} disabled={!filters.skill} onChange={e=>setFilters({...filters,minSkill:e.target.value})}/></label>
        <label>Minimum price<input type="number" min="1" max="1000000000" value={filters.minPrice} onChange={e=>setFilters({...filters,minPrice:e.target.value})}/></label>
        <label>Maximum price<input type="number" min="1" max="1000000000" value={filters.maxPrice} onChange={e=>setFilters({...filters,maxPrice:e.target.value})}/></label>
        <label>Sort by<select value={filters.sort} onChange={e=>setFilters({...filters,sort:e.target.value})}><option value="newest">Newest</option><option value="price_asc">Lowest price</option><option value="price_desc">Highest price</option><option value="skill_desc" disabled={!filters.skill}>Highest chosen skill</option></select></label>
        <button className="btn primary" type="submit">Search</button>
      </form>
      {loading?<p role="status">Loading listings…</p>:<><p className="market-count">{market?.items?.length||0} listings on this page</p>
        <div className="market-grid">{market?.items?.map(item=><MarketCard key={item.id} item={item}
          own={item.seller_team_id===team.id} coins={market.coins} busy={busy} onAction={act}/>)}</div>
        {!market?.items?.length&&<p className="club-empty">No riders match these filters.</p>}
        <div className="market-pages"><button className="btn" disabled={offset===0||loading} onClick={()=>setOffset(Math.max(0,offset-50))}>Previous</button><span>Page {Math.floor(offset/50)+1}</span><button className="btn" disabled={!market?.has_more||loading} onClick={()=>setOffset(offset+50)}>Next</button></div>
      </>}
    </section>
    <section className="market-section" aria-labelledby="market-sell-title">
      <h2 id="market-sell-title">Sell a rider</h2>
      <p>A rider selected for an unfinished race or saved lineup must be removed from it before listing.</p>
      <form className="market-sell" onSubmit={event=>{event.preventDefault();act("list");}}>
        <label>Your rider<select required value={riderId} onChange={e=>setRiderId(e.target.value)}><option value="">Choose a rider</option>{saleRiders.map(r=><option key={r.id} value={r.id}>{displayName(r)} · {r.gender==="F"?"Women":"Men"}</option>)}</select></label>
        <label>Price in coins<input required type="number" min="1" max="1000000000" step="1" value={price} onChange={e=>setPrice(e.target.value)}/></label>
        <button className="btn primary" disabled={busy||loading||!riderId||!price}>List rider</button>
      </form>
      <h3>Your active listings</h3>
      <div className="market-grid">{market?.my_listings?.map(item=><MarketCard key={item.id} item={item} own coins={market.coins} busy={busy} onAction={act}/>)}</div>
      {!market?.my_listings?.length&&<p className="club-empty">You have no active listings.</p>}
    </section>
  </TeamShell>;
}

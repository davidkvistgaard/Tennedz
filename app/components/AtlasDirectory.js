"use client";
import { useMemo, useState } from "react";
import { objectCamera } from "../../lib/world/atlas-view.mjs";

export default function AtlasDirectory({ objects, onSelect }) {
  const [query,setQuery]=useState("");
  const [category,setCategory]=useState("all");
  const places=useMemo(()=>objects.filter(o=>o.name && o.type!=="grid_cell" && !o.properties.reserved && objectCamera(o)),[objects]);
  const matches=places.filter(o=>(category==="all" || (category==="regions" ? o.type==="region" : category==="cities" ? o.type==="settlement" : o.type!=="region" && o.type!=="settlement")) && o.name.toLocaleLowerCase("en").includes(query.trim().toLocaleLowerCase("en"))).sort((a,b)=>a.name.localeCompare(b.name,"en"));
  return <details className="atlas-directory"><summary>Find a place</summary><div className="atlas-directory-controls"><label>Search the atlas<input type="search" placeholder="Aurelia, Northern Plateau…" value={query} onChange={e=>setQuery(e.target.value)}/></label><label>Place type<select value={category} onChange={e=>setCategory(e.target.value)}><option value="all">All places</option><option value="regions">Regions</option><option value="cities">Cities & settlements</option><option value="landmarks">Landmarks & other places</option></select></label></div><p className="studio-caption" role="status">{matches.length ? `${matches.length} ${matches.length===1?"place":"places"} found${matches.length>12?' · showing the first 12; refine your search':''}` : "No places match. Try another name or place type."}</p><div className="atlas-directory-results">{matches.slice(0,12).map(o=><button key={o.id} onClick={()=>onSelect(o.id)} aria-label={`Visit ${o.name}`}><strong>{o.name}</strong><span>{o.type.replaceAll('_',' ')} ↗</span></button>)}</div></details>;
}

export function PlaceNotes({ place }) {
  const p=place.properties;
  return <section className="atlas-place-notes" aria-label="Place notes">
    {place.description && <p>{place.description}</p>}
    {Number.isFinite(p.elevation?.min) && Number.isFinite(p.elevation?.max) && <p><strong>Elevation</strong><br/>{p.elevation.min.toLocaleString('en-GB')}–{p.elevation.max.toLocaleString('en-GB')} m</p>}
    {p.landCover?.dominant && <p><strong>Landscape</strong><br/>{p.landCover.dominant.join(', ')}{p.landCover.scattered?.length ? `, with scattered ${p.landCover.scattered.join(', ')}` : ''}.</p>}
    {p.climate?.winter && <p><strong>Winter</strong><br/>{p.climate.winter}.</p>}
    {p.climate?.summer && <p><strong>Summer</strong><br/>{p.climate.summer}.</p>}
  </section>;
}

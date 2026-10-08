/** Rendering utilities use stable IDs and local kilometres, never names or WGS84. */
export function geometryBounds(g){
  if(!g) return null;
  const points=[];
  function visit(v){if(Array.isArray(v)&&v.length===2&&v.every(Number.isFinite))points.push(v);else if(Array.isArray(v))v.forEach(visit);}
  visit(g.coordinates);if(!points.length)return null;
  return [Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1])),Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1]))];
}
export function fitBounds([x1,y1,x2,y2],padding=1.15){const w=Math.max(x2-x1,(y2-y1)*4/3,.05)*padding;return {x:(x1+x2-w)/2,y:(y1+y2-w*.75)/2,width:w};}
export function detailLevel(width){return width<=2?4:width<=25?3:width<=70?2:1;}
export function clampCamera(v){const width=Math.max(.08,Math.min(650,v.width));return {width,x:Math.max(-60,Math.min(540-width,v.x)),y:Math.max(-60,Math.min(420-width*.75,v.y))};}
export function zoomCamera(v,factor,anchor=[.5,.5]){const width=Math.max(.08,Math.min(650,v.width*factor));return clampCamera({width,x:v.x+(v.width-width)*anchor[0],y:v.y+(v.width-width)*.75*anchor[1]});}
export function objectCamera(o){if(o.focusBounds)return fitBounds(o.focusBounds,1);const b=geometryBounds(o.geometry);if(!b)return null;if(b[0]===b[2]&&b[1]===b[3])return fitBounds([b[0]-10,b[1]-7.5,b[0]+10,b[1]+7.5],1);return fitBounds(b);}
export function intersects(a,b){return a[0]<=b[2]&&a[2]>=b[0]&&a[1]<=b[3]&&a[3]>=b[1];}
export function visibleRepresentations(objects,camera){const level=detailLevel(camera.width),viewport=[camera.x,camera.y,camera.x+camera.width,camera.y+camera.width*.75];return objects.flatMap(o=>(o.representations||[]).filter(r=>level>=r.minZoom&&level<=r.maxZoom&&intersects(geometryBounds(r.geometry),viewport)).map((r,i)=>({...r,object:o,key:`${o.id}-${i}`})));}
export function geometryPath(g){const ring=points=>points.map((p,i)=>`${i?'L':'M'}${p[0]},${p[1]}`).join(' ');if(g.type==='LineString')return ring(g.coordinates);if(g.type==='MultiLineString')return g.coordinates.map(ring).join(' ');if(g.type==='Polygon')return g.coordinates.map(p=>ring(p)+'Z').join(' ');if(g.type==='MultiPolygon')return g.coordinates.flatMap(p=>p.map(r=>ring(r)+'Z')).join(' ');return '';}
export function labelsFor(representations,camera,viewportWidth=1000){const occupied=[];return representations.filter(r=>r.label&&r.object.name).sort((a,b)=>(b.object.properties.isCapital?10:0)-(a.object.properties.isCapital?10:0)||a.object.id.localeCompare(b.object.id)).filter(r=>{const b=geometryBounds(r.geometry),x=((b[0]+b[2])/2-camera.x)/camera.width*viewportWidth,y=((b[1]+b[3])/2-camera.y)/camera.width*viewportWidth;const w=Math.min(220,r.object.name.length*6.5),rect=[x-w/2,y-20,x+w/2,y+4];if(x<0||x>viewportWidth||y<0||y>viewportWidth*.75||occupied.some(o=>intersects(rect,o)))return false;occupied.push(rect);return true;});}

import {labelPriority,representationZoom} from './visual-style.mjs';
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
export function objectCamera(o){if(!o)return null;if(o.focusBounds)return fitBounds(o.focusBounds,1);const b=geometryBounds(o.geometry);if(!b)return null;if(b[0]===b[2]&&b[1]===b[3])return fitBounds([b[0]-10,b[1]-7.5,b[0]+10,b[1]+7.5],1);return fitBounds(b);}
export function intersects(a,b){return a[0]<=b[2]&&a[2]>=b[0]&&a[1]<=b[3]&&a[3]>=b[1];}
export function visibleRepresentations(objects,camera){const level=detailLevel(camera.width),viewport=[camera.x,camera.y,camera.x+camera.width,camera.y+camera.width*.75];return objects.flatMap(o=>(o.representations||[]).filter(r=>{const zoom=representationZoom(o,r);return level>=zoom.min&&level<=zoom.max&&intersects(geometryBounds(r.geometry),viewport);}).map((r,i)=>({...r,object:o,key:`${o.id}-${i}`})));}
export function geometryPath(g,smooth=false){const ring=points=>points.map((p,i)=>`${i?'L':'M'}${p[0]},${p[1]}`).join(' ');const curved=points=>{if(points.length<3)return ring(points);let d=`M${points[0][0]},${points[0][1]}`;for(let i=1;i<points.length-1;i++){const p=points[i],q=points[i+1];d+=` Q${p[0]},${p[1]} ${(p[0]+q[0])/2},${(p[1]+q[1])/2}`;}return d+` L${points.at(-1)[0]},${points.at(-1)[1]}`;};if(g.type==='LineString')return (smooth?curved:ring)(g.coordinates);if(g.type==='MultiLineString')return g.coordinates.map(smooth?curved:ring).join(' ');if(g.type==='Polygon')return g.coordinates.map(p=>ring(p)+'Z').join(' ');if(g.type==='MultiPolygon')return g.coordinates.flatMap(p=>p.map(r=>ring(r)+'Z')).join(' ');return '';}
export function labelsFor(representations,camera,viewportWidth=1000){const occupied=[],level=detailLevel(camera.width);return representations.filter(r=>r.label&&r.object.name&&(level>1||labelPriority(r.object)>=65)).sort((a,b)=>labelPriority(b.object)-labelPriority(a.object)||a.object.id.localeCompare(b.object.id)).filter(r=>{const b=geometryBounds(r.geometry),x=((b[0]+b[2])/2-camera.x)/camera.width*viewportWidth,y=((b[1]+b[3])/2-camera.y)/camera.width*viewportWidth;const w=Math.min(220,r.object.name.length*6.5),rect=[x-w/2,y-20,x+w/2,y+4];if(rect[0]<0||rect[2]>viewportWidth||rect[1]<0||rect[3]>viewportWidth*.75||occupied.some(o=>intersects(rect,o)))return false;occupied.push(rect);return true;});}

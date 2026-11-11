import * as THREE from './vendor/three.module.js';
import {batch, box, standard} from './h5-landscape.js';

const stone = ['#c8b698', '#b0a088', '#ae987d', '#ddd0b0'];
const pale = ['#e0d7bc', '#c9bb9f', '#bfb195'];
const basalt = ['#514e4b', '#69615a', '#605955'];
const slate = '#595e5c';
const tile = '#984f36';
const copper = '#5b8271';

export const landmarkRadius = {
  cathedral: 106, gate: 48, market: 49, hall: 48, station: 56, lighthouse: 20,
  glasshouse: 50, observatory: 22, funicular: 82, tower: 23, baths: 40,
  vineyard: 92, abbey: 54, windmills: 65,
};

function architecture(out, land, {x, z, bearing}) {
  const c = Math.cos(bearing), s = Math.sin(bearing);
  const point = (u, v) => [x + u*c - v*s, z + u*s + v*c];
  const base = land.ground(x, z);
  const solid = (u,v,w,d,y,h,palette = stone) => box(out,point(u,v),w,d,base+y,h,bearing,palette);
  function gable(u,v,w,d,y,h,rise,roof=slate,walls=stone) {
    const at=solid(u,v,w,d,y,h,walls);
    const a=w/2+.6,b=d/2+.65;
    for(const side of [-1,1]) {
      out.quad(at(-a,h,side*b),at(a,h,side*b),at(a,h+rise,0),at(-a,h+rise,0),roof);
      for(let row=1;row<10;row++) {
        const t=row/10, q=t+.012;
        out.quad(at(-a,h+rise*t+.04,side*b*(1-t)),at(a,h+rise*t+.04,side*b*(1-t)),
          at(a,h+rise*q+.04,side*b*(1-q)),at(-a,h+rise*q+.04,side*b*(1-q)),'#776b5c');
      }
      out.tri(at(side*w/2,h,-d/2),at(side*w/2,h,d/2),at(side*w/2,h+rise,0),walls[0]);
    }
    for(let k=7-w/2;k<w/2-3;k+=7) {
      for(const side of [-1,1]) {
        out.quad(at(k,h*.32,side*(d/2+.04)),at(k+1.6,h*.32,side*(d/2+.04)),
          at(k+1.6,h*.68,side*(d/2+.04)),at(k,h*.68,side*(d/2+.04)),'#414e50');
      }
    }
  }
  function round(u,v,y,lower,upper,h,paint,sides=16) {
    const at=(r,a,b)=>{
      const [px,pz]=point(u+Math.cos(a)*r,v+Math.sin(a)*r);
      return [px,base+b,pz];
    };
    for(let i=0;i<sides;i++){
      const a=i*2*Math.PI/sides,b=(i+1)*2*Math.PI/sides;
      out.quad(at(lower,a,y),at(lower,b,y),at(upper,b,y+h),at(upper,a,y+h),paint);
    }
  }
  function dome(u,v,y,r,paint) {
    for(let i=0;i<8;i++){
      const a=i*Math.PI/16,b=(i+1)*Math.PI/16;
      round(u,v,y+r*Math.sin(a),r*Math.cos(a),r*Math.cos(b),r*(Math.sin(b)-Math.sin(a)),paint);
    }
  }
  return {point, solid, gable, round, dome};
}

function modelSite(out,land,site) {
  const {model,x,z}=site;
  const {point,solid,gable,round,dome}=architecture(out,land,site);
  switch(model) {
    case 'cathedral':
      gable(0,0,188,42,-3,29,22,slate,pale);
      gable(-13,0,38,92,-3,29,21,slate,pale);
      solid(-13,0,25,25,25,45,pale);
      round(-13,0,70,13,0,101,'#5d706e',8);
      for(const v of [-15,15]){
        solid(-80,v,13,13,-3,43,pale);
        round(-80,v,40,8,0,20,slate,8);
      }
      for(let u=-58;u<=72;u+=13)for(const v of [-22,22])solid(u,v,3,5,-2,15,pale);
      break;
    case 'abbey':
      gable(0,-23,75,16,-3,10,9,slate);
      gable(-32,3,13,43,-3,8,6,slate);
      gable(30,3,13,43,-3,8,6,slate);
      solid(0,24,65,2,-3,6);
      solid(-21,-23,9,9,8,16,pale);
      round(-21,-23,24,6,0,9,slate,8);
      for(const u of [-16,-5,6,17])solid(u,7,5,21,-1.5,2,['#88915d']);
      break;
    case 'market':
      for(const v of [-14,0,14]){
        gable(0,v,64,12,-2,8,5,tile,pale);
        for(let u=-28;u<=28;u+=8)solid(u,v+6.5,1.2,2,-2,7,stone);
      }
      break;
    case 'station':
      for(const v of [-11,11])gable(7,v,71,18,-2,10,7,slate);
      solid(-26,0,12,39,-3,15,pale);
      solid(-26,0,10,10,11,14,pale);
      round(-26,0,25,7,0,7,slate,8);
      solid(-32,0,1,4.5,17,4.5,['#e8dcc1']);
      solid(-32.6,0,1,0.4,18,2,['#494743']);
      break;
    case 'hall':
      gable(0,0,67,37,-3,20,17,copper,pale);
      solid(0,23,25,12,-3,8,pale);
      for(const u of [-11,-5,5,11])solid(u,20,1.4,1.4,4,12,pale);
      for(let i=0;i<6;i++)solid(0,33-i,27,2,-3,3+i*.7,pale);
      break;
    case 'gate':
      for(const u of [-16,16]){
        solid(u,0,16,20,-4,26,basalt);
        for(const v of [-8,0,8])solid(u,v,17,2,22,5,basalt);
      }
      solid(0,0,21,11,16,7,stone);
      for(let i=-4;i<=4;i++)solid(i*2.3,0,2.4,11,12+4*Math.sqrt(1-(i/4.2)**2),6,pale);
      break;
    case 'lighthouse':
      round(0,0,-4,9,7,17,'#dcd2ba');
      round(0,0,13,7,6,7,'#a54f43');
      round(0,0,20,6,4.5,12,'#e1d8c4');
      round(0,0,32,5.8,5.8,1.5,basalt[0]);
      round(0,0,33.5,4.5,4.5,5,'#9cb2a7');
      round(0,0,38.5,5.3,0,5,'#9d5146');
      gable(11,0,14,9,-2,6,4,tile);
      break;
    case 'glasshouse':
      for(const v of [-18,0,18]){
        gable(0,v,63,11,-2,5,7,'#92aca5',['#a8bdb0','#829f97']);
        for(let u=-29;u<30;u+=5){
          solid(u,v-5.6,.5,.5,-1,5,['#d3dfca']);
          solid(u,v+5.6,.5,.5,-1,5,['#d3dfca']);
        }
      }
      break;
    case 'observatory':
      solid(0,0,26,26,-3,11,stone);
      round(0,0,8,10,10,5,pale[0]);
      dome(0,0,13,10,'#e3e7df');
      solid(0,1,1.5,16,18,2,['#65716b']);
      break;
    case 'baths':
      solid(0,0,64,25,-3,12,basalt);
      for(const u of [-21,0,21])dome(u,0,9,u===0?10:8,copper);
      break;
    case 'tower':
      solid(0,0,23,21,-5,35,basalt);
      solid(0,0,24,22,30,2,pale);
      round(0,0,32,17,0,15,slate,4);
      solid(0,10.7,3.5,.6,6,7,pale);
      break;
    case 'funicular':
      gable(0,0,26,15,-3,10,7,tile);
      for(let u=13;u<=74;u+=3){
        for(const v of [-1,1]){
          const a=point(u,v),b=point(u+3,v);
          const y=land.ground(...a)+.65,k=land.ground(...b)+.65;
          out.quad([a[0],y,a[1]],[a[0],y+.23,a[1]],[b[0],k+.23,b[1]],[b[0],k,b[1]],basalt[0]);
        }
      }
      break;
    case 'windmills':
      for(const [u,v] of [[-37,-16],[0,5],[37,17]]){
        const [px,pz]=point(u,v),base=land.ground(x,z),ground=land.ground(px,pz)-base;
        round(u,v,ground-3,7,5,23,pale[0],12);
        round(u,v,ground+20,6,0,7,slate,12);
        for(let i=0;i<4;i++){
          const a=.4+i*Math.PI/2,b=a+.19;
          const at=(r,t)=>{
            const [ax,az]=point(u+r*Math.cos(t),v+5.7);
            return [ax,base+ground+17+r*Math.sin(t),az];
          };
          out.quad(at(1,a),at(15,a),at(15,b),at(1,b),'#e8e2c6');
        }
      }
      break;
    case 'vineyard':
      for(let row=-8;row<=8;row++){
        const v=row*4.1;
        for(let u=-65;u<65;u+=5){
          const a=point(u,v),b=point(u+4.8,v);
          const y=land.ground(...a),k=land.ground(...b);
          const tint=row%2?'#62783b':'#798943';
          const c=point(u,v+.9),d=point(u+4.8,v+.9);
          const lower=[a[0],y+1.65,a[1]],upper=[b[0],k+1.65,b[1]];
          out.quad([a[0],y+.3,a[1]],[b[0],k+.3,b[1]],upper,lower,tint);
          out.quad(lower,upper,[d[0],k+1.72,d[1]],[c[0],y+1.72,c[1]],'#83964d');
          if((u+65)%20===0)box(out,a,.19,.19,y,2.15,0,['#8c7657']);
        }
      }
      const press=point(72,0);
      architecture(out,land,{x:press[0],z:press[1],bearing:site.bearing}).gable(0,0,14,11,-2,6,4,tile);
      break;
  }
}

export function landmarkMesh(land) {
  const out=batch();
  for(const site of land.landmarks) modelSite(out,land,site);
  return out.mesh(standard({side:THREE.DoubleSide}),'Cycling landmarks');
}

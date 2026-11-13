export function addTerrainDetail(material){
  material.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 earth;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\nearth=position.xz;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`
      #include <common>
      varying vec2 earth;
      float landNoise(vec2 p){
        vec2 q=floor(p),f=fract(p);f=f*f*(3.-2.*f);
        vec4 h=fract(sin(vec4(dot(q,vec2(29.37,81.59)),dot(q+vec2(1,0),vec2(29.37,81.59)),
          dot(q+vec2(0,1),vec2(29.37,81.59)),dot(q+vec2(1,1),vec2(29.37,81.59))))*42118.67);
        return mix(mix(h.x,h.y,f.x),mix(h.z,h.w,f.x),f.y)-.5;
      }
      float filteredNoise(vec2 p){
        return landNoise(p)*(1.-smoothstep(.24,1.15,max(length(dFdx(p)),length(dFdy(p)))));
      }`).replace('#include <color_fragment>',`
      #include <color_fragment>
      float grain=filteredNoise(earth*.15)*.27+filteredNoise(earth*.64)*.15+filteredNoise(earth*2.1)*.12;
      diffuseColor.rgb*=1.+grain;
    `);
  };
}

export function animateWater(material){
  const time={value:0};
  material.onBeforeCompile=shader=>{
    shader.uniforms.waveTime=time;
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 waterPos;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\nwaterPos=position.xz;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`
      #include <common>
      varying vec2 waterPos;
      uniform float waveTime;
    `).replace('#include <color_fragment>',`
      #include <color_fragment>
      vec2 p=waterPos;
      float bands=sin(dot(p,vec2(.053,.061))-waveTime*.91+sin(p.x*.011)*2.);
      float ripples=sin(dot(p,vec2(-.183,.101))+waveTime*1.21);
      float width=max(length(dFdx(p)),length(dFdy(p)));
      float wave=(bands*.13+ripples*.042)*(1.-smoothstep(4.,25.,width));
      diffuseColor.rgb*=1.+wave;
    `).replace('#include <normal_fragment_maps>',`
      #include <normal_fragment_maps>
      float bend=(1.-smoothstep(5.,32.,width))*.088;
      vec3 rippleNormal=vec3(bands+bend*ripples,0.,ripples*.65-bands*.32)*bend;
      normal=normalize(normal+mat3(viewMatrix)*rippleNormal);
    `);
  };
  return time;
}

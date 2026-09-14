// Entity values remain inert data. Asset names are mapped into a local resource root.
export const flags=e=>Number(e.spawnflags)||0;
export const numeric=(e,key,fallback)=>Number.isFinite(Number(e[key]))&&e[key]!==undefined?Number(e[key]):fallback;
export const toggleValue=(current,type='toggle')=>type==='on'?true:type==='off'?false:!current;
export function moveAngles(e){if(e.angle==='-1')return [-90,0,0];if(e.angle==='-2')return [90,0,0];if(e.angle!==undefined)return [0,numeric(e,'angle',0),0];const parts=(e.angles||'0 0 0').trim().split(/\s+/);return [0,1,2].map(i=>Number.isFinite(Number(parts[i]))?Number(parts[i]):0);}
export function worldSettings(map){
  const e=map.entities.find(e=>e.classname==='worldspawn')||{},base=name=>name.split(/[\\/]/).at(-1).toLowerCase();
  const wads=[...new Set((e.wad||'halflife.wad').split(';').map(base).filter(name=>/^[a-z0-9_. -]+\.wad$/.test(name)))];
  return {wads,sky:/^[a-z0-9_-]+$/i.test(e.skyname||'')?e.skyname:'office',far:Math.max(1024,Math.min(65536,numeric(e,'MaxRange',22000)))};
}
export function buttonSound(value){const n=Number(value)||0;if(!n)return null;if(n<=11&&n>0)return `buttons/button${n}.wav`;return ({12:'buttons/latchlocked1.wav',13:'buttons/latchunlocked1.wav',14:'buttons/lightswitch2.wav',21:'buttons/lever1.wav',22:'buttons/lever2.wav',23:'buttons/lever3.wav',24:'buttons/lever4.wav',25:'buttons/lever5.wav'})[n]||'buttons/button9.wav';}
export function doorSound(e,moving){const n=Number(e[moving?'movesnd':'stopsnd'])||0;return n>0&&n<=(moving?10:8)?`doors/door${moving?'move':'stop'}${n}.wav`:null;}
export const breakSound=material=>({0:'debris/bustglass1.wav',1:'debris/bustcrate1.wav',2:'debris/bustmetal1.wav',3:'debris/bustflesh1.wav',4:'debris/bustconcrete1.wav',5:'debris/bustceiling.wav',6:'debris/bustmetal1.wav',8:'debris/bustglass1.wav'})[material]||'debris/bustconcrete1.wav';

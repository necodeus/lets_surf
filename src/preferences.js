import {cvars} from './commands.js';
import {profiles} from './physics.js';
import {defaultBinds,actions} from './input.js';
import {defaultFpsMax,validFpsMax} from './render-timing.js';
export const preferenceKey='strafe-settings';
export const viewCvars={sensitivity:{min:.05,max:20,default:1},fov:{min:60,max:140,default:90}};
export const gameDefaults={...profiles.classic,airAcceleration:100,stepSize:224};
export const verticalFov=(horizontal,aspect)=>2*Math.atan(Math.tan(horizontal*Math.PI/360)/aspect)*180/Math.PI;
const record=value=>value&&typeof value==='object'&&!Array.isArray(value)?value:{};
export function normalizePreferences(input){
  const saved=record(input),physics={...gameDefaults},binds={...defaultBinds};
  if(saved.physicsVersion===3)for(const spec of Object.values(cvars)){
    const value=record(saved.physics)[spec.key];
    if(spec.boolean?typeof value==='boolean':typeof value==='number'&&Number.isFinite(value)&&value>=spec.min&&value<=spec.max)physics[spec.key]=value;
  }
  if(saved.bindVersion===2)for(const [key,value] of Object.entries(record(saved.binds))){
    if((Object.hasOwn(defaultBinds,key)||/^Key[A-Z]$/.test(key))&&actions.includes(value)&&(!key.startsWith('mwheel')||['+jump','+duck','none'].includes(value)))binds[key]=value;
  }
  const view={};for(const [key,spec] of Object.entries(viewCvars)){const raw=saved[key],value=typeof raw==='string'&&raw.trim()?Number(raw):raw;view[key]=typeof value==='number'&&Number.isFinite(value)&&value>=spec.min&&value<=spec.max?value:spec.default;}
  // Migrate the old default once, then preserve explicit console overrides.
  if(saved.airDefaultVersion!==1&&physics.airAcceleration===10)physics.airAcceleration=100;
  if(saved.stepDefaultVersion!==1&&physics.stepSize===18)physics.stepSize=gameDefaults.stepSize;
  // Old FOV values were vertical Three.js angles; CS uses horizontal angles.
  if(saved.fovMode!=='horizontal')view.fov=90;
  const bsp=record(saved.bsp);
  return {airDefaultVersion:1,stepDefaultVersion:1,fovMode:'horizontal',physicsVersion:3,bindVersion:2,physics,binds,...view,fpsMax:validFpsMax(saved.fpsMax)?saved.fpsMax:defaultFpsMax,bsp:{fullbright:bsp.fullbright===true,noVis:bsp.noVis===true,noclip:bsp.noclip===true}};
}
export function loadPreferences(storage){try{return normalizePreferences(JSON.parse((storage??globalThis.localStorage).getItem(preferenceKey)||'{}'));}catch{return normalizePreferences({});}}
export function savePreferences(value,storage){try{(storage??globalThis.localStorage).setItem(preferenceKey,JSON.stringify(normalizePreferences(value)));return true;}catch{return false;}}

import test from 'node:test';
import assert from 'node:assert/strict';
import {loadPreferences,savePreferences,normalizePreferences,preferenceKey,gameDefaults,verticalFov} from '../src/preferences.js';
import {runCommand} from '../src/commands.js';
import {MovementInput} from '../src/input.js';
import {defaults} from '../src/physics.js';
const memory=()=>{const data=new Map();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};};
test('console physics, fractional cvars, FPS and custom letter binds survive browser reload',()=>{
  const storage=memory(),saved=loadPreferences(storage),input=new MovementInput(saved.binds),settings={...saved.physics},renderSettings={fpsMax:0};
  const persist=()=>savePreferences({...saved,physics:settings,binds:input.binds,fpsMax:renderSettings.fpsMax},storage);
  const ctx={defaults:gameDefaults,settings,input,renderSettings,changed:persist,renderChanged:persist};
  for(const line of ['gravity 640','airaccelerate 127.5','friction 3.2','autobhop 1','fps_max 300','bind f "+duck"','unbind ctrl','bind mwheeldown "+jump"'])runCommand(line,ctx);
  const restored=loadPreferences(storage);assert.equal(restored.physics.gravity,640);assert.equal(restored.physics.airAcceleration,127.5);assert.equal(restored.physics.friction,3.2);assert.equal(restored.physics.autoBhop,true);assert.equal(restored.fpsMax,300);assert.equal(restored.binds.KeyF,'+duck');assert.equal(restored.binds.ControlRight,'none');assert.equal(restored.binds.mwheeldown,'+jump');
  runCommand('reset_physics',ctx);const reset=loadPreferences(storage);assert.deepEqual(reset.physics,gameDefaults);assert.equal(reset.fpsMax,300);assert.equal(reset.binds.KeyF,'+duck');
});
test('view and BSP flags survive persistence; obsolete map selection is discarded',()=>{
  const storage=memory();savePreferences({...loadPreferences(storage),sensitivity:1.65,fov:112,map:'water',bsp:{noclip:true,noVis:true,fullbright:true}},storage);
  const saved=loadPreferences(storage);assert.equal(saved.sensitivity,1.65);assert.equal(saved.fov,112);assert.equal(saved.map,undefined);assert.deepEqual(saved.bsp,{noclip:true,noVis:true,fullbright:true});
});
test('legacy settings preserve custom physics and sensitivity while replacing the old vertical FOV',()=>{
  const saved=normalizePreferences({physicsVersion:3,bindVersion:2,physics:{...defaults,airAcceleration:127.5},sensitivity:'1.4',fov:'105',air:'127'});
  assert.equal(saved.physics.airAcceleration,127.5);assert.equal(saved.sensitivity,1.4);assert.equal(saved.fov,90);
});
test('corrupt storage and invalid values fall back to playable defaults',()=>{
  const storage=memory();for(const value of ['null','[]','42','{bad json']){storage.setItem(preferenceKey,value);assert.deepEqual(loadPreferences(storage),normalizePreferences({}));}
  const p=normalizePreferences({physicsVersion:3,bindVersion:2,physics:{gravity:-20,friction:'3',autoBhop:1},binds:{KeyF:'eval',mwheelup:'+forward',Unknown:'+jump'},sensitivity:Infinity,fov:999,fpsMax:-1,map:'unknown',bsp:{noclip:'true'}});
  assert.deepEqual(p.physics,gameDefaults);assert.equal(p.sensitivity,1);assert.equal(p.fov,90);assert.equal(p.fpsMax,0);assert.equal(p.map,undefined);assert.equal(p.binds.KeyF,undefined);assert.equal(p.binds.mwheelup,'+jump');assert.equal(p.bsp.noclip,false);
});
test('denied browser storage does not stop startup or saving settings in the current session',()=>{
  const denied={getItem(){throw Error('denied');},setItem(){throw Error('quota');}};assert.deepEqual(loadPreferences(denied),normalizePreferences({}));assert.equal(savePreferences(normalizePreferences({}),denied),false);
});

test('new defaults migrate once, then explicit airaccelerate 10 and custom FOV survive reload',()=>{
  const storage=memory();storage.setItem(preferenceKey,JSON.stringify({physicsVersion:3,physics:{...defaults},fov:'100'}));
  const p=loadPreferences(storage);assert.equal(p.physics.airAcceleration,100);assert.equal(p.fov,90);
  p.physics.airAcceleration=10;p.fov=105;savePreferences(p,storage);const next=loadPreferences(storage);assert.equal(next.physics.airAcceleration,10);assert.equal(next.fov,105);
});
test('CS horizontal FOV remains 90 degrees for 4:3, 16:9 and portrait windows',()=>{
  assert.ok(Math.abs(verticalFov(90,4/3)-73.7397953)<.00001);
  for(const aspect of [4/3,16/9,9/16]){const v=verticalFov(90,aspect);const horizontal=2*Math.atan(Math.tan(v*Math.PI/360)*aspect)*180/Math.PI;assert.ok(Math.abs(horizontal-90)<1e-10);}
});

test('stepsize migrates the old default once, persists console overrides and resets to 224',()=>{
  const storage=memory();storage.setItem(preferenceKey,JSON.stringify({physicsVersion:3,physics:{...defaults}}));
  const saved=loadPreferences(storage);assert.equal(saved.physics.stepSize,224);
  const ctx={settings:saved.physics,defaults:gameDefaults,changed:()=>savePreferences(saved,storage)};
  runCommand('stepsize 256',ctx);assert.equal(loadPreferences(storage).physics.stepSize,256);
  runCommand('sv_stepsize 18',ctx);assert.equal(loadPreferences(storage).physics.stepSize,18);
  runCommand('stepsize 513',ctx);assert.equal(ctx.settings.stepSize,18);
  runCommand('reset_physics',ctx);assert.equal(loadPreferences(storage).physics.stepSize,224);
  assert.equal(normalizePreferences({physicsVersion:3,physics:{stepSize:32}}).physics.stepSize,32);
});

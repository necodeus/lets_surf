import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {parseBsp,parseWad,resolveTextures,parseEntities,readMipTexture,toGame,fromGame,vec,visibleLeaves,findLeaf} from '../src/bsp/format.js';
import {BspCollision,hullContents,traceHull,transform} from '../src/bsp/collision.js';
import {BspRuntime} from '../src/bsp/runtime.js';
import {BspRenderer,packLightmaps,faceOrder,skyFacePixels} from '../src/bsp/renderer.js';
import {Player,DT} from '../src/physics.js';
import {gameDefaults} from '../src/preferences.js';
const bytes=fs.readFileSync(new URL('../surf_ski_2.bsp',import.meta.url)),map=parseBsp(bytes);
const wad=parseWad(fs.readFileSync(new URL('../public/assets/goldsrc/halflife.wad',import.meta.url)));
const near=(a,b,e=1e-5)=>assert.ok(Math.abs(a-b)<e,`${a} != ${b}`);

test('the increased game stepsize lets the player walk out over the actual cage wall without penetration',()=>{
  for(const stepSize of [18,gameDefaults.stepSize]){
    const runtime=new BspRuntime(map),p=new Player(runtime.collision,toGame([-455,3050,673]));p.settings.stepSize=stepSize;
    for(let i=0;i<128;i++)p.step({});near(p.position.y,568.03125);
    let peak=p.position.y;
    for(let i=0;i<160;i++){p.step({forward:1,yaw:-Math.PI/2});peak=Math.max(peak,p.position.y);assert.ok(runtime.collision.canOccupy(p.position,p.height));}
    if(stepSize===18)assert.ok(p.position.x < -299);
    else{assert.ok(p.position.x > -299+16);near(peak,778.03125);}
  }
});

test('actual BSP30 parses all 15 lumps, geometry, models and entity references',()=>{
  assert.equal(map.version,30);assert.equal(map.lumps.length,15);assert.equal(map.faces.length,4541);assert.equal(map.models.length,50);assert.equal(map.clipnodes.length,7379);assert.equal(map.textures.length,64);
  assert.equal(map.textures.filter(t=>t.external).length,55);assert.ok(map.entities.some(e=>e.classname==='func_door_rotating'));
});
test('entity parser treats values as inert strings including paths, duplicate keys and special property names',()=>{
  const [e]=parseEntities('{"classname" "worldspawn" "classname" "final" "wad" "c:\\sierra\\halflife.wad" "__proto__" "data"}');assert.equal(e.classname,'final');assert.equal(e.wad,'c:\\sierra\\halflife.wad');assert.equal(e.__proto__,'data');assert.equal(Object.getPrototypeOf(e),null);
  assert.throws(()=>parseEntities('{"key"}'));
});
test('truncated, wrong-version, out-of-range and cyclic BSP files fail closed',()=>{
  assert.throws(()=>parseBsp(bytes.subarray(0,80)));const wrong=Buffer.from(bytes);wrong.writeInt32LE(29);assert.throws(()=>parseBsp(wrong),/30/);
  const truncated=Buffer.from(bytes);truncated.writeInt32LE(bytes.length+5,4);assert.throws(()=>parseBsp(truncated),/zakres/);
  const cycle=Buffer.from(bytes);cycle.writeInt16LE(0,map.lumps[5].offset+4);assert.throws(()=>parseBsp(cycle),/Cykliczne/);
  const face=Buffer.from(bytes);face.writeUInt16LE(65535,map.lumps[7].offset+10);assert.throws(()=>parseBsp(face),/texinfo/);
});
test('WAD3 resolves every external material and preserves embedded artwork',()=>{
  const m=parseBsp(bytes),art=m.textures.find(t=>t.name==='madeby');assert.deepEqual(resolveTextures(m,[wad]),[]);assert.equal(m.textures.find(t=>t.name==='madeby'),art);for(const t of m.textures){assert.equal(t.external,false);assert.equal(t.mipmaps.length,4);assert.equal(t.mipmaps[0].data.length,t.width*t.height*4);}
});
test('masked WAD palettes retain opaque pixels and transparent index 255',()=>{
  const texture=wad.get('{ladder1b')();assert.equal(texture.masked,true);const alpha=texture.mipmaps[0].data.filter((_,i)=>i%4===3);assert.ok(alpha.includes(0));assert.ok(alpha.includes(255));
  assert.throws(()=>parseWad(new Uint8Array(12)));assert.throws(()=>readMipTexture(new Uint8Array(12)));
});
test('all PVS rows decode including padded zero runs; eye lookup distinguishes leaves',()=>{
  for(let i=0;i<map.leaves.length;i++)assert.equal(visibleLeaves(map,i).length,Math.ceil(map.models[0].visLeaves/8));
  const spawn=vec(map.entities.find(e=>e.classname==='info_player_start').origin);const leaf=findLeaf(map,spawn);assert.ok(leaf>0);assert.equal(map.leaves[leaf].contents,-1);
});
test('coordinate conversion and rotated inline-model transforms round trip',()=>{
  const p=[123,-75,321];assert.deepEqual(fromGame(toGame(p)),p);const i={origin:[44,55,-10],angles:[20,75,30]},q=transform(transform(p,i),i,true);p.forEach((v,k)=>near(q[k],v));
});
test('all 18 real spawns settle on the original floor without hull penetration',()=>{
  const runtime=new BspRuntime(map);assert.equal(runtime.spawns.length,18);
  for(let i=0;i<runtime.spawns.length;i++){const p=new Player(runtime.collision,runtime.spawn(i).position);for(let j=0;j<128;j++)p.step({});assert.equal(p.grounded,true);near(p.position.y,5.03125);assert.ok(runtime.collision.canOccupy(p.position,72));}
});
test('BSP clip hulls stop standing/crouching sweeps and never tunnel through map walls',()=>{
  const c=new BspCollision(map),p=toGame([-392.9,3618.81,79]);p.y-=36;
  const ground=c.trace(p,{x:0,y:-100,z:0},72);near(ground.fraction,.3796875);assert.deepEqual(ground.normal,{x:0,y:1,z:-0});
  for(const height of [36,72]){const h=c.trace({...p,y:5.04},{x:10000,y:0,z:0},height);assert.ok(h.fraction<.1);assert.ok(h.normal.x<0);assert.equal(h.allSolid,false);}
});
test('an actual steep ramp clips velocity along its plane and allows surfing without penetration',()=>{
  const c=new BspCollision(map),p=new Player(c,{x:3141,y:1297.7408447265625,z:-1081.2899780273438});p.velocity={x:0,y:-300,z:-200};let surfTicks=0;
  for(let j=0;j<64;j++){p.step({});if(p.surfing)surfTicks++;assert.ok(c.canOccupy(p.position,p.height));}
  assert.ok(surfTicks>=8);assert.equal(p.grounded,false);assert.ok(p.velocity.x < -70);assert.ok(p.velocity.z < -300);
});
test('solid starts are detected by actual clipnodes and point hull follows BSP leaf contents',()=>{
  const c=new BspCollision(map);assert.equal(c.canOccupy({x:-392,y:0,z:-3619},72),false);
  const h=c.trace({x:-392,y:0,z:-3619},{x:0,y:0,z:0},72);assert.equal(h.startSolid,true);assert.equal(h.allSolid,true);
  near(hullContents(map,map.models[0],0,[-392,3619,79]),-1);
});
test('all ten teleport brush triggers dispatch to actual targets at feet origin + 1',()=>{
  for(const model of [21,22,23,24,25,26,27,30,32,37]){const runtime=new BspRuntime(map),instance=runtime.collision.instances.find(i=>i.index===model),center=toGame(instance.model.mins.map((v,k)=>(v+instance.model.maxs[k])/2));center.y-=36;const p=new Player(runtime.collision,center);let yaw=null;runtime.onTeleport=a=>yaw=a;runtime.afterStep(p);
    const destination=map.entities.find(e=>e.targetname===instance.entity.target&&e.origin),expected=toGame(vec(destination.origin));expected.y+=1;
    assert.deepEqual(p.position,expected);assert.equal(yaw,-Math.PI/2);assert.deepEqual(p.velocity,{x:0,y:0,z:0});
  }
});
test('water samples use BSP content boundaries and preserve swimming movement',()=>{
  const c=new BspCollision(map);assert.equal(c.pointContents(toGame([-2571,2497,-1061])),-3);
  const p=new Player(c,toGame([-1220,-1170,-1750]));p.sampleWater();assert.ok(p.waterLevel>=2);p.step({jump:true});assert.ok(p.velocity.y>0);
});
test('ladder volumes provide a usable climb direction from their exposed side',()=>{
  const c=new BspCollision(map),p=toGame([-908,-820,-500]);p.y-=36;const ladder=c.ladderAt(p,72);assert.ok(ladder);assert.equal(ladder.normal.x,1);
  const player=new Player(c,p);player.step({forward:1,yaw:Math.PI/2});assert.equal(player.onLadder,true);assert.ok(player.velocity.y>0);
});
test('push volumes supply map-authored force, not a hardcoded launch speed',()=>{
  const runtime=new BspRuntime(map),p=new Player(runtime.collision,toGame([-2986,3691,-386]));runtime.beforeStep(p,DT);near(p.baseVelocity.y,4000);p.step({});assert.ok(p.velocity.y>0);
});
test('the thin invisible push wall retains its 1200-unit boost after the player flies through it',()=>{
  const runtime=new BspRuntime(map),wall=runtime.collision.instances.find(i=>i.index===17),p=new Player(runtime.collision,{x:-489.5,y:-700.44,z:970});p.velocity.z=250;
  let touched=false,exited=false;
  for(let tick=0;tick<45;tick++){
    const inside=runtime.collision.overlaps(wall,p.position,p.height);runtime.beforeStep(p,DT);
    if(inside){touched=true;near(p.velocity.z,250);near(p.baseVelocity.z,1200);}
    if(touched&&!inside){exited=true;near(p.velocity.z,250+1200*(1+DT*.5));near(p.baseVelocity.z,0);}
    p.step({});runtime.afterStep(p);assert.ok(runtime.collision.canOccupy(p.position,p.height));
  }
  assert.ok(exited);assert.match(runtime.lastEvent,/Boost \*17/);near(p.velocity.z,1454.6875);
});
test('vertical push is integrated once and does not become an extra launch impulse on exit',()=>{
  const runtime=new BspRuntime(map),p=new Player(runtime.collision,toGame([-2986,3691,-386]));runtime.beforeStep(p,DT);near(p.baseVelocity.y,4000);p.step({});near(p.baseVelocity.y,0);
  const velocity={...p.velocity};p.position={x:-489.5,y:-700,z:950};runtime.beforeStep(p,DT);near(p.velocity.y,velocity.y);near(p.velocity.z,velocity.z);
  p.reset(runtime.spawn().position);runtime.beforeStep(p,DT);assert.deepEqual(p.velocity,{x:0,y:0,z:0});
});
test('push_once transfers an impulse once; start-off fields activate only after use',()=>{
  const variant=flags=>({...map,entities:map.entities.map(e=>e.model==='*17'?{...e,spawnflags:String(flags)}:e)});
  for(const flags of [1,2]){
    const runtime=new BspRuntime(variant(flags)),wall=runtime.collision.instances.find(i=>i.index===17),p=new Player(runtime.collision,{x:-489.5,y:-700.44,z:1011.5});
    runtime.beforeStep(p,DT);
    if(flags===1){near(p.velocity.z,1200);assert.equal(wall.enabled,false);runtime.beforeStep(p,DT);near(p.velocity.z,1200);near(p.baseVelocity.z,0);}
    else{near(p.baseVelocity.z,0);runtime.activate(wall);runtime.beforeStep(p,DT);near(p.baseVelocity.z,1200);runtime.activate(wall);assert.equal(wall.enabled,false);}
  }
});
test('noclip and respawn discard a pending boost instead of applying it later',()=>{
  const runtime=new BspRuntime(map),p=new Player(runtime.collision,{x:-489.5,y:-700.44,z:1011.5});runtime.beforeStep(p,DT);near(p.baseVelocity.z,1200);
  runtime.noclip=true;runtime.beforeStep(p,DT);assert.deepEqual(p.baseVelocity,{x:0,y:0,z:0});runtime.noclip=false;p.reset(runtime.spawn().position);runtime.beforeStep(p,DT);assert.deepEqual(p.velocity,{x:0,y:0,z:0});
});
test('linked button/rotating door cycle activates once and transforms rendering and collision together',()=>{
  const runtime=new BspRuntime(map),button=runtime.collision.instances.find(i=>i.index===20),door=runtime.doors.find(d=>d.instance.index===19),p=new Player(runtime.collision,runtime.spawn().position);
  runtime.activate(button);assert.equal(door.goal,1);runtime.beforeStep(p,.5);assert.ok(door.fraction>0);assert.notDeepEqual(door.instance.angles,door.instance.initialAngles);
  const point=transform([0,0,0],door.instance);assert.deepEqual(point,door.instance.origin);
});
test('four lights sharing one switch style toggle together exactly once',()=>{
  const runtime=new BspRuntime(map);assert.equal(runtime.lightStyles.get(41),1);runtime.fire('secret');assert.equal(runtime.lightStyles.get(41),0);runtime.fire('secret');assert.equal(runtime.lightStyles.get(41),1);
});
test('GoldSrc sky faces map to cubemap axes including rotated poles',()=>{
  const image={width:2,height:2,data:new Uint8Array([1,0,0,255,2,0,0,255,3,0,0,255,4,0,0,255])};
  const ids=face=>Array.from(skyFacePixels(image,face)).filter((_,i)=>i%4===0);
  for(const face of [0,1,4,5])assert.deepEqual(ids(face),[2,1,4,3]);assert.deepEqual(ids(2),[1,3,2,4]);assert.deepEqual(ids(3),[4,2,3,1]);
});
test('lightmap packing retains a white fallback texel and padded samples fit atlas',()=>{
  const {size,placements}=packLightmaps(map.faces);assert.ok(size<=2048);assert.ok(placements.size>3000);
  for(const f of map.faces){const p=placements.get(f.index);if(!p)continue;assert.ok(p.y>=3);assert.ok(p.x+f.light.width<size);assert.ok(p.y+f.light.height<size);}
});
test('T-junction vertices never reverse a visible BSP face, including all 4541 actual polygons',()=>{
  let collinearStarts=0;
  for(const f of map.faces){
    const n=map.planes[f.plane].normal.map(v=>f.side?-v:v),order=faceOrder(f,n),a=f.vertices[order[0]];
    const area=(b,c)=>{const u=b.map((v,k)=>v-a[k]),v=c.map((v,k)=>v-a[k]);return (u[1]*v[2]-u[2]*v[1])*n[0]+(u[2]*v[0]-u[0]*v[2])*n[1]+(u[0]*v[1]-u[1]*v[0])*n[2];};
    if(Math.abs(area(f.vertices[order[1]],f.vertices[order[2]]))<.001)collinearStarts++;
    let total=0;for(let i=1;i<order.length-1;i++)total+=area(f.vertices[order[i]],f.vertices[order[i+1]]);
    assert.ok(total>0,`face ${f.index} faces into its solid brush`);
  }
  assert.ok(collinearStarts>500,'real map must exercise collinear T-junctions');
});
test('render batches include all drawable surfaces, exclude triggers, and contain finite UV/lightmap data',()=>{
  const m=parseBsp(bytes);resolveTextures(m,[wad]);const c=new BspCollision(m),r=new BspRenderer(m,c,{capabilities:{maxTextureSize:4096,getMaxAnisotropy:()=>8}});
  assert.ok(r.batches.length>40&&r.batches.length<100);assert.ok(r.batches.some(b=>b.sky));assert.ok(r.animations.some(a=>a.water));
  for(const index of [16,19]){
    const cage=r.batches.filter(b=>b.instance.index===index);assert.ok(cage.length);
    for(const {mesh} of cage){assert.equal(mesh.material.side,THREE.FrontSide);assert.equal(mesh.material.transparent,false);assert.equal(mesh.material.depthWrite,true);assert.equal(mesh.material.uniforms.solidAlpha.value,1);}
  }
  for(const b of r.batches){assert.ok(!b.instance.entity.classname.startsWith('trigger_'));for(const a of Object.values(b.mesh.geometry.attributes))assert.ok(Array.from(a.array).every(Number.isFinite));}
  const camera=new THREE.PerspectiveCamera(100,16/9,1,22000);camera.position.set(-392.9,58,-3618.81);camera.rotation.y=-Math.PI/2;camera.updateMatrixWorld();r.update(camera,1);const visible=r.stats.visibleFaces;r.pvsEnabled=false;r.update(camera,1);assert.ok(r.stats.visibleFaces>visible);
  r.overrides=new Map([[41,1]]);r.customPatterns=new Map([[41,'az']]);r.update(camera,.1);near(r.styles[41],25/12);r.overrides.set(41,0);r.update(camera,.1);near(r.styles[41],0);
  r.fullbright=true;r.update(camera,2);assert.equal(r.animations[0].material.uniforms.unlit.value,1);r.dispose();
});

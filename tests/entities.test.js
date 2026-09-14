import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseBsp,toGame} from '../src/bsp/format.js';
import {BspRuntime} from '../src/bsp/runtime.js';
import {Player,DT} from '../src/physics.js';
import {worldSettings,buttonSound,doorSound,breakSound} from '../src/bsp/entities.js';
const map=parseBsp(fs.readFileSync(new URL('../surf_ski_2.bsp',import.meta.url)));
const variant=changes=>({...map,entities:map.entities.map(e=>changes[e.model]?{...e,...changes[e.model]}:e)});
const instance=(r,n)=>r.collision.instances.find(i=>i.index===n);
function fixture(m=map){const r=new BspRuntime(m),p=new Player(r.collision,r.spawn().position);return {r,p};}
function ticks(r,p,count){for(let n=0;n<count;n++){r.beforeStep(p,DT);p.step({});r.afterStep(p);}}
const near=(a,b)=>assert.ok(Math.abs(a-b)<.001,`${a} != ${b}`);

test('the actual cage touch-only immobile button activates once, then its door returns after wait',()=>{
  const {r,p}=fixture(),b=instance(r,20),d=r.doors.find(d=>d.instance.index===19),button=r.doors.find(d=>d.instance===b);assert.equal(button.distance,0);
  r.activate(b);assert.equal(button.fraction,1);assert.equal(d.goal,1);r.activate(b);assert.equal(d.goal,1);
  ticks(r,p,128);near(d.fraction,1);ticks(r,p,550);near(d.fraction,0);assert.deepEqual(b.origin,b.initialOrigin);
});
test('moving buttons fire targets only at arrival and ignore repeated use during movement',()=>{
  const {r,p}=fixture(variant({'*20':{spawnflags:'0',lip:'4',speed:'5'}})),b=instance(r,20),d=r.doors.find(d=>d.instance.index===19);r.activate(b);assert.equal(d.goal,0);ticks(r,p,20);r.activate(b);assert.equal(d.goal,0);ticks(r,p,800);assert.ok(r.doors.find(d=>d.instance===b).fraction>0||d.fraction>0||d.waitUntil<Infinity);
});
test('the real rotating cage floor can open underneath a player without penetrating their hull',()=>{
  const {r}=fixture(),p=new Player(r.collision,toGame([-450,3100,568.03125])),d=r.doors.find(d=>d.instance.index===19);p.step({});r.activate(d.instance);
  for(let n=0;n<60;n++){r.beforeStep(p,DT);p.step({});r.afterStep(p);assert.ok(r.collision.canOccupy(p.position,p.height));}
  assert.ok(d.fraction>.4);assert.ok(p.position.y<550);
});
test('start-open, toggle, passable and moving water use the map-authored motion',()=>{
  const {r,p}=fixture(variant({'*1':{spawnflags:'41',wait:'1'},'*3':{target:'',wait:'-1'}})),d=r.doors.find(d=>d.instance.index===1),water=r.doors.find(d=>d.instance.index===3);
  assert.equal(d.fraction,1);assert.equal(d.instance.solid,false);r.activate(d.instance);ticks(r,p,300);near(d.fraction,0);assert.equal(d.waitUntil,Infinity);
  const old=[...water.instance.origin];r.fire('water wall');r.beforeStep(p,.5);assert.notDeepEqual(water.instance.origin,old);assert.equal(water.instance.solid,false);
});
test('a moving platform carries its rider, rolls back against a wall and applies crush damage',()=>{
  const {r,p}=fixture(),d=r.doors.find(d=>d.instance.index===1);d.instance.entity={...d.instance.entity,speed:'128',dmg:'8',wait:'1',spawnflags:'0'};d.direction=[1,0,0];d.distance=10;p.position={x:0,y:0,z:0};p.grounded=true;
  r.collision.canOccupy=point=>point.x<=4;
  r.collision.trace=(start,delta)=>delta.y<0&&!delta.x?{fraction:0,brush:{instance:d.instance}}:{fraction:delta.x>0?Math.min(1,(4-start.x)/delta.x):1,startSolid:false};
  r.activate(d.instance);for(let n=0;n<5;n++){r.time+=DT;r.movePusher(d,DT,p);}
  near(p.position.x,4);near(d.instance.origin[0],4);assert.equal(d.goal,d.home);assert.equal(r.health,92);
});
test('delayed relay targets preserve on/off semantics and kill point entities too',()=>{
  const extra=[{classname:'trigger_relay',targetname:'relay',target:'secret',delay:'.2',triggerstate:'0'},{classname:'info_target',targetname:'delete_me',origin:'0 0 0'},{classname:'trigger_relay',targetname:'killer',killtarget:'delete_me'}];
  const {r,p}=fixture({...map,entities:[...map.entities,...extra]});r.fire('relay');assert.equal(r.lightStyles.get(41),1);ticks(r,p,30);assert.equal(r.lightStyles.get(41),0);r.fire('relay');ticks(r,p,30);assert.equal(r.lightStyles.get(41),0);r.fire('killer');assert.equal(r.states.get(extra[1]).killed,true);
});
test('trigger_multiple repeats after wait while occupied, no-clients blocks it, and once fires once',()=>{
  for(const classname of ['trigger_multiple','trigger_once']){const {r,p}=fixture(variant({'*17':{classname,target:'secret',wait:'.1'}}));p.position={x:-489.5,y:-700.44,z:1011.5};r.afterStep(p);assert.equal(r.lightStyles.get(41),0);r.afterStep(p);assert.equal(r.lightStyles.get(41),0);r.time=.11;r.afterStep(p);assert.equal(r.lightStyles.get(41),classname==='trigger_multiple'?1:0);}
  const {r,p}=fixture(variant({'*17':{classname:'trigger_multiple',target:'secret',spawnflags:'2'}}));p.position={x:-489.5,y:-700.44,z:1011.5};r.afterStep(p);assert.equal(r.lightStyles.get(41),1);
});
test('teleport keep-angles, keep-velocity and no-clients flags are respected',()=>{
  for(const f of [256|512,2]){const {r,p}=fixture(variant({'*21':{spawnflags:String(f)}})),i=instance(r,21);p.position=toGame(i.model.mins.map((v,k)=>(v+i.model.maxs[k])/2));p.position.y-=36;p.velocity={x:120,y:42,z:-80};const original={...p.position};let rotated=false;r.onTeleport=()=>rotated=true;r.afterStep(p);assert.equal(rotated,false);assert.deepEqual(p.velocity,{x:120,y:42,z:-80});if(f===2)assert.deepEqual(p.position,original);else assert.notDeepEqual(p.position,original);}
});
test('hurt volumes apply damage at half-second intervals and respect start-off',()=>{
  const {r,p}=fixture(variant({'*17':{classname:'trigger_hurt',dmg:'20',spawnflags:'2'}})),i=instance(r,17);p.position={x:-489.5,y:-700.44,z:1011.5};r.afterStep(p);assert.equal(r.health,100);r.activate(i);r.afterStep(p);assert.equal(r.health,90);r.afterStep(p);assert.equal(r.health,90);r.time=.5;r.afterStep(p);assert.equal(r.health,80);
});
test('breakables retain health, reject trigger-only damage, and emit one break event',()=>{
  const {r}=fixture(),glass=instance(r,33);let shards=0;r.onBreak=()=>shards++;assert.equal(glass.health,200);r.damageEntity(glass,150);assert.equal(glass.enabled,true);r.damageEntity(glass,50);assert.equal(glass.enabled,false);assert.equal(shards,1);r.damageEntity(glass,500);assert.equal(shards,1);
  const other=fixture(variant({'*33':{spawnflags:'1'}})).r,b=instance(other,33);assert.equal(other.damageEntity(b,500),false);other.activate(b);assert.equal(b.enabled,false);
});
test('unknown masters fail closed and multisource unlocks only after all inputs',()=>{
  const a={classname:'trigger_relay',targetname:'a',target:'gate'},b={classname:'trigger_relay',targetname:'b',target:'gate'},master={classname:'multisource',targetname:'gate'};
  const {r}=fixture({...variant({'*17':{master:'gate'}}),entities:[...variant({'*17':{master:'gate'}}).entities,a,b,master]}),i=instance(r,17);assert.equal(r.masterOpen(i.entity),false);r.fire('a');assert.equal(r.masterOpen(i.entity),false);r.fire('b');assert.equal(r.masterOpen(i.entity),true);
});
test('real pushable settles under gravity and horizontal movement is swept against the map',()=>{
  const {r,p}=fixture(),box=instance(r,35);ticks(r,p,100);assert.equal(box.settled,true);const old=[...box.origin];assert.equal(r.pushObject(box,{x:24,y:0,z:0},p),1);assert.ok(box.origin[0]>old[0]);assert.ok(r.pushObject(box,{x:20000,y:0,z:0},p)<1);
});
test('world asset paths are local basenames and map view range is respected',()=>{
  assert.deepEqual(worldSettings(map),{wads:['halflife.wad'],sky:'office',far:9000});
  const settings=worldSettings({entities:[{classname:'worldspawn',wad:'C:\\games\\half-life\\HALFLIFE.WAD;../../custom.wad;',skyname:'../../private',MaxRange:'NaN'}]});assert.deepEqual(settings.wads,['halflife.wad','custom.wad']);assert.equal(settings.sky,'office');assert.equal(settings.far,22000);
});
test('referenced map sounds exist locally and custom switchable light patterns are retained',()=>{
  for(const e of map.entities)for(const path of [buttonSound(e.sounds),doorSound(e,true),doorSound(e,false),e.classname==='func_breakable'?breakSound(Number(e.material)):null])if(path)assert.ok(fs.existsSync(new URL('../public/assets/goldsrc/sound/'+path,import.meta.url)),path);
  const {r}=fixture({...map,entities:map.entities.map(e=>e.targetname==='secret'?{...e,pattern:'az',spawnflags:'1'}:e)});assert.equal(r.lightPatterns.get(41),'az');assert.equal(r.lightStyles.get(41),0);r.fire('secret');assert.equal(r.lightStyles.get(41),1);
});

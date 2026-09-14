import test from 'node:test';
import assert from 'node:assert/strict';
import {Player,box,canOccupy,DT} from '../src/physics.js';
import {createWorld} from './fixtures/movement-world.js';
const world=createWorld();
const tick=(p,input={},count=1)=>{for(let i=0;i<count;i++)p.step(input);};
const floor=box(0,-50,0,2000,50,2000);
const flat=()=>new Player([floor],{x:0,y:.03,z:0});
test('partial ground duck releases 18 units up without a jump impulse',()=>{
  const p=flat();tick(p);tick(p,{duck:true});assert.equal(p.height,72);assert.equal(p.duckTransition,true);
  tick(p);assert.ok(p.position.y>17&&p.position.y<18.1);assert.ok(p.velocity.y<=0);assert.equal(p.jumps,0);
});
test('second quick duck shrinks around center, and repeated air ducks cannot fly',()=>{
  const p=flat();tick(p);tick(p,{duck:true});tick(p);const first=p.position.y;
  tick(p,{duck:true});assert.equal(p.height,36);assert.ok(p.position.y>first+17);tick(p);
  assert.ok(p.position.y<first);for(let i=0;i<10;i++){tick(p,{duck:true});tick(p);}assert.ok(p.position.y<first);assert.equal(p.jumps,0);
});
test('full held crouch and stand preserve ground height',()=>{
  const p=flat();tick(p,{duck:true},60);assert.equal(p.height,36);tick(p);assert.equal(p.height,72);assert.ok(p.position.y<.1);
});
test('early duck release cannot lift player through low ceiling',()=>{
  const p=new Player([floor,box(0,80,0,200,30,200)],{x:0,y:.03,z:0});tick(p);tick(p,{duck:true});tick(p);
  assert.ok(p.position.y<.1);assert.ok(canOccupy(p.position,p.height,p.brushes));
});
test('tower ladder climbs, holds stationary, descends and detaches with jump',()=>{
  const p=new Player(world.solids,world.ladderSpawn,{},world);tick(p,{forward:1},130);assert.equal(p.onLadder,true);assert.ok(p.position.y>100);
  const y=p.position.y;tick(p,{},30);assert.equal(p.position.y,y);
  tick(p,{forward:-1},20);assert.ok(p.position.y<y);
  tick(p,{jumpPressed:true});assert.equal(p.onLadder,false);assert.ok(p.velocity.z>260);tick(p,{},8);assert.equal(p.onLadder,false);
});
test('ladder supports sideways movement, crouch speed and walking onto roof',()=>{
  const p=new Player(world.solids,world.ladderSpawn,{},world);tick(p,{forward:1},100);const x=p.position.x;
  tick(p,{right:1},8);assert.ok(p.position.x>x);
  tick(p,{forward:1,duck:true},5);assert.ok(p.velocity.y>60&&p.velocity.y<70);
  p.reset(world.ladderSpawn);tick(p,{forward:1},380);assert.ok(p.position.y>=360);assert.ok(p.position.z<230);assert.equal(p.onLadder,false);assert.ok(canOccupy(p.position,p.height,p.brushes));
});
test('water levels distinguish feet, torso, eyes and dry space',()=>{
  const p=new Player([], {x:0,y:0,z:0},{},{waters:[{min:{x:-100,y:-200,z:-100},max:{x:100,y:100,z:100}}]});
  for(const [y,level] of [[101,0],[80,1],[50,2],[0,3]]){p.position.y=y;p.sampleWater();assert.equal(p.waterLevel,level);}
});
test('water applies drag and gentle sinking rather than freefall gravity',()=>{
  const p=new Player(world.solids,{x:3100,y:-70,z:0},{},world);p.velocity.x=400;
  tick(p,{},100);assert.ok(p.velocity.x<400);assert.ok(p.velocity.y>-80);assert.ok(p.velocity.y<0);assert.equal(p.waterLevel,3);
});
test('swimming follows look pitch; jump rises and duck lowers the hull center',()=>{
  const p=new Player(world.solids,{x:3100,y:-100,z:0},{},world);
  tick(p,{forward:1,pitch:.6},25);assert.ok(p.velocity.y>0);assert.ok(p.velocity.z<0);
  p.reset({x:3100,y:-100,z:0});tick(p,{jump:true},30);assert.ok(p.position.y>-100);assert.equal(p.jumps,0);
  p.reset({x:3100,y:-100,z:0});tick(p,{duck:true},30);assert.ok(p.position.y+p.height/2<-100+36);assert.equal(p.height,36);
});
test('pool walls contain the swimmer and bottom stops descent',()=>{
  const p=new Player(world.solids,{x:3400,y:-100,z:0},{},world);tick(p,{right:1,duck:true},180);
  assert.ok(p.position.x<=3484.1);assert.ok(p.position.y>=-200);assert.ok(canOccupy(p.position,p.height,p.brushes));
});
test('pool ladder provides a complete water-to-land exit',()=>{
  const p=new Player(world.solids,{x:2670,y:-120,z:-490},{},world);
  tick(p,{forward:1,yaw:Math.PI/2},350);assert.ok(p.position.x<2620);assert.ok(p.position.y>=40);assert.equal(p.waterLevel,0);
});
test('reset clears environment and duck state',()=>{
  const p=new Player(world.solids,{x:3100,y:-100,z:0},{},world);tick(p,{duck:true});p.reset(world.spawn);
  assert.equal(p.waterLevel,0);assert.equal(p.onLadder,false);assert.equal(p.duckTransition,false);assert.equal(p.ducked,false);assert.equal(p.height,72);
});
test('entire new course connects bhop, tunnel, double-duck, water, ladder, surf and finish',()=>{
  const p=new Player(world.solids,world.courseSpawn,{},world);
  let stage=0,duckPhase=0,finished=false;const visited=new Set();
  for(let i=0;i<6000;i++){
    const z=p.position.z;let input={forward:1};
    if(stage===0){if(z<2828&&z>2804&&p.grounded)input.jumpPressed=true;if(z<2740)stage=1;}
    else if(stage===1){if(z<2608&&z>2584&&p.grounded)input.jumpPressed=true;if(z<2530)stage=2;}
    else if(stage===2){if(z<2408&&z>2384&&p.grounded)input.jumpPressed=true;if(z<2320)stage=3;}
    else if(stage===3){input.duck=true;if(z<1850){visited.add('tunnel');stage=4;}}
    else if(stage===4){if(z<1795){input.duck=duckPhase===0||duckPhase>=2;duckPhase++;}if(z<1690){visited.add('double-duck');stage=5;}}
    else if(stage===5){input.jump=z>1040;if(z<1040)stage=6;}
    else if(stage===6){if(z<510)stage=7;}
    else if(stage===7){if(p.position.x<65&&z>0)input.right=1;if(z<-145)stage=8;}
    else input={right:-1,yaw:z < -1400 && z > -2400 && p.position.x > -80 ? .4 : 0};
    p.step(input);
    assert.ok(p.position.y>world.killY,'The test route must not fall out of the map');
    assert.ok(canOccupy(p.position,p.height,p.brushes),'The route must never penetrate a solid');
    if(p.waterLevel>=2)visited.add('water');if(p.onLadder)visited.add('ladder');if(p.surfing)visited.add('surf');
    if(p.position.z<world.portal.max.z&&p.position.z>world.portal.min.z&&p.position.x>world.portal.min.x&&p.position.x<world.portal.max.x&&p.position.y>world.portal.min.y&&p.position.y<world.portal.max.y){finished=true;break;}
  }
  assert.ok(finished);assert.deepEqual([...visited].sort(),['double-duck','ladder','surf','tunnel','water']);
  p.reset(world.courseSpawn);assert.deepEqual(p.position,world.courseSpawn);assert.equal(p.jumps,0);
});

// ReGameDLL_CS b0889847: independently calculated values, y is vertical here.
import test from 'node:test';
import assert from 'node:assert/strict';
import {Player,box,ramp,trace,clip,DT,defaults,profiles,canOccupy} from '../src/physics.js';
import {runCommand} from '../src/commands.js';
const near=(a,b,tolerance=1e-7)=>assert.ok(Math.abs(a-b)<tolerance,`${a} != ${b}`);
const floor=()=>box(0,-100,0,20000,100,20000);
const player=settings=>new Player([floor()],{x:0,y:.04,z:0},settings);
const tick=(p,input={},n=1)=>{for(let i=0;i<n;i++)p.step(input);};

test('classic defaults enable limiter and stamina, with manual unbuffered jumping',()=>{
  assert.equal(defaults.enableBunnyhopping,false);assert.equal(defaults.jumpPenalty,true);
  assert.equal(defaults.autoBhop,false);assert.equal(defaults.jumpBufferMs,0);assert.equal(defaults.airAcceleration,10);
});
test('mega bunny limiter uses full velocity including the first half gravity',()=>{
  const p=player();p.velocity.x=600;p.step({jumpPressed:true});
  near(p.velocity.x,600*240/Math.hypot(600,3.125));
  near(p.velocity.y,Math.sqrt(72000)-6.25);
  near(p.position.y,1/32+(Math.sqrt(72000)-3.125)/128);
});
test('limiter threshold is strict, and includes vertical speed at 300 horizontal',()=>{
  const below=player();below.velocity.x=299;below.step({jumpPressed:true});near(below.velocity.x,299);
  const over=player();over.velocity.x=300;over.step({jumpPressed:true});assert.ok(over.velocity.x<240);
  const exact=player({gravity:0});exact.velocity.x=300;exact.step({jumpPressed:true});near(exact.velocity.x,300);
});
test('limiter threshold follows current maxspeed rather than a hardcoded 250',()=>{
  const p=player({speed:200});p.velocity.x=500;p.step({jumpPressed:true});near(p.velocity.x,500*192/Math.hypot(500,3.125));
});
test('enablebunnyhopping disables the cap but does not disable stamina or enable auto jump',()=>{
  const p=player({enableBunnyhopping:true});p.velocity.x=600;p.stamina=1000;p.step({jump:true});
  near(p.velocity.x,600);near(p.velocity.y,Math.sqrt(72000)*(1-992.1875*.00019)-6.25);
  tick(p,{jump:true},200);assert.equal(p.jumps,1);
});
test('fuser2 reduces jump impulse, resets after jump, decays in milliseconds and clears on restart',()=>{
  const p=player();p.stamina=1000;p.step({jumpPressed:true});
  near(p.velocity.y,Math.sqrt(72000)*.811484375-6.25);near(p.stamina,1315.789429);
  tick(p,{},10);near(p.stamina,1237.664429);tick(p,{},200);near(p.stamina,0);
  p.stamina=700;p.reset({x:0,y:.04,z:0});near(p.stamina,0);
});
test('post-jump ground slowdown happens after friction and before acceleration',()=>{
  const p=player();p.velocity.x=200;p.stamina=1000;p.step({right:1});
  near(p.velocity.x,200*(1-4/128)*.811484375+250*10/128);
});
test('stamina restoration exponent is optional; legacy applies once per command',()=>{
  const p=player({staminaRestoreRate:100});p.velocity.x=200;p.stamina=1000;p.step({});
  near(p.velocity.x,200*(1-4/128)*Math.pow(.811484375,100/128));
});
test('repeated manual hops get a lower second apex, recovery restores first jump',()=>{
  const p=player();p.step({});const apex=()=>{const y=p.position.y;p.step({jumpPressed:true});let max=p.position.y;for(let i=0;i<200&&!p.grounded;i++){p.step({});max=Math.max(max,p.position.y);}return max-y;};
  const first=apex(),second=apex();assert.ok(first>44&&first<46);assert.ok(second<first-5);
  tick(p,{},200);near(apex(),first);
});
test('airborne wheel pulse is discarded without a buffer and holding it through landing cannot jump',()=>{
  const p=new Player([floor()],{x:0,y:3.1,z:0});p.velocity.y=-100;p.step({jumpPressed:true});
  tick(p,{},10);assert.equal(p.jumps,0);assert.equal(p.grounded,true);
  p.reset({x:0,y:3.1,z:0});p.velocity.y=-100;tick(p,{jump:true},10);assert.equal(p.jumps,0);
  p.step({});p.step({jump:true});assert.equal(p.jumps,1);
});
test('auto jumping and speed limiter are independent switches',()=>{
  const p=player({autoBhop:true});p.velocity.x=600;tick(p,{jump:true},240);
  assert.ok(p.jumps>=3);assert.ok(p.velocity.x<241);
});
test('maxvelocity clamps each axis, not the length of the vector',()=>{
  const p=new Player([],{x:0,y:10000,z:0},{gravity:0});p.velocity={x:5000,y:-4000,z:3000};p.step({});
  assert.deepEqual(p.velocity,{x:2000,y:-2000,z:2000});
});
test('surface friction scales air acceleration, water drag and wall overbounce',()=>{
  const p=new Player([],{x:0,y:500,z:0},{surfaceFriction:.5});p.step({right:1});near(p.velocity.x,9.765625);
  const water={min:{x:-1000,y:-1000,z:-1000},max:{x:1000,y:1000,z:1000}};
  const swimmer=new Player([],{x:0,y:0,z:0},{surfaceFriction:.5},{waters:[water]});swimmer.velocity.x=400;swimmer.step({});near(swimmer.velocity.x,393.75);
  const wall=box(100,0,0,20,1000,1000),bouncer=new Player([wall],{x:0,y:50,z:0},{surfaceFriction:.5,gravity:0});
  bouncer.velocity.x=1000;bouncer.slide(.1);near(bouncer.velocity.x,-500);
});
test('edge friction doubles drag only when the forward hull probe loses support',()=>{
  const platform=box(0,-100,0,200,100,200),middle=new Player([platform],{x:0,y:.04,z:0}),edge=new Player([platform],{x:104,y:.04,z:0});
  for(const p of [middle,edge]){p.velocity.x=100;p.step({});}
  near(middle.velocity.x,96.875);near(edge.velocity.x,93.75);
});
test('clip velocity removes small components and honors overbounce',()=>{
  assert.deepEqual(clip({x:100,y:.09,z:.1},{x:-1,y:0,z:0}),{x:0,y:0,z:.1});
  near(clip({x:100,y:0,z:0},{x:-1,y:0,z:0},1.5).x,-50);
});
test('solid start blocks motion; escaping the solid is distinguished from allsolid',()=>{
  const solid=box(0,0,0,100,100,100),p=new Player([solid],{x:0,y:10,z:0});p.velocity.x=100;p.slide(DT);
  assert.deepEqual(p.velocity,{x:0,y:0,z:0});near(p.position.x,0);
  const trapped=trace(p.position,{x:1,y:0,z:0},72,[solid]);assert.equal(trapped.allSolid,true);
  const escape=trace(p.position,{x:200,y:0,z:0},72,[solid]);assert.equal(escape.startSolid,true);assert.equal(escape.allSolid,false);
});
test('almost parallel motion does not collide with remote brushes behind the path',()=>{
  const solid=box(0,0,500,100,100,100);
  const hit=trace({x:500,y:0,z:0},{x:-.1,y:0,z:-1e-17},72,[solid]);near(hit.fraction,1);
});
test('wall sliding preserves tangent speed and stops at a second wall without reversing',()=>{
  const walls=[box(100,-100,0,20,1000,1000),box(0,-100,100,1000,1000,20)];
  const p=new Player(walls,{x:0,y:0,z:0},{gravity:0});p.velocity={x:1000,y:30,z:500};p.slide(.1);
  near(p.velocity.x,0);near(p.velocity.z,500);near(p.velocity.y,30);
  p.slide(.1);near(p.velocity.z,0);assert.ok(p.position.x<74&&p.position.z<74);near(p.velocity.y,30);
});
test('floor-wall crease preserves its free axis and no velocity penetrates either plane',()=>{
  const p=new Player([floor(),box(100,-100,0,20,1000,1000)],{x:0,y:20,z:0},{gravity:0});
  p.velocity={x:1000,y:-1000,z:100};p.slide(.1);
  near(p.velocity.x,0);near(p.velocity.y,0);near(p.velocity.z,100);assert.ok(p.position.y>=0);near(p.position.z,10);
});
test('step path cannot climb a 19-unit lip or force the player into a low ceiling',()=>{
  for(const obstacles of [[box(0,0,-100,200,19,100)],[box(0,0,-100,200,16,100),box(0,80,-100,200,30,200)]]){
    const p=new Player([floor(),...obstacles],{x:0,y:.04,z:50});tick(p,{forward:1},100);
    assert.ok(p.position.z>=-34);assert.ok(canOccupy(p.position,p.height,p.brushes));assert.ok(p.position.y<.1);
  }
});
test('water step descent climbs a submerged 16-unit step with no jump',()=>{
  const water={min:{x:-1000,y:-1000,z:-1000},max:{x:1000,y:500,z:1000}};
  const p=new Player([floor(),box(0,0,-100,200,16,100)],{x:0,y:.04,z:50},{},{waters:[water]});tick(p,{forward:1},100);
  assert.ok(p.position.y>=16);assert.ok(p.position.z<-40);assert.equal(p.jumps,0);
});
test('ramp bevels bound the hull expansion at the end of a finite ramp',()=>{
  const r=ramp(0,0,100,100,200,10);
  assert.equal(trace({x:0,y:300,z:16.1},{x:0,y:-1000,z:0},72,[r]).fraction,1);
  assert.ok(trace({x:0,y:300,z:15.9},{x:0,y:-1000,z:0},72,[r]).fraction<1);
});
test('ReGameDLL cvars and local extensions validate booleans and restore classic rules',()=>{
  const p=player(),ctx={settings:p.settings,changed(){}};
  runCommand('sv_autobunnyhopping 1',ctx);assert.equal(p.settings.autoBhop,true);
  runCommand('sv_enablebunnyhopping 1',ctx);assert.equal(p.settings.enableBunnyhopping,true);
  runCommand('jump_penalty 0',ctx);assert.equal(p.settings.jumpPenalty,false);
  runCommand('jumpbuffer 90',ctx);assert.equal(p.settings.jumpBufferMs,90);
  for(const line of ['sv_enablebunnyhopping .5','jump_penalty .1','maxvelocity Infinity','stepsize -1'])assert.match(runCommand(line,ctx)[0],/Błąd/);
  runCommand('reset_physics',ctx);assert.deepEqual(p.settings,profiles.classic);
});

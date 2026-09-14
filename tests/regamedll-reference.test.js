// Numeric expectations derived from ReGameDLL_CS b0889847, not the implementation.
import test from 'node:test';
import assert from 'node:assert/strict';
import {Player,box,DT} from '../src/physics.js';
import {runCommand} from '../src/commands.js';
import {MovementInput} from '../src/input.js';
const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-7,`${actual} != ${expected}`);
const volume={min:{x:-1000,y:-1000,z:-1000},max:{x:1000,y:1000,z:1000}};
const swimmer=settings=>new Player([],{x:0,y:0,z:0},settings,{waters:[volume]});
test('PM_WaterMove friction acts on total velocity; overspeed prevents lateral acceleration',()=>{
  const p=swimmer({friction:4});p.velocity={x:300,y:400,z:0};p.step({forward:1});
  near(p.velocity.x,290.625);near(p.velocity.y,387.5);near(p.velocity.z,0);
});
test('PM_WaterMove uses accelerate * wishspeed * dt, after 0.8 water cap',()=>{
  const p=swimmer({acceleration:10});p.step({forward:1});near(p.velocity.z,-15.625);
  const slow=swimmer({acceleration:5});slow.step({forward:1});near(slow.velocity.z,-7.8125);
});
test('PM_Jump in water sets 100 upward without adding a second upmove acceleration',()=>{
  const p=swimmer({friction:4});p.step({jump:true});near(p.velocity.y,96.875);assert.equal(p.jumps,0);
});
test('idle water wishspeed is 60 * 0.8, independent of maxspeed when above 60',()=>{
  const p=swimmer({speed:500});p.step({});near(p.velocity.y,-3.75);
});
test('PM_CategorizePosition accepts up to 180 units/s but rejects faster rising players',()=>{
  const solid=box(0,-100,0,1000,100,1000),p=new Player([solid],{x:0,y:.5,z:0});
  p.velocity.y=180;p.groundTrace();assert.equal(p.grounded,true);
  p.velocity.y=180.01;p.groundTrace();assert.equal(p.grounded,false);
});
test('CS view offsets convert from hull-center coordinates to feet coordinates',()=>{
  const p=new Player([],{x:0,y:100,z:0});near(p.viewHeight(),53);
  p.duckTransition=true;p.duckTime=.2;near(p.viewHeight(),41.5);
  p.ducked=true;p.height=36;near(p.viewHeight(),30);
});
test('water must cover hull midpoint before an eye sample can report level 3',()=>{
  const p=new Player([],{x:0,y:0,z:0},{},{waters:[{min:{x:-100,y:-100,z:-100},max:{x:100,y:34,z:100}}]});
  p.duckTransition=true;p.duckTime=.39;p.sampleWater();assert.equal(p.waterLevel,1);
});
test('air duck reduces wish acceleration by 0.333 while preserving existing momentum',()=>{
  const p=new Player([],{x:0,y:100,z:0},{airAcceleration:10});p.velocity.z=-400;p.step({duck:true,right:1});
  near(p.velocity.x,10*250*.333*DT);near(p.velocity.z,-400);
});
test('duck in water changes hull around center instead of moving the center up',()=>{
  const p=swimmer();const center=p.position.y+36;p.updateDuck(true,DT);near(p.position.y+18,center);
  p.updateDuck(false,DT);near(p.position.y+36,center);
});
test('water command aliases change the same coefficients as ground movement',()=>{
  const p=swimmer();const ctx={settings:p.settings,input:new MovementInput(),changed(){}};
  runCommand('waterfriction 6',ctx);near(p.settings.friction,6);
  runCommand('wateraccelerate 12',ctx);near(p.settings.acceleration,12);
});
test('waterjump has a persistent exit state and clears when fully out of water',()=>{
  const water={min:{x:-500,y:-200,z:-500},max:{x:500,y:100,z:500}};
  const p=new Player([box(0,-200,-60,300,310,100)],{x:0,y:60,z:10},{},{waters:[water]});
  p.step({forward:1});assert.ok(p.waterJumpTime>1.9);near(p.velocity.y,225);near(p.velocity.z,-50);
  for(let i=0;i<150;i++)p.step({forward:1});assert.equal(p.waterJumpTime,0);assert.ok(p.position.y>=110);assert.ok(p.position.z<-10);
});
test('waterjump rejects a tall wall, backwards velocity and fast falling entry',()=>{
  const water={min:{x:-500,y:-200,z:-500},max:{x:500,y:100,z:500}};
  for(const [height,velocity] of [[500,{x:0,y:0,z:0}],[310,{x:0,y:0,z:50}],[310,{x:0,y:-181,z:0}]]){
    const p=new Player([box(0,-200,-60,300,height,100)],{x:0,y:60,z:10},{},{waters:[water]});p.velocity=velocity;p.sampleWater();p.checkWaterJump(0);assert.equal(p.waterJumpTime,0);
  }
});

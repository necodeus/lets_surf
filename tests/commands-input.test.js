import test from 'node:test';
import assert from 'node:assert/strict';
import {MovementInput,defaultBinds} from '../src/input.js';
import {runCommand} from '../src/commands.js';
import {defaults} from '../src/physics.js';
const context=()=>({settings:{...defaults},input:new MovementInput(),changed(){},restart(){},map(){}});
test('default binds match requested space, shifts, ctrls and wheel directions',()=>{
  const input=new MovementInput();assert.equal(input.binds.Space,'+jump');assert.equal(input.binds.mwheelup,'+jump');assert.equal(input.binds.mwheeldown,'+duck');
  for(const code of ['ShiftLeft','ShiftRight','ControlLeft','ControlRight']){input.down(code);assert.equal(input.next().duck,true);input.up(code);assert.equal(input.next().duck,false);}
});
test('each scroll duck has a release, including rapid multiple notches',()=>{
  const input=new MovementInput();input.wheel('mwheeldown');input.wheel('mwheeldown');
  assert.deepEqual(Array.from({length:5},()=>input.next().duck),[true,false,true,false,false]);
});
test('scroll release does not cancel either held keyboard duck',()=>{
  const input=new MovementInput();input.down('ShiftLeft');input.down('ControlLeft');input.wheel('mwheeldown');input.next();
  assert.equal(input.next().duck,true);input.up('ShiftLeft');assert.equal(input.next().duck,true);input.up('ControlLeft');assert.equal(input.next().duck,false);
});
test('scroll jump is a pulse, not a held auto jump, and quick keyboard press survives one tick',()=>{
  const input=new MovementInput();input.wheel('mwheelup');let sample=input.next();assert.equal(sample.jumpPressed,true);assert.equal(sample.jump,false);assert.equal(input.next().jumpPressed,false);
  input.down('Space');input.up('Space');assert.equal(input.next().jumpPressed,true);
});
test('clear input removes held keys and queued pulses',()=>{const input=new MovementInput();input.down('ControlLeft');input.wheel('mwheeldown');input.wheel('mwheelup');input.clear();assert.equal(input.next().duck,false);assert.equal(input.next().jumpPressed,false);});
test('cvars accept plain and sv_ names and change actual physics settings',()=>{
  const ctx=context();for(const [name,key,value] of [['friction','friction',0],['sv_accelerate','acceleration',15],['airaccelerate','airAcceleration',500],['sv_gravity','gravity',400]]){
    runCommand(`${name} ${value}`,ctx);assert.equal(ctx.settings[key],value);assert.ok(runCommand(name,ctx)[0].includes(String(value)));
  }
});
test('invalid, infinite and unsupported console input never changes settings',()=>{
  const ctx=context();for(const line of ['gravity NaN','gravity Infinity','friction -1','accelerate 20 30','autobhop .5','maxspeed 0','gravity 1; alert(1)','constructor 1','<script>alert(1)</script>'])runCommand(line,ctx);
  assert.deepEqual(ctx.settings,defaults);
});
test('quoted binds, readback, unbind and reset work',()=>{
  const ctx=context();runCommand('bind mwheeldown "+jump"',ctx);assert.equal(ctx.input.binds.mwheeldown,'+jump');
  assert.ok(runCommand('bind mwheeldown',ctx)[0].includes('+jump'));runCommand('bind shift "+duck"',ctx);assert.equal(ctx.input.binds.ShiftRight,'+duck');
  runCommand('unbind ctrl',ctx);assert.equal(ctx.input.binds.ControlLeft,'none');assert.equal(ctx.input.binds.ControlRight,'none');
  runCommand('gravity 400',ctx);runCommand('reset_physics',ctx);assert.deepEqual(ctx.settings,defaults);
});
test('map and restart commands dispatch only supported destinations',()=>{
  const ctx=context();let selected=null,restarts=0;ctx.map=x=>selected=x;ctx.restart=()=>restarts++;
  for(const name of ['course','surf','practice','ladder','water','unknown']){runCommand('map '+name,ctx);assert.equal(selected,null);}
  runCommand('map surf_ski_2',ctx);assert.equal(selected,'surf_ski_2');runCommand('map bsp',ctx);assert.equal(selected,'bsp');runCommand('restart',ctx);assert.equal(restarts,1);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {FrameLimiter,validFpsMax} from '../src/render-timing.js';
import {runCommand,commandNames} from '../src/commands.js';
import {defaults} from '../src/physics.js';
const count=(hz,limit)=>{const limiter=new FrameLimiter();let frames=0;for(let i=0;i<hz*10;i++)if(limiter.shouldRender(i*1000/hz,limit))frames++;return frames;};
test('100 and 300 FPS caps pace actual draws on a faster render clock',()=>{assert.equal(count(600,100),1000);assert.equal(count(600,300),3000);});
test('non-divisor cap keeps its average without drifting down to half refresh',()=>{assert.equal(count(144,100),1000);});
test('cap cannot create frames beyond the supplied display refresh, zero is unlimited',()=>{assert.equal(count(60,300),600);assert.equal(count(144,0),1440);});
test('cap changes and long stalls do not cause bursts of catch-up frames',()=>{const l=new FrameLimiter();assert.equal(l.shouldRender(0,100),true);assert.equal(l.shouldRender(1,100),false);assert.equal(l.shouldRender(2,300),true);assert.equal(l.shouldRender(2.1,300),false);assert.equal(l.shouldRender(1000,300),true);assert.equal(l.shouldRender(1000.1,300),false);l.reset();assert.equal(l.shouldRender(1000.1,300),true);});
test('fps_max reads, saves 100/300/0 and leaves movement settings untouched',()=>{
  let saved=0;const ctx={renderSettings:{fpsMax:0},renderChanged(){saved++;},settings:{...defaults},changed(){}};
  assert.ok(commandNames.includes('fps_max'));
  for(const value of [100,300,0]){assert.match(runCommand(`fps_max ${value}`,ctx)[0],new RegExp(`fps_max = ${value}`));assert.equal(ctx.renderSettings.fpsMax,value);assert.match(runCommand('fps_max',ctx)[0],new RegExp(`= ${value}`));}
  assert.equal(saved,3);assert.deepEqual(ctx.settings,defaults);
  runCommand('fps_max 300',ctx);runCommand('reset_physics',ctx);assert.equal(ctx.renderSettings.fpsMax,300);
});
test('invalid caps are rejected without persisting',()=>{
  const ctx={renderSettings:{fpsMax:100},renderChanged(){assert.fail('Invalid cap saved');}};
  for(const line of ['fps_max -1','fps_max NaN','fps_max Infinity','fps_max .5','fps_max 1001','fps_max 100 300','fps_max ""'])assert.match(runCommand(line,ctx)[0],/Błąd/);
  assert.equal(ctx.renderSettings.fpsMax,100);for(const value of [undefined,null,'100',Infinity,-1])assert.equal(validFpsMax(value),false);
});

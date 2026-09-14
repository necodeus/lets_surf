import * as THREE from 'three';
import './style.css';
import { MovementInput } from './input.js';
import { setupConsole } from './console.js';
import { loadPreferences, savePreferences, viewCvars, gameDefaults, verticalFov } from './preferences.js';
import { Player, DT } from './physics.js';
import { FrameLimiter } from './render-timing.js';
import { parseBsp, parseWad, resolveTextures, toGame } from './bsp/format.js';
import { BspRuntime } from './bsp/runtime.js';
import { BspRenderer } from './bsp/renderer.js';
import {worldSettings} from './bsp/entities.js';
import {EntityAudio} from './bsp/audio.js';
import {MapEffects} from './bsp/effects.js';
const $=id=>document.getElementById(id);
let bspRuntime=null,bspRenderer=null;const bspName='surf_ski_2';
const player=new Player([],{x:0,y:0,z:0});
const canvas=$('game');
let renderer;
try{renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});}catch(error){$('game-status').textContent='WebGL niedostępny — otwórz w Chrome lub Firefox';throw error;}
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(innerWidth,innerHeight);
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;
const scene=new THREE.Scene();scene.background=new THREE.Color(0x152a35);scene.fog=new THREE.FogExp2(0x152a35,0.00013);
const entityAudio=new EntityAudio(),effects=new MapEffects(scene);
const camera=new THREE.PerspectiveCamera(100,innerWidth/innerHeight,1,22000);camera.rotation.order='YXZ';
let dragMode=true,dragging=false,lastMouse=null,sessionReady=false;
let yaw=0,pitch=0,locked=false,elapsed=0,running=false,accumulator=0,last=performance.now(),sensitivity=1,toastUntil=0;
const settings=loadPreferences(),movement=new MovementInput(settings.binds);
Object.assign(player.settings,settings.physics);
const renderSettings={fpsMax:settings.fpsMax};
const viewSettings={sensitivity:settings.sensitivity,fov:settings.fov};
const format=t=>`${String(Math.floor(t/60)).padStart(2,'0')}:${(t%60).toFixed(3).padStart(6,'0')}`;
function toast(message){$('toast').textContent=message;$('toast').classList.add('visible');toastUntil=performance.now()+3500;}
function persist(){
  settings.physics={...player.settings};settings.binds={...movement.binds};settings.fpsMax=renderSettings.fpsMax;
  Object.assign(settings,viewSettings);savePreferences(settings);
}
function applyView(){sensitivity=viewSettings.sensitivity;camera.fov=verticalFov(viewSettings.fov,camera.aspect);camera.updateProjectionMatrix();}
applyView();
function viewCommand(command,args){
  const spec=viewCvars[command];if(!args.length)return [`${command} = ${viewSettings[command]}`];
  const value=Number(args[0]);if(args.length!==1||!args[0].trim()||!Number.isFinite(value)||value<spec.min||value>spec.max)return [`${command}: podaj liczbę ${spec.min}–${spec.max}.`];
  viewSettings[command]=value;applyView();persist();return [`${command} = ${value}`];
}
function clearInput(){movement.clear();player.jumpBuffer=0;player.jumpHeld=false;}
function reset(){
  if(!bspRuntime)return;
  const spawn=bspRuntime.spawn();player.reset(spawn.position);bspRuntime.health=100;yaw=spawn.yaw;pitch=spawn.pitch;elapsed=0;running=false;accumulator=0;clearInput();
}
function bspCommand(command,args){
  if(!bspRuntime)return ['Mapa BSP jeszcze nie jest gotowa.'];
  if(command==='setpos'){
    if(args.length!==3||args.some(x=>!Number.isFinite(Number(x))||Math.abs(Number(x))>100000))return ['setpos x y z — współrzędne mapy GoldSrc.'];
    player.position=toGame(args.map(Number));player.position.y-=player.height/2;player.velocity={x:0,y:0,z:0};player.baseVelocity={x:0,y:0,z:0};return ['Pozycja ustawiona (origin GoldSrc).'];
  }
  if(command==='setang'){
    if(args.length!==2||args.some(x=>!Number.isFinite(Number(x))))return ['setang pitch yaw — stopnie GoldSrc.'];pitch=-Number(args[0])*Math.PI/180;yaw=(Number(args[1])-90)*Math.PI/180;return ['Kierunek ustawiony.'];
  }
  if(command==='bsp_info')return [bspName+': '+JSON.stringify(bspRenderer.stats),`Tekstury: ${bspRuntime.map.textures.length}; modele: ${bspRuntime.map.models.length}; clipnodes: ${bspRuntime.map.clipnodes.length}`,`Ostatnie zdarzenie: ${bspRuntime.lastEvent||'—'}`];
  if(command==='spawn_next'){bspRuntime.spawnIndex++;reset();return [`Spawn ${bspRuntime.spawnIndex+1}/${bspRuntime.spawns.length}`];}
  const value=args.length?Number(args[0]):null;
  if(args.length>1||(value!==null&&value!==0&&value!==1))return [`${command}: podaj 0 lub 1.`];
  if(command==='noclip'){bspRuntime.noclip=value===null?!bspRuntime.noclip:!!value;settings.bsp.noclip=bspRuntime.noclip;persist();player.velocity={x:0,y:0,z:0};return [`noclip = ${Number(bspRuntime.noclip)}`];}
  const property=command==='r_fullbright'?'fullbright':'pvsEnabled';
  if(value!==null){bspRenderer[property]=command==='r_novis'?!value:!!value;settings.bsp.fullbright=bspRenderer.fullbright;settings.bsp.noVis=!bspRenderer.pvsEnabled;persist();}
  return [`${command} = ${Number(command==='r_novis'?!bspRenderer.pvsEnabled:bspRenderer.fullbright)}`];
}

function pauseGame(){locked=false;dragging=false;lastMouse=null;clearInput();accumulator=0;entityAudio.pause();}
function resumeGame(){
  if(!sessionReady||!$('console').hidden||document.hidden||!document.hasFocus())return;
  locked=true;dragMode=document.pointerLockElement!==canvas;clearInput();accumulator=0;last=performance.now();
  if(entityAudio.context)entityAudio.resume();
  $('game-status').textContent='';
}
async function captureMouse(){
  entityAudio.resume();
  if(!sessionReady||!$('console').hidden||document.pointerLockElement===canvas)return;
  resumeGame();try{await canvas.requestPointerLock();}catch{dragMode=true;toast('Rozglądanie: przytrzymaj LPM i przeciągnij');}
}
document.addEventListener('pointerlockchange',()=>{dragMode=document.pointerLockElement!==canvas;dragging=false;if($('console').hidden)resumeGame();});
document.addEventListener('pointerlockerror',()=>{dragMode=true;toast('Rozglądanie: przytrzymaj LPM i przeciągnij');});
canvas.addEventListener('mousedown',e=>{if(e.button!==0)return;resumeGame();if(dragMode){dragging=true;lastMouse={x:e.clientX,y:e.clientY};}captureMouse();});
document.addEventListener('mouseup',()=>{dragging=false;lastMouse=null;});
window.addEventListener('blur',()=>{pauseGame();if(document.pointerLockElement)document.exitPointerLock();});
window.addEventListener('focus',resumeGame);
document.addEventListener('visibilitychange',()=>{if(document.hidden){pauseGame();if(document.pointerLockElement)document.exitPointerLock();}else resumeGame();});
document.addEventListener('mousemove',event=>{if(!locked||(dragMode&&!dragging))return;const dx=dragMode&&lastMouse?event.clientX-lastMouse.x:event.movementX;const dy=dragMode&&lastMouse?event.clientY-lastMouse.y:event.movementY;lastMouse={x:event.clientX,y:event.clientY};yaw-=dx*.002*sensitivity;pitch=Math.max(-Math.PI/2+.01,Math.min(Math.PI/2-.01,pitch-dy*.002*sensitivity));});
setupConsole({defaults:gameDefaults,bspCommand,viewCommand,renderSettings,renderChanged:()=>{persist();resetFpsSample();},settings:player.settings,input:movement,changed:persist,restart:reset,map:reset,pause:()=>{pauseGame();if(document.pointerLockElement)document.exitPointerLock();},resume:resumeGame});
document.addEventListener('keydown',e=>{
  if(!locked)return;if(e.code==='Escape'){clearInput();return;}
  if(['Space','Tab','ControlLeft','ControlRight','ShiftLeft','ShiftRight','KeyW','KeyA','KeyS','KeyD'].includes(e.code))e.preventDefault();
  if(!e.repeat){if(e.code==='KeyE')bspRuntime.use(player,yaw,pitch);if(e.code==='KeyN')toast(bspCommand('noclip',[])[0]);if(e.code==='KeyR'){reset();toast('Powrót na start');}}
  movement.down(e.code);
});
document.addEventListener('keyup',e=>movement.up(e.code));
canvas.addEventListener('wheel',e=>{if(!locked||e.deltaY===0)return;e.preventDefault();movement.wheel(e.deltaY<0?'mwheelup':'mwheeldown');},{passive:false});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;applyView();renderer.setSize(innerWidth,innerHeight);});
let frameCount=0;
const fpsCounter=$('fps');
let fpsFrames=0,fpsSampleStart=null;
const frameLimiter=new FrameLimiter();
function resetFpsSample(){fpsFrames=0;fpsSampleStart=null;fpsCounter.textContent='— FPS';frameLimiter.reset();}
document.addEventListener('visibilitychange',resetFpsSample);
function frame(now){
  requestAnimationFrame(frame);const delta=Math.min((now-last)/1000,.1);last=now;
  if(locked&&sessionReady){accumulator+=delta;
    while(accumulator>=DT){
      const input=movement.next(yaw,pitch);
      if(!running&&(input.forward||input.right||input.jump||input.jumpPressed))running=true;
      if(running)elapsed+=DT;
      bspRuntime.beforeStep(player,DT);
      if(bspRuntime.noclip){const speed=input.duck?250:800,f=input.forward,r=input.right;player.velocity={x:(r*Math.cos(yaw)-f*Math.sin(yaw)*Math.cos(pitch))*speed,y:(f*Math.sin(pitch)+(input.jump?1:0)-(input.duck?1:0))*speed,z:(-f*Math.cos(yaw)*Math.cos(pitch)-r*Math.sin(yaw))*speed};for(const axis of ['x','y','z'])player.position[axis]+=player.velocity[axis]*DT;player.grounded=false;}
      else player.step(input);
      bspRuntime.afterStep(player);effects.update(DT);accumulator-=DT;
      if(player.position.y<bspRuntime.map.models[0].mins[2]-256){reset();toast('Powrót na start');break;}
    }
  }
  if(sessionReady){camera.position.set(player.position.x,player.position.y+player.eye,player.position.z);camera.rotation.set(pitch,yaw,0,'YXZ');}
  if(document.hidden||!frameLimiter.shouldRender(now,renderSettings.fpsMax))return;
  if(++frameCount%3===0){
    const speed=Math.round(Math.hypot(player.velocity.x,player.velocity.z));$('speed').textContent=speed;$('max-speed').textContent=Math.round(player.topSpeed);$('pre-speed').textContent=Math.round(player.lastJumpSpeed);$('jumps').textContent=player.jumps;$('speed-bar').style.width=`${Math.min(100,speed/12)}%`;$('timer').textContent=format(elapsed);
    $('state').textContent=player.onLadder?'LADDER':player.waterLevel>=2?(player.waterLevel===3?'UNDERWATER':'SWIM'):player.duckTransition?'DUCK / TRANSITION':player.surfing?'SURF':player.grounded?(player.ducked?'DUCK / GROUND':'GROUND'):(player.ducked?'DUCK / AIR':'AIR');
    document.querySelectorAll('[data-key]').forEach(k=>k.classList.toggle('active',movement.keys.has(k.dataset.key)));$('duck-key').classList.toggle('active',player.ducked||player.duckTransition);
  }
  const submerged=sessionReady&&[-3,-4,-5].includes(bspRuntime.collision.pointContents(camera.position));
  document.body.classList.toggle('underwater',submerged);scene.background.setHex(submerged?0x176273:0x91b1c5);
  if(sessionReady){camera.updateMatrixWorld();bspRenderer.overrides=bspRuntime.lightStyles;bspRenderer.customPatterns=bspRuntime.lightPatterns;bspRenderer.update(camera,bspRuntime.time,submerged);entityAudio.listener(camera.position,yaw,pitch);entityAudio.positions(bspRuntime.collision.instances);}
  if(now>toastUntil)$('toast').classList.remove('visible');renderer.render(scene,camera);
  if(fpsSampleStart===null)fpsSampleStart=now;
  else{fpsFrames++;const sampleMs=now-fpsSampleStart;if(sampleMs>=500){fpsCounter.textContent=`${Math.round(fpsFrames*1000/sampleMs)} FPS`;fpsFrames=0;fpsSampleStart=now;}}
}
requestAnimationFrame(frame);
// Read-only diagnostic snapshot for repeatable browser smoke checks.
window.strafeLab={snapshot:()=>({position:{...player.position},velocity:{...player.velocity},grounded:player.grounded,ducked:player.ducked,surfing:player.surfing,waterLevel:player.waterLevel,onLadder:player.onLadder,locked,mode:'bsp',elapsed,bsp:bspRenderer?{...bspRenderer.stats,noclip:bspRuntime.noclip}:null,renderer:renderer.info.render.calls})};

(async()=>{try{
  const mapResponse=await fetch(new URL('../surf_ski_2.bsp',import.meta.url));
  if(!mapResponse.ok)throw new Error('Nie udało się pobrać surf_ski_2.bsp.');
  const map=parseBsp(await mapResponse.arrayBuffer()),world=worldSettings(map),wads=[];
  const wadResults=await Promise.allSettled(world.wads.map(async name=>{const response=await fetch(`/assets/goldsrc/${encodeURIComponent(name)}`);if(!response.ok)throw new Error(`Brak WAD: ${name}`);return parseWad(await response.arrayBuffer());}));
  for(const result of wadResults)if(result.status==='fulfilled')wads.push(result.value);else console.warn(result.reason);
  const missing=resolveTextures(map,wads);camera.far=world.far;camera.updateProjectionMatrix();
  const runtime=new BspRuntime(map),view=new BspRenderer(map,runtime.collision,renderer);
  let skyError='';try{await view.loadSky('/assets/goldsrc',world.sky);}catch(error){skyError=error.message;}
  bspRuntime=runtime;bspRenderer=view;scene.add(view.root);player.brushes=runtime.collision;
  runtime.onTeleport=(angle,look=0)=>{yaw=angle;pitch=look;toast(runtime.lastEvent);};runtime.onSound=event=>void entityAudio.play(event);runtime.onBreak=event=>effects.shatter(event);runtime.onDeath=()=>toast(runtime.lastEvent);
  runtime.noclip=settings.bsp.noclip;view.fullbright=settings.bsp.fullbright;view.pvsEnabled=!settings.bsp.noVis;
  sessionReady=true;reset();persist();resumeGame();
  if(missing.length||skyError)toast([missing.length?'Brak tekstur: '+missing.join(', '):'',skyError].filter(Boolean).join(' · '));
}catch(error){$('game-status').textContent='Błąd wczytywania surf_ski_2: '+error.message;console.error(error);}})();

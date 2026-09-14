import {BspCollision,rotation,transform} from './collision.js';
import {toGame,fromGame,vec,add} from './format.js';
import {flags,numeric,toggleValue,moveAngles,buttonSound,doorSound,breakSound} from './entities.js';
export class BspRuntime {
  constructor(map){
    this.map=map;this.collision=new BspCollision(map);this.spawns=map.entities.filter(e=>['info_player_start','info_player_deathmatch'].includes(e.classname));if(!this.spawns.length)throw new Error('Mapa nie ma punktów startowych gracza.');
    this.spawnIndex=0;this.time=0;this.jobs=[];this.contacts=new Set();this.pushContacts=new Set();this.teleportUntil=0;this.lightStyles=new Map();this.lightPatterns=new Map();this.noclip=false;this.onTeleport=null;this.onSound=null;this.onBreak=null;this.onDeath=null;this.lastEvent='';this.doors=[];this.health=100;
    this.states=new Map(map.entities.map(e=>[e,{entity:e,enabled:true,killed:false,cooldown:0,health:numeric(e,'health',0)}]));
    for(const e of map.entities)if(['light','light_spot','light_environment'].includes(e.classname)&&e.targetname&&Number(e.style)>=32){this.lightStyles.set(Number(e.style),flags(e)&1?0:1);if(/^[a-z]+$/.test(e.pattern||''))this.lightPatterns.set(Number(e.style),e.pattern);}
    for(const i of this.collision.instances){const e=i.entity;i.initialOrigin=[...i.origin];i.initialAngles=[...i.angles];i.cooldown=0;i.health=numeric(e,'health',0);this.states.set(e,i);
      if(['trigger_push','trigger_hurt'].includes(e.classname)&&(flags(e)&2))i.enabled=false;
      if(['func_door','func_door_rotating','func_water','func_button'].includes(e.classname)){
        const rotating=e.classname==='func_door_rotating',button=e.classname==='func_button',f=flags(e),direction=rotation(moveAngles(e))[0];
        let distance=rotating?numeric(e,'distance',90):i.model.maxs.reduce((sum,v,k)=>sum+Math.abs(direction[k])*(v-i.model.mins[k]-2),0)-(button?(numeric(e,'lip',4)||4):numeric(e,'lip',8));
        if(button&&(f&1||Math.abs(distance)<1))distance=0;
        const home=!button&&f&1?1:0,d={instance:i,rotating,button,axis:f&64?2:f&128?0:1,direction,distance:Math.max(0,distance)*(rotating&&f&2?-1:1),fraction:home,goal:home,home,waitUntil:Infinity,returnTo:home,moving:false,blockedAt:-Infinity};this.doors.push(d);this.applyDoor(d);
      }
    }
  }
  spawn(index=this.spawnIndex){this.spawnIndex=(index+this.spawns.length)%this.spawns.length;const e=this.spawns[this.spawnIndex],point=toGame(vec(e.origin));point.y-=36;return {position:point,yaw:(Number(vec(e.angles)[1]||e.angle||0)-90)*Math.PI/180,pitch:-vec(e.angles)[0]*Math.PI/180};}
  center(i){return toGame(transform(i.model.mins.map((v,k)=>(v+i.model.maxs[k])/2),i));}
  sound(i,path,loop=false,stop=false){if(path||stop)this.onSound?.({key:`${i.index}:move`,path,position:this.center(i),loop,stop});}
  schedule(delay,run){if(this.jobs.length<2048)this.jobs.push({at:this.time+Math.max(0,delay),run});}
  masterOpen(e){if(!e.master)return true;const master=this.map.entities.find(x=>x.targetname===e.master),s=this.states.get(master);return master?.classname==='multisource'&&s?.enabled&&!s.killed&&s.inputs?.size>0&&[...s.inputs.values()].every(Boolean);}
  targets(e,depth=0,visited=new Set(),type='toggle'){
    const target=e.target,kill=e.killtarget,delay=Math.max(0,numeric(e,'delay',0));const run=()=>{if(kill)this.kill(kill);if(target)this.fire(target,depth+1,0,new Set(visited),type,e);};if(delay)this.schedule(delay,run);else run();
  }
  applyDoor(d){const i=d.instance;if(d.rotating){i.angles=[...i.initialAngles];i.angles[d.axis]+=d.distance*d.fraction;}else i.origin=add(i.initialOrigin,d.direction,d.distance*d.fraction);}
  startDoor(d,goal){d.goal=goal;d.waitUntil=Infinity;d.moving=true;d.instance.alternate=d.button?goal!==d.home:d.instance.alternate;const e=d.instance.entity;
    if(d.button)this.sound(d.instance,buttonSound(e.sounds));else if(!Number(e.skin))this.sound(d.instance,doorSound(e,true),true);
    if(d.distance===0){d.fraction=goal;this.arriveDoor(d);}
  }
  arriveDoor(d){
    d.moving=false;const e=d.instance.entity,away=d.fraction!==d.home,f=flags(e),wait=d.button?(numeric(e,'wait',1)||1):numeric(e,'wait',3);
    if(!d.button&&!Number(e.skin)){this.sound(d.instance,null,false,true);this.sound(d.instance,doorSound(e,false));}
    if(away&&!(f&32)&&wait>=0)d.waitUntil=this.time+wait;
    if(!d.button||away||f&32)this.targets(e,d.activation?.depth||0,d.activation?.visited||new Set());
    if(!d.button&&e.netname&&d.fraction===0)this.fire(e.netname);
  }
  activate(i,depth=0,visited=new Set(),type='toggle',caller=null){
    if(depth>12||i.killed||visited.has(i)||!this.masterOpen(i.entity))return;visited.add(i);const e=i.entity,d=this.doors.find(d=>d.instance===i);
    if(d){if(!i.enabled||d.moving)return;const away=d.fraction!==d.home;if(type==='off'&&!away||type==='on'&&away)return;if(away&&(!(flags(e)&32)||numeric(e,'wait',3)<0))return;d.activation={depth,visited:new Set(visited)};this.startDoor(d,away?d.home:1-d.home);return;}
    if(['trigger_push','trigger_teleport','trigger_hurt','func_wall_toggle'].includes(e.classname)){i.enabled=toggleValue(i.enabled,type);return;}
    if(!i.enabled)return;
    if(e.classname==='func_breakable'||e.classname==='func_pushable'&&(flags(e)&128)){this.breakEntity(i,depth,visited);return;}
    if(e.classname==='func_wall'){i.alternate=toggleValue(!!i.alternate,type);return;}
    if(e.classname==='multisource'){i.inputs??=new Map(this.map.entities.filter(x=>x.target===e.targetname).map(x=>[x,false]));if(i.inputs.has(caller))i.inputs.set(caller,toggleValue(i.inputs.get(caller),type));if(i.inputs.size&&[...i.inputs.values()].every(Boolean))this.targets(e,depth,visited);return;}
    if(e.classname==='trigger_relay'){this.targets(e,depth,visited,['off','on','toggle'][numeric(e,'triggerstate',2)]||'toggle');if(flags(e)&1)i.killed=true;return;}
    if(e.classname==='multi_manager'){
      if(i.cooldown>this.time&&!(flags(e)&1))return;let duration=0;for(const [target,time] of Object.entries(e))if(!['classname','origin','targetname','spawnflags'].includes(target)&&Number.isFinite(Number(time))){duration=Math.max(duration,Number(time));this.schedule(Number(time),()=>this.fire(target.replace(/#\d+$/,''),depth+1,0,new Set(visited),'toggle',e));}i.cooldown=this.time+duration;return;
    }
    if(['trigger_multiple','trigger_once'].includes(e.classname)){if(i.cooldown>this.time)return;const wait=e.classname==='trigger_once'?-1:numeric(e,'wait',.2)||.2;i.cooldown=this.time+Math.max(.001,wait);if(wait<0)i.enabled=false;this.targets(e,depth,visited);return;}
    this.targets(e,depth,visited,type);
  }
  kill(name){for(const i of this.states.values())if(i.entity.targetname===name){i.enabled=false;i.killed=true;if(i.model)this.sound(i,null,false,true);}}
  fire(name,depth=0,delay=0,visited=new Set(),type='toggle',caller=null){
    if(!name||depth>12)return;if(delay>0){this.schedule(delay,()=>this.fire(name,depth,0,visited,type,caller));return;}
    const styles=new Set();for(const e of this.map.entities){if(e.targetname!==name)continue;const i=this.states.get(e);if(i.killed)continue;
      if(['light','light_spot','light_environment'].includes(e.classname)){const style=Number(e.style);if(style>=32&&!styles.has(style)){this.lightStyles.set(style,Number(toggleValue(this.lightStyles.get(style)!==0,type)));styles.add(style);}continue;}
      this.activate(i,depth+1,visited,type,caller);
    }
  }
  damagePlayer(player,amount){this.health=Math.min(100,this.health-amount);if(this.health<=0){player.reset(this.spawn().position);this.health=100;this.lastEvent='Powrót po obrażeniach środowiska';this.onDeath?.();return true;}return false;}
  damageEntity(i,amount){
    if(!i?.enabled||i.killed||!Number.isFinite(amount)||amount<=0)return false;const e=i.entity;
    if(e.classname==='func_button'){if(i.health<=0)return false;i.health-=amount;if(i.health<=0){this.activate(i);i.health=numeric(e,'health',0);}return true;}
    if(!(e.classname==='func_breakable'||e.classname==='func_pushable'&&(flags(e)&128))||flags(e)&1||Number(e.material)===7)return false;
    i.health-=amount;if(i.health<=0)this.breakEntity(i);return true;
  }
  breakEntity(i,depth=0,visited=new Set()){
    if(i.killed||Number(i.entity.material)===7)return;i.enabled=false;i.killed=true;this.lastEvent='Zniszczono przeszkodę';this.sound(i,breakSound(Number(i.entity.material)||0));this.onBreak?.({position:this.center(i),material:Number(i.entity.material)||0});this.targets(i.entity,depth,visited);
  }
  use(player,yaw,pitch){
    const start={...player.position,y:player.position.y+player.eye},dir={x:-Math.sin(yaw)*Math.cos(pitch),y:Math.sin(pitch),z:-Math.cos(yaw)*Math.cos(pitch)};
    const hit=this.collision.trace(start,{x:dir.x*128,y:dir.y*128,z:dir.z*128},0,0),i=hit.brush?.instance;
    if(!i)return false;const e=i.entity;
    if(e.classname==='func_pushable'){this.pushObject(i,{x:dir.x*24,y:0,z:dir.z*24},player);return true;}
    if(e.classname==='func_button'&&!(flags(e)&256)||['func_door','func_door_rotating'].includes(e.classname)&&flags(e)&256){
      if(!this.masterOpen(e)){this.sound(i,buttonSound(e.locked_sound));return false;}this.sound(i,buttonSound(e.unlocked_sound));this.activate(i);this.lastEvent=`Użyto: ${e.classname}`;return true;
    }return false;
  }
  movePusher(d,dt,player){
    const i=d.instance;if(!i.enabled||i.killed)return;const e=i.entity;if(this.time>=d.waitUntil)this.startDoor(d,d.home);if(!d.moving)return;
    const speed=Math.max(1,numeric(e,'speed',d.button?40:100)||(d.button?40:100)),travel=speed*dt/Math.max(.001,Math.abs(d.distance)),steps=Math.max(1,Math.ceil(speed*dt/(d.rotating?2:4)));
    for(let n=0;n<steps;n++){
      const old={origin:[...i.origin],angles:[...i.angles]},fraction=d.fraction,start={...player.position};
      const support=player.grounded&&this.collision.trace(start,{x:0,y:-3,z:0},player.height).brush?.instance===i;
      const local=transform(fromGame({...start,y:start.y+player.height/2}),old,true);d.fraction=d.goal>fraction?Math.min(d.goal,fraction+travel/steps):Math.max(d.goal,fraction-travel/steps);this.applyDoor(d);i.soundPosition=this.center(i);
      if(i.solid&&!this.noclip&&(support||!this.collision.canOccupy(start,player.height))){
        let desired=toGame(transform(local,i));desired.y-=player.height/2;
        // A trapdoor swinging down releases its rider instead of dragging the
        // upright player hull through the receding floor.
        if(support&&d.rotating&&desired.y<start.y&&this.collision.canOccupy(start,player.height))desired=start;
        const delta={x:desired.x-start.x,y:desired.y-start.y,z:desired.z-start.z};i.solid=false;
        const trace=this.collision.trace(start,delta,player.height);i.solid=true;
        if(trace.fraction===1&&!trace.startSolid&&this.collision.canOccupy(desired,player.height))player.position=desired;
        else{d.fraction=fraction;i.origin=old.origin;i.angles=old.angles;player.position=start;if(this.time-d.blockedAt>=.25){d.blockedAt=this.time;this.damagePlayer(player,numeric(e,'dmg',2));if(numeric(e,'wait',3)>=0&&!d.button)d.goal=d.goal===d.home?1-d.home:d.home;}break;}
      }
      if(d.fraction===d.goal){this.arriveDoor(d);break;}
    }
  }
  // Swept hull-0 samples protect axis-aligned pushables. The original engine's
  // MOVETYPE_PUSHSTEP solver, especially corner contacts, is still more exact.
  pushObject(i,delta,player){
    const old=[...i.origin];let fraction=1;i.solid=false;
    for(const x of [0,.5,1])for(const y of [0,.5,1])for(const z of [0,.5,1]){
      const p=[x,y,z].map((v,k)=>i.model.mins[k]+.1+v*(i.model.maxs[k]-i.model.mins[k]-.2)),start=toGame(transform(p,i)),hit=this.collision.trace(start,delta,0,0);if(hit.startSolid){fraction=0;break;}fraction=Math.min(fraction,hit.fraction);
    }
    i.solid=true;i.origin=add(old,fromGame(delta),fraction);if(player&&!this.collision.canOccupy(player.position,player.height)){i.origin=old;fraction=0;}if(fraction>0&&(delta.x||delta.z))i.settled=false;return fraction;
  }
  beforeStep(player,dt){
    this.time+=dt;this.stepDt=dt;this.preVelocity={...player.velocity};const due=this.jobs.filter(j=>j.at<=this.time).sort((a,b)=>a.at-b.at);this.jobs=this.jobs.filter(j=>j.at>this.time);for(const job of due)job.run();
    for(const d of this.doors)this.movePusher(d,dt,player);
    for(const i of this.collision.instances)if(i.enabled&&i.entity.classname==='func_pushable'){
      i.verticalVelocity??=0;const center=this.center(i),wet=[-3,-4,-5].includes(this.collision.pointContents(center));if(i.settled&&!wet)continue;i.verticalVelocity+=((wet?numeric(i.entity,'buoyancy',0)*12:0)-player.settings.gravity)*dt;i.verticalVelocity=Math.max(-400,Math.min(160,i.verticalVelocity));if(this.pushObject(i,{x:0,y:i.verticalVelocity*dt,z:0},player)<1){i.verticalVelocity=0;i.settled=true;}
    }
    this.updatePushFields(player,dt);
  }
  updatePushFields(player,dt){
    const previousBase=player.baseVelocity;player.baseVelocity={x:0,y:0,z:0};if(this.noclip){this.pushContacts.clear();return;}
    const pushes=new Set();let hasPushField=false;
    for(const i of this.collision.instances){if(!i.enabled||i.entity.classname!=='trigger_push'||!this.collision.overlaps(i,player.position,player.height))continue;
      const direction=toGame(rotation(moveAngles(i.entity))[0]),speed=Number(i.entity.speed)||100;pushes.add(i);if(!this.pushContacts.has(i))this.lastEvent=`Boost *${i.index} · ${speed} units/s`;
      if(flags(i.entity)&1){for(const axis of ['x','y','z'])player.velocity[axis]+=direction[axis]*speed;if(player.velocity.y>0)player.grounded=false;i.enabled=false;i.killed=true;}
      else{hasPushField=true;for(const axis of ['x','y','z'])player.baseVelocity[axis]+=direction[axis]*speed;}
    }
    if(!hasPushField)for(const axis of ['x','y','z'])player.velocity[axis]+=previousBase[axis]*(1+dt*.5);this.pushContacts=pushes;
  }
  afterStep(player){
    if(this.noclip)return;const contacts=new Set();
    for(const i of this.collision.instances){if(!i.enabled||i.index===0||!this.collision.touching(i,player.position,player.height))continue;contacts.add(i);const e=i.entity,f=flags(e);if(!this.masterOpen(e))continue;
      if(e.classname==='trigger_teleport'&&!(f&2)&&this.time>=this.teleportUntil){
        const target=this.map.entities.find(t=>!this.states.get(t)?.killed&&t.targetname===e.target&&t.origin);if(!target)continue;const position=toGame(vec(target.origin)),landmark=e.landmark&&this.map.entities.find(t=>t.targetname===e.landmark&&t.origin);
        if(landmark){const point=toGame(vec(landmark.origin));position.x+=player.position.x-point.x;position.y+=player.position.y-point.y;position.z+=player.position.z-point.z;}else position.y+=1;
        player.position=position;if(!(f&512)){player.velocity={x:0,y:0,z:0};player.baseVelocity={x:0,y:0,z:0};}else if(f&1024){const speed=Math.hypot(player.velocity.x,player.velocity.z),a=Number(vec(target.angles)[1]||target.angle||0)*Math.PI/180;player.velocity.x=Math.cos(a)*speed;player.velocity.z=-Math.sin(a)*speed;}
        player.grounded=false;player.waterJumpTime=0;this.teleportUntil=this.time+.2;this.lastEvent=`Teleport → ${e.target}`;if(!(f&256))this.onTeleport?.((Number(vec(target.angles)[1]||target.angle||0)-90)*Math.PI/180,-vec(target.angles)[0]*Math.PI/180);if(e.killtarget)this.kill(e.killtarget);break;
      }
      if(e.classname==='trigger_hurt'&&!(f&8)&&this.time>=i.cooldown){i.cooldown=this.time+.5;const died=this.damagePlayer(player,numeric(e,'dmg',0)*.5);if(!i.fired||!(f&1))this.targets(e);i.fired=true;if(died)break;}
      if(['trigger_once','trigger_multiple'].includes(e.classname)&&!(f&2))this.activate(i);
      if(i.solid&&(['func_door','func_door_rotating'].includes(e.classname)&&!(f&256)&&!e.targetname||e.classname==='func_button'&&f&256))this.activate(i);
      if(e.classname==='func_breakable'&&!(f&1)&&f&2){const damage=Math.hypot(this.preVelocity?.x||0,this.preVelocity?.y||0,this.preVelocity?.z||0)*.01;if(damage>=i.health&&this.damageEntity(i,damage))this.damagePlayer(player,damage/4);}
      if(e.classname==='func_pushable'&&this.preVelocity){const speed=Math.hypot(this.preVelocity.x,this.preVelocity.z),max=Math.max(1,400-Math.min(399,numeric(e,'friction',0)));if(speed>1)this.pushObject(i,{x:this.preVelocity.x*Math.min(1,max/speed)*(this.stepDt||0),y:0,z:this.preVelocity.z*Math.min(1,max/speed)*(this.stepDt||0)},player);}
    }
    if(player.grounded){const i=this.collision.trace(player.position,{x:0,y:-3,z:0},player.height).brush?.instance;if(i?.entity.classname==='func_breakable'&&flags(i.entity)&4&&!(flags(i.entity)&1)&&!i.pressurePending){i.pressurePending=true;this.schedule(numeric(i.entity,'delay',.1)||.1,()=>this.breakEntity(i));}}
    this.contacts=contacts;
  }
}

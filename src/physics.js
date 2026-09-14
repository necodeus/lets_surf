// GoldSrc-inspired movement; original implementation, units are Hammer units.
export const DT = 1 / 128;
export const defaults = { gravity: 800, speed: 250, acceleration: 10, airAcceleration: 10, friction: 4, stopSpeed: 75, jumpSpeed: Math.sqrt(2*800*45), autoBhop: false, enableBunnyhopping: false, jumpPenalty: true, jumpBufferMs: 0, staminaRestoreRate: 0, edgeFriction: 2, surfaceFriction: 1, bounce: 1, maxVelocity: 2000, stepSize: 18, ladderSpeed: 200 };
export const profiles = {
  classic: {...defaults},
  training: {...defaults, airAcceleration:100, autoBhop:true, enableBunnyhopping:true, jumpPenalty:false, jumpBufferMs:90},
};
const EPS = 1/32;
const zero = () => ({x:0,y:0,z:0});
export const dot = (a, b) => a.x*b.x + a.y*b.y + a.z*b.z;
const add = (a,b,s=1) => ({x:a.x+b.x*s,y:a.y+b.y*s,z:a.z+b.z*s});
const scale = (a,s) => ({x:a.x*s,y:a.y*s,z:a.z*s});
const cross = (a,b) => ({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});
export function brush(vertices, faces, color = 0x34464e, kind = 'solid') {
  const center = scale(vertices.reduce((a,b)=>add(a,b),{x:0,y:0,z:0}),1/vertices.length);
  const planes = faces.map(face => {
    const [a,b,c] = face.map(i=>vertices[i]);
    let n = cross(add(b,a,-1),add(c,a,-1)); n=scale(n,1/Math.hypot(n.x,n.y,n.z));
    if(dot(n,add(center,a,-1))>0) n=scale(n,-1);
    return {n,d:dot(n,a)};
  });
  // Support planes for the Minkowski sum with an axis-aligned player hull.
  // Bevels at finite brush edges keep the expanded hull from growing past them.
  const tracePlanes=[...planes],axes=[{x:1,y:0,z:0},{x:0,y:1,z:0},{x:0,y:0,z:1}];
  const support=n=>{
    const len=Math.hypot(n.x,n.y,n.z);if(len<1e-8)return;n=scale(n,1/len);
    if(tracePlanes.some(p=>dot(p.n,n)>1-1e-8))return;
    tracePlanes.push({n,d:Math.max(...vertices.map(v=>dot(v,n)))});
  };
  for(const axis of axes){support(axis);support(scale(axis,-1));}
  for(const face of faces)for(let i=0;i<face.length;i++)for(const axis of axes){
    const n=cross(add(vertices[face[(i+1)%face.length]],vertices[face[i]],-1),axis);
    support(n);support(scale(n,-1));
  }
  return {vertices,faces,planes,tracePlanes,color,kind};
}
export function box(x,y,z,w,h,d,color,kind) {
  const vertices=[];
  for(const dy of [0,h]) for(const dz of [-d/2,d/2]) for(const dx of [-w/2,w/2]) vertices.push({x:x+dx,y:y+dy,z:z+dz});
  return brush(vertices,[[0,2,3,1],[4,5,7,6],[0,1,5,4],[2,6,7,3],[0,4,6,2],[1,3,7,5]],color,kind);
}
export function ramp(x,z,length,width,ridge,drop,color) {
  // Convex triangular prism, with two surfable faces and a descending ridge.
  return brush([
    {x:x-width,y:ridge-width*1.4,z},{x:x+width,y:ridge-width*1.4,z},{x,y:ridge,z},
    {x:x-width,y:ridge-drop-width*1.4,z:z-length},{x:x+width,y:ridge-drop-width*1.4,z:z-length},{x,y:ridge-drop,z:z-length}
  ],[[0,1,2],[3,5,4],[0,3,4,1],[0,2,5,3],[1,4,5,2]],color,'surf');
}
export function trace(start, delta, height, brushes, radius=16) {
  if(brushes.trace)return brushes.trace(start,delta,height,radius);
  let result={fraction:1,normal:null,brush:null,startSolid:false,allSolid:false};
  const center={...start,y:start.y+height/2};
  for(const solid of brushes) {
    let enter=-Infinity,leave=1,normal=null,miss=false,inside=true,endInside=true;
    for(const {n,d} of solid.tracePlanes||solid.planes) {
      const dist=dot(n,center)-d-radius*(Math.abs(n.x)+Math.abs(n.z))-height/2*Math.abs(n.y);
      const travel=dot(n,delta);
      if(dist>0) inside=false;
      if(dist+travel>0)endInside=false;
      if(travel>=0 && dist>0) {miss=true;break;}
      if(Math.abs(travel)<1e-10){if(dist>0){miss=true;break;}continue;}
      if(travel<0) {const t=(dist-EPS)/-travel;if(t>enter){enter=t;normal=n;}}
      else leave=Math.min(leave,-dist/travel);
      if(enter>leave) {miss=true;break;}
    }
    if(miss) continue;
    if(inside){
      result.startSolid=true;
      if(endInside)return {fraction:0,normal:null,brush:solid,startSolid:true,allSolid:true};
      continue;
    }
    if(enter<result.fraction && enter<=leave && normal) {
      result={fraction:Math.max(0,enter),normal,brush:solid,startSolid:result.startSolid,allSolid:false};
    }
  }
  return result;
}
export function canOccupy(p,height,brushes) {
  if(brushes.canOccupy)return brushes.canOccupy(p,height);
  const center={...p,y:p.y+height/2};
  return !brushes.some(b=>(b.tracePlanes||b.planes).every(({n,d})=>dot(n,center)-d-16*(Math.abs(n.x)+Math.abs(n.z))-height/2*Math.abs(n.y)<-EPS));
}
export function clip(v,n,overbounce=1) {
  const out=add(v,n,-dot(v,n)*overbounce);
  for(const axis of ['x','y','z'])if(Math.abs(out[axis])<.1)out[axis]=0;
  return out;
}
export class Player {
  constructor(brushes,spawn,settings={},environment={}) {this.brushes=brushes;this.ladders=environment.ladders||[];this.waters=environment.waters||[];this.settings={...defaults,...settings};this.reset(spawn);}
  reset(spawn) {this.baseVelocity={x:0,y:0,z:0};this.position={...spawn};this.velocity={x:0,y:0,z:0};this.height=72;this.eye=53;this.grounded=false;this.surfing=false;this.ducked=false;this.jumpBuffer=0;this.jumps=0;this.topSpeed=0;this.lastJumpSpeed=0;this.jumpHeld=false;this.stamina=0;this.onLadder=false;this.ladderCooldown=0;this.waterLevel=0;this.water=null;this.duckTransition=false;this.duckTime=0;this.duckHeld=false;this.waterJumpTime=0;this.waterJumpDirection={x:0,y:0,z:0};}
  checkVelocity() {
    for(const axis of ['x','y','z']){
      if(!Number.isFinite(this.position[axis]))this.position[axis]=0;
      if(!Number.isFinite(this.velocity[axis]))this.velocity[axis]=0;
      this.velocity[axis]=Math.max(-this.settings.maxVelocity,Math.min(this.settings.maxVelocity,this.velocity[axis]));
    }
  }
  slide(dt) {
    // Legacy PM_FlyMove (mp_flymove_method 0): four bumps, five planes.
    let remaining=dt,totalFraction=0,original={...this.velocity};
    const primal={...this.velocity},planes=[];this.surfing=false;
    for(let bump=0;bump<4;bump++) {
      if(!Math.hypot(this.velocity.x,this.velocity.y,this.velocity.z))break;
      const hit=trace(this.position,scale(this.velocity,remaining),this.height,this.brushes);
      totalFraction+=hit.fraction;
      if(hit.allSolid){this.velocity=zero();return;}
      if(hit.fraction>0){
        this.position=add(this.position,this.velocity,remaining*hit.fraction);
        original={...this.velocity};planes.length=0;
      }
      if(hit.fraction===1)break;
      remaining*=1-hit.fraction;
      if(planes.length>=5){this.velocity=zero();break;}
      planes.push(hit.normal);
      if(hit.brush.kind==='surf' && hit.normal.y>0 && hit.normal.y<0.7)this.surfing=true;
      if(planes.length===1&&!this.onLadder&&(!this.grounded||this.settings.surfaceFriction!==1)){
        const overbounce=hit.normal.y>.7?1:1+this.settings.bounce*(1-this.settings.surfaceFriction);
        this.velocity=clip(original,hit.normal,overbounce);original={...this.velocity};
        continue;
      }
      let accepted=false;
      for(let i=0;i<planes.length;i++){
        this.velocity=clip(original,planes[i]);
        if(planes.every((n,j)=>i===j||dot(this.velocity,n)>=0)){accepted=true;break;}
      }
      if(!accepted){
        if(planes.length!==2){this.velocity=zero();break;}
        // Legacy code intentionally does not normalize this crease.
        const crease=cross(planes[0],planes[1]);this.velocity=scale(crease,dot(crease,this.velocity));
      }
      if(dot(this.velocity,primal)<=0){this.velocity=zero();break;}
    }
    if(totalFraction===0)this.velocity=zero();
  }
  walkMove(dt) {
    if(Math.hypot(this.velocity.x,this.velocity.z)<1){this.velocity=zero();return;}
    const direct=trace(this.position,scale(this.velocity,dt),this.height,this.brushes);
    if(direct.fraction===1&&!direct.allSolid){this.position=add(this.position,this.velocity,dt);return;}
    const start={...this.position},velocity={...this.velocity};
    this.slide(dt);
    const down={...this.position},downVelocity={...this.velocity};
    this.position={...start};this.velocity=velocity;
    const up=trace(start,{x:0,y:this.settings.stepSize,z:0},this.height,this.brushes);
    if(!up.startSolid&&!up.allSolid)this.position.y+=this.settings.stepSize*up.fraction;
    this.slide(dt);
    const descend=trace(this.position,{x:0,y:-this.settings.stepSize,z:0},this.height,this.brushes);
    if(descend.normal?.y>=.7){
      if(!descend.startSolid&&!descend.allSolid)this.position.y-=this.settings.stepSize*descend.fraction;
      const distance=p=>(p.x-start.x)**2+(p.z-start.z)**2;
      if(distance(this.position)>=distance(down)){this.velocity.y=downVelocity.y;return;}
    }
    this.position=down;this.velocity=downVelocity;
  }
  groundFriction(dt) {
    const speed=Math.hypot(this.velocity.x,this.velocity.y,this.velocity.z);if(speed<.1)return;
    // PM_PlayerTrace here uses the player hull centered at the feet probe.
    const probe=add(this.position,this.velocity,16/speed);probe.y=this.position.y-this.height/2;
    const edge=trace(probe,{x:0,y:-34,z:0},this.height,this.brushes).fraction===1;
    const s=this.settings,friction=s.friction*s.surfaceFriction*(edge?s.edgeFriction:1);
    this.velocity=scale(this.velocity,Math.max(0,speed-Math.max(s.stopSpeed,speed)*friction*dt)/speed);
  }
  sampleWater() {
    const p=this.position;
    if(this.brushes.pointContents){
      const wet=y=>{const c=this.brushes.pointContents({...p,y});return c<=-3&&c>=-5||c<=-9&&c>=-14;};
      this.waterLevel=wet(p.y+1)?1:0;
      if(this.waterLevel&&wet(p.y+this.height/2)){this.waterLevel=2;if(wet(p.y+this.viewHeight()))this.waterLevel=3;}
      this.water=this.waterLevel?{bsp:true}:null;return;
    }
    this.water=this.waters.find(w=>p.x>w.min.x&&p.x<w.max.x&&p.z>w.min.z&&p.z<w.max.z&&p.y+1>w.min.y&&p.y+1<w.max.y)||null;
    this.waterLevel=0;
    if(this.water){this.waterLevel=1;if(p.y+this.height/2<this.water.max.y){this.waterLevel=2;if(p.y+this.viewHeight()<this.water.max.y)this.waterLevel=3;}}
  }
  viewHeight() {
    // ReGameDLL offsets are relative to hull center: 36+17 and 18+12.
    const t=Math.min(1,this.duckTime/.4),smooth=t*t*(3-2*t);
    return this.ducked?30:this.duckTransition?53-23*smooth:53;
  }
  groundTrace() {
    const hit=trace(this.position,{x:0,y:-2,z:0},this.height,this.brushes);
    this.grounded=!!hit.normal&&hit.normal.y>=.7&&this.velocity.y<=180;
    if(this.grounded){
      this.waterJumpTime=0;
      if(this.waterLevel<2&&!hit.startSolid&&!hit.allSolid)this.position.y-=2*hit.fraction;
    }
    return hit;
  }
  updateDuck(wantsDuck,dt) {
    this.sampleWater();
    this.groundTrace();
    const onGround=this.grounded;
    if(wantsDuck&&!this.duckHeld&&!this.ducked){this.duckTransition=true;this.duckTime=0;}
    this.duckHeld=wantsDuck;
    if(wantsDuck&&this.duckTransition) {
      this.duckTime+=dt;
      // CS starts a timed ground transition with the standing collision hull.
      if(!onGround||this.duckTime>=.4) {
        if(!this.grounded)this.position.y+=18;
        this.height=36;this.ducked=true;this.duckTransition=false;
      }
    } else if(!wantsDuck&&(this.duckTransition||this.ducked)) {
      let offset=0;
      // Legacy PM_UnDuck raises the origin even if the ground duck has not
      // finished. Its 18-unit origin shift is the first half of double-duck.
      if(this.duckTransition&&onGround)offset=18;
      else if(this.ducked&&!this.grounded)offset=-18;
      const target={...this.position,y:this.position.y+offset};
      const pathClear=offset<=0||trace(this.position,{x:0,y:offset,z:0},this.height,this.brushes).fraction===1;
      if(pathClear&&canOccupy(target,72,this.brushes)) {
        this.position=target;this.height=72;this.ducked=false;this.duckTransition=false;this.duckTime=0;
        if(offset>0)this.grounded=false;
      } else if(this.duckTransition) {
        // Cancel a partial duck under a ceiling; never force the hull through it.
        this.duckTransition=false;this.duckTime=0;
      }
    }
  }
  finishStep(dt) {
    this.eye+=(this.viewHeight()-this.eye)*Math.min(1,dt*25);
    this.sampleWater();
    this.topSpeed=Math.max(this.topSpeed,Math.hypot(this.velocity.x,this.velocity.z));
  }
  checkWaterJump(yaw) {
    if(this.waterLevel!==2||this.velocity.y < -180||this.waterJumpTime>0)return;
    const forward={x:-Math.sin(yaw),y:0,z:-Math.cos(yaw)};
    if(this.velocity.x*forward.x+this.velocity.z*forward.z<0)return;
    const lower={...this.position,y:this.position.y+this.height/2+8};
    const upper={...this.position,y:this.position.y+this.height};
    const delta=scale(forward,24);
    // Both feelers are points, not player-sized hulls (PM_CheckWaterJump).
    const lip=trace(lower,delta,0,this.brushes,0);
    const head=trace(upper,delta,0,this.brushes,0);
    if(lip.normal&&Math.abs(lip.normal.y)<.1&&!lip.startSolid&&head.fraction===1&&!head.startSolid){
      this.waterJumpTime=2;this.waterJumpDirection=scale(lip.normal,-50);
      this.velocity.y=225;this.jumpBuffer=0;
    }
  }
  waterJumpMove(dt) {
    this.waterJumpTime=Math.max(0,this.waterJumpTime-dt);
    this.velocity.x=this.waterJumpDirection.x;this.velocity.z=this.waterJumpDirection.z;
    this.slide(dt);this.finishStep(dt);
    if(this.waterLevel===0||this.velocity.y<0)this.waterJumpTime=0;
  }
  environmentMove(input,dt) {
    const p=this.position,s=this.settings;
    this.sampleWater();
    this.ladderCooldown=Math.max(0,this.ladderCooldown-dt);
    const ladder=this.ladderCooldown===0 ? (this.brushes.ladderAt?.(p,this.height)||this.ladders.find(l=>p.x+16>l.min.x&&p.x-16<l.max.x&&p.z+16>l.min.z&&p.z-16<l.max.z&&p.y+this.height>l.min.y&&p.y<l.max.y)) : null;
    this.onLadder=!!ladder;
    const f=input.forward||0,r=input.right||0,yaw=input.yaw||0,pitch=input.pitch||0;
    const wish={x:r*Math.cos(yaw)-f*Math.sin(yaw)*Math.cos(pitch),y:f*Math.sin(pitch),z:-f*Math.cos(yaw)*Math.cos(pitch)-r*Math.sin(yaw)};
    if(ladder) {
      this.waterJumpTime=0;
      if(this.jumpBuffer>0||input.jump) {
        this.velocity=scale(ladder.normal,270);this.jumpBuffer=0;this.ladderCooldown=.25;this.onLadder=false;this.grounded=false;
        // Continue normal air physics after detaching, without instant reattachment.
        return false;
      }
      const into=dot(wish,ladder.normal),speed=Math.min(s.ladderSpeed,s.speed)*(this.ducked?.333:1);
      this.velocity=scale(add(wish,ladder.normal,-into),speed);
      this.velocity.y-=into*speed;
      if((this.grounded&&into>0)||(p.y>=ladder.top&&into<0))this.velocity=add(this.velocity,ladder.normal,into*speed);
      this.grounded=false;this.slide(dt);this.finishStep(dt);return true;
    }
    if(this.waterJumpTime>0){this.grounded=false;this.waterJumpMove(dt);return true;}
    if(this.waterLevel>=2) {
      this.grounded=false;
      this.checkWaterJump(yaw);
      if(this.waterJumpTime>0){this.waterJumpMove(dt);return true;}
      const jump=input.jump||this.jumpBuffer>0;
      if(jump){this.velocity.y=100;this.jumpBuffer=0;}
      const commandScale=s.speed*((this.ducked||this.duckTransition)?0.333:1)*(input.walk?.52:1);
      let wishVelocity=scale(wish,commandScale);
      // Diving on +duck is our explicit input extension; GoldSrc uses upmove.
      if(input.duck)wishVelocity.y-=commandScale;
      if(!f&&!r&&!input.duck)wishVelocity.y-=60;
      const length=Math.hypot(wishVelocity.x,wishVelocity.y,wishVelocity.z);
      const target=Math.min(s.speed,length)*.8;
      // PM_WaterMove uses the same friction/accelerate cvars as walking.
      this.velocity=scale(this.velocity,Math.max(0,1-s.friction*s.surfaceFriction*dt));
      const speed=Math.hypot(this.velocity.x,this.velocity.y,this.velocity.z);
      if(length){
        const amount=Math.max(0,Math.min(s.acceleration*s.surfaceFriction*target*dt,target-speed));
        this.velocity=add(this.velocity,scale(wishVelocity,1/length),amount);
      }
      // PM_WaterMove probes down onto a stair at the intended destination.
      this.velocity=add(this.velocity,this.baseVelocity);
      const destination=add(this.position,this.velocity,dt);
      const above={...destination,y:destination.y+s.stepSize+1};
      const down=trace(above,{x:0,y:-s.stepSize-1,z:0},this.height,this.brushes);
      if(!down.startSolid&&!down.allSolid)this.position={...destination,y:above.y-(s.stepSize+1)*down.fraction};
      else this.slide(dt);
      this.velocity=add(this.velocity,this.baseVelocity,-1);
      this.finishStep(dt);return true;
    }
    return false;
  }
  step(input,dt=DT) {
    const s=this.settings;
    this.checkVelocity();
    this.stamina=Math.max(0,this.stamina-dt*1000);
    const jump=!!(input.jump||input.jumpPressed),wasJumpHeld=this.jumpHeld;
    this.jumpHeld=jump;
    this.jumpBuffer=Math.max(0,this.jumpBuffer-dt);
    if(jump&&!wasJumpHeld&&s.jumpBufferMs>0)this.jumpBuffer=s.jumpBufferMs/1000;
    this.updateDuck(!!input.duck,dt);
    // Environment movement receives the one-command scroll impulse too.
    if(this.environmentMove({...input,jump},dt))return;
    this.groundTrace();
    // PM_AddCorrectGravity precedes PM_Jump, even while grounded.
    this.velocity.y+=this.baseVelocity.y*dt;
    this.baseVelocity.y=0;
    this.velocity.y-=s.gravity*dt/2;this.checkVelocity();
    const wantsJump=(jump&&(!wasJumpHeld||s.autoBhop))||this.jumpBuffer>0;
    if(this.grounded&&wantsJump&&!(this.duckTransition&&this.ducked)) {
      if(!s.enableBunnyhopping){
        const speed=Math.hypot(this.velocity.x,this.velocity.y,this.velocity.z),limit=1.2*s.speed;
        if(speed>limit)this.velocity=scale(this.velocity,limit*.8/speed);
      }
      const penalty=s.jumpPenalty?1-this.stamina*.00019:1;
      this.velocity.y=s.jumpSpeed*penalty;
      this.stamina=1315.789429;
      this.velocity.y-=s.gravity*dt/2;this.checkVelocity();
      this.grounded=false;this.jumpBuffer=0;this.jumps++;this.lastJumpSpeed=Math.hypot(this.velocity.x,this.velocity.z);
    }
    if(this.grounded) {
      this.velocity.y=0;this.groundFriction(dt);
      if(s.jumpPenalty&&this.stamina>0){
        let ratio=1-this.stamina*.00019;
        if(s.staminaRestoreRate>0)ratio=Math.pow(ratio,dt*s.staminaRestoreRate);
        this.velocity.x*=ratio;this.velocity.z*=ratio;
      }
    }
    const f=input.forward||0,r=input.right||0,yaw=input.yaw||0;
    let wish={x:r*Math.cos(yaw)-f*Math.sin(yaw),y:0,z:-f*Math.cos(yaw)-r*Math.sin(yaw)};
    const length=Math.hypot(wish.x,wish.z);
    if(length) {
      wish=scale(wish,1/length);
      const speed=s.speed*Math.min(1,length)*((this.ducked||this.duckTransition)?0.333:1)*(input.walk?0.52:1);
      const cap=this.grounded?speed:Math.min(speed,30);
      const accel=(this.grounded?s.acceleration:s.airAcceleration)*speed*s.surfaceFriction*dt;
      const amount=Math.max(0,Math.min(accel,cap-dot(this.velocity,wish)));
      this.velocity=add(this.velocity,wish,amount);
    }
    this.surfing=false;
    this.velocity.x+=this.baseVelocity.x;this.velocity.z+=this.baseVelocity.z;
    if(this.grounded)this.walkMove(dt);else this.slide(dt);
    this.velocity.x-=this.baseVelocity.x;this.velocity.z-=this.baseVelocity.z;
    // Categorize before the final half of gravity, including entry into water.
    this.sampleWater();this.groundTrace();this.checkVelocity();
    if(this.waterLevel<2)this.velocity.y-=s.gravity*dt/2;
    this.checkVelocity();
    if(this.grounded)this.velocity.y=0;
    this.finishStep(dt);
  }
}

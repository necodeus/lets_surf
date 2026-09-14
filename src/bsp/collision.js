import {CONTENTS,fromGame,toGame,dot,add,vec,findLeaf} from './format.js';
const EPS=1/32;
export function rotation(angles){
  const [p,y,r]=angles.map(a=>a*Math.PI/180),cp=Math.cos(p),sp=Math.sin(p),cy=Math.cos(y),sy=Math.sin(y),cr=Math.cos(r),sr=Math.sin(r);
  return [[cy*cp,sy*cp,-sp],[cy*sp*sr-sy*cr,sy*sp*sr+cy*cr,cp*sr],[cy*sp*cr+sy*sr,sy*sp*cr-cy*sr,cp*cr]];
}
export function transform(p,instance,inverse=false,direction=false){
  const basis=rotation(instance.angles||[0,0,0]),origin=instance.origin||[0,0,0];
  if(inverse){const q=direction?p:add(p,origin,-1);return basis.map(b=>dot(q,b));}
  const q=[0,1,2].map(i=>basis[0][i]*p[0]+basis[1][i]*p[1]+basis[2][i]*p[2]);return direction?q:add(q,origin);
}
export function hullContents(map,model,hull,point,node=model.headnodes[hull]){
  if(hull===0)return map.leaves[findLeaf(map,point,node)].contents;
  while(node>=0){const clip=map.clipnodes[node],plane=map.planes[clip.plane];node=clip.children[dot(point,plane.normal)-plane.dist>=0?0:1];}return node;
}
export function traceHull(map,model,hull,start,end){
  const result={fraction:1,normal:null,startSolid:false,allSolid:true};
  const nodes=hull===0?map.nodes:map.clipnodes;
  const contents=n=>hull===0?map.leaves[-n-1].contents:n;
  function walk(n,t0,t1,a,b){
    if(n<0){if(contents(n)===CONTENTS.SOLID)result.startSolid=true;else result.allSolid=false;return true;}
    const node=nodes[n],plane=map.planes[node.plane],da=dot(a,plane.normal)-plane.dist,db=dot(b,plane.normal)-plane.dist;
    if(da>=0&&db>=0)return walk(node.children[0],t0,t1,a,b);
    if(da<0&&db<0)return walk(node.children[1],t0,t1,a,b);
    const side=da<0?1:0;let fraction=Math.max(0,Math.min(1,(da+(side?EPS:-EPS))/(da-db)));
    let mid=add(a,add(b,a,-1),fraction),time=t0+(t1-t0)*fraction;
    if(!walk(node.children[side],t0,time,a,mid))return false;
    if(hullContents(map,model,hull,mid,node.children[1-side])!==CONTENTS.SOLID)return walk(node.children[1-side],time,t1,mid,b);
    if(result.allSolid)return false;
    result.normal=plane.normal.map(v=>side?-v:v);
    while(hullContents(map,model,hull,mid)===CONTENTS.SOLID&&fraction>0){fraction=Math.max(0,fraction-.05);time=t0+(t1-t0)*fraction;mid=add(a,add(b,a,-1),fraction);}
    result.fraction=time;return false;
  }
  walk(model.headnodes[hull],0,1,start,end);
  if(result.allSolid)result.fraction=0;
  return result;
}
const nonSolid=e=>e.classname?.startsWith('trigger_')||['func_illusionary','func_ladder','func_buyzone','func_bomb_target','func_hostage_rescue'].includes(e.classname);
export class BspCollision {
  constructor(map){
    this.map=map;this.instances=[{index:0,model:map.models[0],origin:[0,0,0],angles:[0,0,0],entity:{classname:'worldspawn'},solid:true,enabled:true}];
    for(const entity of map.entities){if(!/^\*\d+$/.test(entity.model||''))continue;const index=Number(entity.model.slice(1)),model=map.models[index];if(!model)throw new Error(`Encja odwołuje się do modelu ${index}, którego brak.`);
      this.instances.push({index,model,origin:vec(entity.origin),angles:entity.classname==='func_door_rotating'?vec(entity.angles):[0,0,0],entity,solid:!nonSolid(entity)&&!(['func_door','func_door_rotating','func_water'].includes(entity.classname)&&(Number(entity.spawnflags)&8||Number(entity.skin))),enabled:entity.classname!=='func_wall_toggle'||!(Number(entity.spawnflags)&1)});}
  }
  hull(height,radius){return radius===0?0:height<=36?3:1;}
  trace(start,delta,height,radius=16){
    const hull=this.hull(height,radius),a=fromGame({...start,y:start.y+height/2}),b=add(a,fromGame(delta));
    let best={fraction:1,normal:null,brush:null,startSolid:false,allSolid:false};
    for(const instance of this.instances){if(!instance.solid||!instance.enabled)continue;
      const hit=traceHull(this.map,instance.model,hull,transform(a,instance,true),transform(b,instance,true));
      const startSolid=best.startSolid||hit.startSolid;
      if(hit.allSolid||hit.fraction<best.fraction){best={...hit,normal:hit.normal?toGame(transform(hit.normal,instance,false,true)):null,brush:{kind:'surf',instance},startSolid};if(hit.allSolid)break;}else best.startSolid=startSolid;
    }return best;
  }
  canOccupy(position,height){const point=fromGame({...position,y:position.y+height/2}),hull=this.hull(height,16);return !this.instances.some(i=>i.solid&&i.enabled&&hullContents(this.map,i.model,hull,transform(point,i,true))===CONTENTS.SOLID);}
  pointContents(position){
    const point=fromGame(position);let content=hullContents(this.map,this.map.models[0],0,point);
    for(const instance of this.instances){const e=instance.entity;if(!instance.enabled||!(['func_water','func_door','func_door_rotating','func_illusionary'].includes(e.classname)&&Number(e.skin)<=-3))continue;
      const c=hullContents(this.map,instance.model,0,transform(point,instance,true));if(c!==CONTENTS.EMPTY&&c!==CONTENTS.SKY)content=Number(e.skin)||CONTENTS.WATER;
    }return content;
  }
  overlaps(instance,position,height=72){
    const p=transform(fromGame({...position,y:position.y+height/2}),instance,true),hull=this.hull(height,16);
    if(instance.model.headnodes[hull]>=0)return hullContents(this.map,instance.model,hull,p)===CONTENTS.SOLID;
    return p.every((v,i)=>v>=instance.model.mins[i]-(i===2?height/2:16)&&v<=instance.model.maxs[i]+(i===2?height/2:16));
  }
  touching(instance,position,height=72){
    if(this.overlaps(instance,position,height))return true;
    if(!instance.solid)return false;
    // Traces stop 1/32 unit outside the hull. Touch callbacks still need to
    // reach the surface, without enlarging non-solid trigger volumes.
    return ['x','y','z'].some(axis=>[-.0625,.0625].some(amount=>this.overlaps(instance,{...position,[axis]:position[axis]+amount},height)));
  }
  ladderAt(position,height){
    for(const i of this.instances){if(!i.enabled||i.entity.classname!=='func_ladder'||!this.overlaps(i,position,height))continue;
      const center=toGame(transform(i.model.mins.map((v,k)=>(v+i.model.maxs[k])/2),i)),dx=i.model.maxs[0]-i.model.mins[0],dy=i.model.maxs[1]-i.model.mins[1];
      const normal=dx<dy?{x:position.x>=center.x?1:-1,y:0,z:0}:{x:0,y:0,z:position.z>=center.z?1:-1};
      return {normal,top:toGame(transform(i.model.maxs,i)).y};
    }return null;
  }
}

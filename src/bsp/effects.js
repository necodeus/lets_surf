import * as THREE from 'three';
// Short-lived visual shards, not solid MDL debris or weapon pickups.
export class MapEffects {
  constructor(scene){this.scene=scene;this.items=[];this.geometry=new THREE.BoxGeometry(3,2,5);this.materials=[0xb3d8da,0x987345,0x78858a,0x8a554f,0x9b9990,0xb8b4a3,0x67796e].map(color=>new THREE.MeshBasicMaterial({color}));}
  shatter({position,material}){for(let i=0;i<12;i++){if(this.items.length>=120){const old=this.items.shift();this.scene.remove(old.mesh);}const mesh=new THREE.Mesh(this.geometry,this.materials[material%this.materials.length]);mesh.position.copy(position);const angle=i*Math.PI*2/12,velocity=new THREE.Vector3(Math.cos(angle)*(70+i*4),100+i*10,Math.sin(angle)*(70+i*4));this.scene.add(mesh);this.items.push({mesh,velocity,life:2});}}
  update(dt){this.items=this.items.filter(item=>{item.life-=dt;if(item.life<=0){this.scene.remove(item.mesh);return false;}item.velocity.y-=400*dt;item.mesh.position.addScaledVector(item.velocity,dt);item.mesh.rotation.x+=dt*3;item.mesh.rotation.z+=dt*2;return true;});}
}

import * as THREE from 'three';
import {TGALoader} from 'three/addons/loaders/TGALoader.js';
import {toGame,fromGame,findLeaf,visibleLeaves,dot} from './format.js';
import {transform} from './collision.js';
import {textureMipmaps,surfaceState} from './textures.js';
const hiddenTexture=name=>/^(aaatrigger|clip|origin|null|hint|skip|bevel)$/i.test(name);
const liquid=name=>name.startsWith('!')||name.startsWith('*');
const invisibleClass=name=>name.startsWith('trigger_')||['func_ladder','func_buyzone','func_bomb_target','func_hostage_rescue'].includes(name);
export function faceOrder(face,normal){
  // BSP's T-junction repair inserts collinear vertices. The first triangle
  // can have zero area even though the complete polygon is perfectly valid.
  const area=[0,0,0],anchor=face.vertices[0];
  for(let i=1;i<face.vertices.length-1;i++){
    const a=face.vertices[i].map((v,k)=>v-anchor[k]),b=face.vertices[i+1].map((v,k)=>v-anchor[k]);
    area[0]+=a[1]*b[2]-a[2]*b[1];area[1]+=a[2]*b[0]-a[0]*b[2];area[2]+=a[0]*b[1]-a[1]*b[0];
  }
  const order=face.vertices.map((_,i)=>i);if(dot(area,normal)<0)order.reverse();return order;
}
export function packLightmaps(faces,maxSize=4096){
  const lit=faces.filter(f=>f.lightOffset>=0&&f.styles[0]!==255);
  for(let size=256;size<=maxSize;size*=2){let x=0,y=2,row=0;const placements=new Map();let fits=true;
    for(const face of [...lit].sort((a,b)=>b.light.height-a.light.height)){
      const w=face.light.width+2,h=face.light.height+2;if(w>size||h>size){fits=false;break;}if(x+w>size){x=0;y+=row;row=0;}if(y+h>size){fits=false;break;}
      placements.set(face.index,{x:x+1,y:y+1});x+=w;row=Math.max(row,h);
    }if(fits)return {size,placements};
  }throw new Error('Lightmapy przekraczają pojemność atlasu GPU.');
}
const vertexShader=`
attribute vec2 bspLightUv; attribute vec4 bspStyles;
varying vec2 vUv; varying vec2 vLightUv; varying vec4 vStyles; varying vec3 vWorld;
uniform float time; uniform float wave;
void main(){vUv=uv;vLightUv=bspLightUv;vStyles=bspStyles;vec3 p=position;
if(wave>0.0)p.y+=sin(p.x*.025+time*1.8)*sin(p.z*.025+time*1.3)*wave;
vec4 world=modelMatrix*vec4(p,1.0);vWorld=world.xyz;gl_Position=projectionMatrix*viewMatrix*world;}`;
const fragmentShader=`
uniform sampler2D diffuseMap;uniform sampler2D light0;uniform sampler2D light1;uniform sampler2D light2;uniform sampler2D light3;
uniform float lightStyles[256];uniform float solidAlpha;uniform float time;uniform float opacity;uniform float alphaCut;uniform float water;uniform float colorOnly;uniform float unlit;uniform vec3 tint;uniform vec3 fogColor;uniform float fogDensity;
varying vec2 vUv;varying vec2 vLightUv;varying vec4 vStyles;varying vec3 vWorld;
void main(){vec2 uv=vUv;if(water>0.5)uv+=vec2(sin(uv.y*6.283+time*1.5),sin(uv.x*6.283+time*1.5))*.035;
vec4 tex=texture2D(diffuseMap,uv);if(tex.a<alphaCut)discard;
vec3 lighting=texture2D(light0,vLightUv).rgb*lightStyles[int(vStyles.x)]+texture2D(light1,vLightUv).rgb*lightStyles[int(vStyles.y)]+texture2D(light2,vLightUv).rgb*lightStyles[int(vStyles.z)]+texture2D(light3,vLightUv).rgb*lightStyles[int(vStyles.w)];
vec3 color=mix(tex.rgb,tint,colorOnly)*mix(lighting*2.0,vec3(1.0),unlit);float distanceToEye=length(vWorld-cameraPosition);float fog=1.0-exp(-fogDensity*fogDensity*distanceToEye*distanceToEye);color=mix(color,fogColor,clamp(fog,0.0,1.0));
gl_FragColor=vec4(color,mix(tex.a,1.0,solidAlpha)*opacity);
#include <colorspace_fragment>
}`;
const skyVertex=`varying vec3 direction;void main(){vec4 p=modelMatrix*vec4(position,1.0);direction=p.xyz-cameraPosition;gl_Position=projectionMatrix*viewMatrix*p;}`;
const skyFragment=`uniform samplerCube sky;varying vec3 direction;void main(){gl_FragColor=textureCube(sky,normalize(direction));\n#include <colorspace_fragment>\n}`;
const skyBackgroundVertex=`varying vec3 direction;void main(){direction=position;vec4 p=projectionMatrix*mat4(mat3(viewMatrix))*vec4(position,1.0);gl_Position=p.xyww;}`;
export function skyFacePixels(image,face){
  // GoldSrc's rt/lf/up/dn/ft/bk axes differ from OpenGL cubemap UV axes.
  const {width,height,data}=image;if(width!==height)throw new Error('Ściana nieba musi być kwadratowa.');
  const pixels=new Uint8ClampedArray(data.length);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const sx=face===2?y:face===3?width-1-y:width-1-x,sy=face===2?x:face===3?height-1-x:y;
    pixels.set(data.subarray((sy*width+sx)*4,(sy*width+sx)*4+4),(y*width+x)*4);
  }return pixels;
}
const lightPatterns=['m','mmnmmommommnonmmonqnmmo','abcdefghijklmnopqrstuvwxyzyxwvutsrqponmlkjihgfedcba','mmmmmaaaaammmmmaaaaaabcdefgabcdefg','mamamamamama','jklmnopqrstuvwxyzyxwvutsrqponmlkj','nmonqnmomnmomomno','mmmaaaabcdefgmmmmaaaammmaamm','mmmaaammmaaammmabcdefaaaammmmabcdefmmmaaaa','aaaaaaaazzzzzzzz','mmamammmmammamamaaamammma','abcdefghijklmnopqrrqponmlkjihgfedcba'];
export class BspRenderer {
  constructor(map,collision,renderer){
    this.map=map;this.collision=collision;this.root=new THREE.Group();this.root.name='GoldSrc BSP30';this.batches=[];this.groups=new Map();this.materials=[];this.geometries=[];this.textures=[];this.animations=[];this.leaf=-1;this.pvsEnabled=true;this.fullbright=false;this.styles=new Float32Array(256).fill(1);this.styles[255]=0;this.overrides=new Map();this.frustum=new THREE.Frustum();this.frustumMatrix=new THREE.Matrix4();this.viewKey='';this.leafBounds=map.leaves.map(l=>new THREE.Box3(new THREE.Vector3(l.mins[0],l.mins[2],-l.maxs[1]),new THREE.Vector3(l.maxs[0],l.maxs[2],-l.mins[1])));this.stats={faces:map.faces.length,visibleFaces:0,leaf:-1,batches:0};
    const atlas=packLightmaps(map.faces,Math.min(4096,renderer.capabilities.maxTextureSize));this.atlasSize=atlas.size;
    const atlasData=Array.from({length:4},()=>new Uint8Array(atlas.size*atlas.size*4));
    // A white sample for faces that deliberately carry no lightmap.
    atlasData[0].fill(0);for(let j=0;j<4;j++)atlasData[j][3]=255;atlasData[0].set([128,128,128,255]);
    for(const face of map.faces){const place=atlas.placements.get(face.index);if(!place)continue;const {width,height}=face.light;
      for(let layer=0;layer<4&&face.styles[layer]!==255;layer++)for(let y=-1;y<=height;y++)for(let x=-1;x<=width;x++){
        const source=face.lightOffset+(layer*width*height+Math.max(0,Math.min(height-1,y))*width+Math.max(0,Math.min(width-1,x)))*3,dest=((place.y+y)*atlas.size+place.x+x)*4;
        atlasData[layer].set(map.lighting.subarray(source,source+3),dest);atlasData[layer][dest+3]=255;
      }
    }
    this.lightmaps=atlasData.map(data=>{const t=new THREE.DataTexture(data,atlas.size,atlas.size,THREE.RGBAFormat);t.magFilter=THREE.LinearFilter;t.minFilter=THREE.LinearFilter;t.needsUpdate=true;t.generateMipmaps=false;this.textures.push(t);return t;});
    this.textureMaps=map.textures.map(texture=>{
      const levels=textureMipmaps(texture),{data,width,height}=levels[0],t=new THREE.DataTexture(data,width,height,THREE.RGBAFormat);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.magFilter=THREE.LinearFilter;
      t.mipmaps=levels;t.generateMipmaps=false;t.minFilter=THREE.LinearMipmapLinearFilter;t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());t.needsUpdate=true;this.textures.push(t);return t;
    });
    this.skyTexture=null;this.skyMaterial=new THREE.ShaderMaterial({uniforms:{sky:{value:null}},vertexShader:skyVertex,fragmentShader:skyFragment,side:THREE.DoubleSide,depthWrite:true,toneMapped:false});this.materials.push(this.skyMaterial);
    const backgroundMaterial=new THREE.ShaderMaterial({uniforms:this.skyMaterial.uniforms,vertexShader:skyBackgroundVertex,fragmentShader:skyFragment,side:THREE.BackSide,depthWrite:false,toneMapped:false});
    const backgroundGeometry=new THREE.BoxGeometry(2,2,2);this.skyBackground=new THREE.Mesh(backgroundGeometry,backgroundMaterial);this.skyBackground.frustumCulled=false;this.skyBackground.renderOrder=-1000;this.skyBackground.visible=false;this.root.add(this.skyBackground);this.materials.push(backgroundMaterial);this.geometries.push(backgroundGeometry);
    const skyFallback=new THREE.MeshBasicMaterial({color:0x91b1c5,side:THREE.DoubleSide});this.materials.push(skyFallback);this.skyFallback=skyFallback;
    for(const instance of collision.instances){
      if(invisibleClass(instance.entity.classname||''))continue;
      const group=new THREE.Group();group.matrixAutoUpdate=false;this.root.add(group);this.groups.set(instance,group);
      const buckets=new Map();for(let fi=instance.model.firstFace;fi<instance.model.firstFace+instance.model.numFaces;fi++){
        const face=map.faces[fi],info=map.texinfo[face.texinfo],tex=map.textures[info.texture];if(hiddenTexture(tex.name))continue;
        const key=String(info.texture);if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(face);
      }
      for(const [key,faces] of buckets){const textureIndex=Number(key),texture=map.textures[textureIndex],sky=texture.name.toLowerCase()==='sky';
        const geometry=new THREE.BufferGeometry(),positions=[],uv=[],lm=[],styles=[],indices=[],ranges=[];
        for(const face of faces){const first=indices.length,base=positions.length/3,place=atlas.placements.get(face.index);
          const normal=map.planes[face.plane].normal.map(v=>face.side?-v:v),order=faceOrder(face,normal);
          for(const i of order){const p=toGame(face.vertices[i]),[s,t]=face.uv[i];positions.push(p.x,p.y,p.z);uv.push(s/texture.width,t/texture.height);lm.push(place?(place.x+s/16-face.light.mins[0]+.5)/atlas.size:.5/atlas.size,place?(place.y+t/16-face.light.mins[1]+.5)/atlas.size:.5/atlas.size);styles.push(...(place?face.styles:[0,255,255,255]));}
          for(let i=1;i<order.length-1;i++)indices.push(base,base+i,base+i+1);ranges.push({face:face.index,first,count:indices.length-first});
        }
        geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setAttribute('bspLightUv',new THREE.Float32BufferAttribute(lm,2));geometry.setAttribute('bspStyles',new THREE.Float32BufferAttribute(styles,4));geometry.setIndex(indices);geometry.computeBoundingSphere();this.geometries.push(geometry);
        const e=instance.entity,{mode,opacity,cutout,transparent,depthWrite}=surfaceState(texture,e),water=liquid(texture.name);
        const material=sky?skyFallback:new THREE.ShaderMaterial({vertexShader,fragmentShader,toneMapped:false,side:water?THREE.DoubleSide:THREE.FrontSide,transparent,depthWrite,blending:mode===5||mode===3?THREE.AdditiveBlending:THREE.NormalBlending,uniforms:{diffuseMap:{value:this.textureMaps[textureIndex]},light0:{value:this.lightmaps[0]},light1:{value:this.lightmaps[1]},light2:{value:this.lightmaps[2]},light3:{value:this.lightmaps[3]},lightStyles:{value:this.styles},time:{value:0},wave:{value:water?Number(e.WaveHeight||0)*8:0},opacity:{value:opacity},solidAlpha:{value:cutout?1:0},alphaCut:{value:texture.masked?.5:0},water:{value:water?1:0},colorOnly:{value:mode===1?1:0},unlit:{value:water||mode===5?1:0},tint:{value:new THREE.Color(...(e.rendercolor||'255 255 255').split(' ').map(x=>Number(x)/255))},fogColor:{value:new THREE.Color(0x176273)},fogDensity:{value:0}}});
        if(!sky){this.materials.push(material);this.animations.push({material,textureIndex,instance,opacity,water});}
        const mesh=new THREE.Mesh(geometry,material);mesh.name=`*${instance.index} ${texture.name}`;group.add(mesh);this.batches.push({mesh,instance,sky,ranges,indices:new Uint32Array(indices)});
      }
    }
    this.stats.batches=this.batches.length;
  }
  async loadSky(baseUrl,name,files=new Map()){
    if(!/^[a-z\d_-]{1,64}$/i.test(name))throw new Error('Nieprawidłowa nazwa nieba.');
    const suffixes=['rt','lf','up','dn','ft','bk'];const loader=new TGALoader();
    const images=await Promise.all(suffixes.map(async (suffix,face)=>{const filename=`${name}${suffix}.tga`,file=files.get(filename.toLowerCase());let bytes;
      if(file)bytes=await file.arrayBuffer();else{const response=await fetch(`${baseUrl}/${filename}`);if(!response.ok)throw new Error(`Brak nieba: ${filename}`);bytes=await response.arrayBuffer();}
      const image=loader.parse(bytes),canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const ctx=canvas.getContext('2d');ctx.putImageData(new ImageData(skyFacePixels(image,face),image.width,image.height),0,0);return canvas;}));
    const sky=new THREE.CubeTexture(images);sky.colorSpace=THREE.SRGBColorSpace;sky.needsUpdate=true;this.skyTexture=sky;this.textures.push(sky);this.skyMaterial.uniforms.sky.value=sky;for(const batch of this.batches)if(batch.sky)batch.mesh.material=this.skyMaterial;
  }
  update(camera,seconds,underwater=false){
    this.skyBackground.visible=!!this.skyTexture&&!underwater;
    for(let i=0;i<lightPatterns.length;i++){const p=lightPatterns[i];this.styles[i]=(p.charCodeAt(Math.floor(seconds*10)%p.length)-97)/12;}for(const [style,value] of this.overrides){const pattern=this.customPatterns?.get(style);this.styles[style]=value&&pattern?(pattern.charCodeAt(Math.floor(seconds*10)%pattern.length)-97)/12:value;}this.styles[255]=0;
    for(const [instance,group] of this.groups){const origin=toGame(transform([0,0,0],instance)),x=toGame(transform([1,0,0],instance,false,true)),y=toGame(transform([0,0,1],instance,false,true)),z=toGame(transform([0,-1,0],instance,false,true));group.matrix.set(x.x,y.x,z.x,origin.x,x.y,y.y,z.y,origin.y,x.z,y.z,z.z,origin.z,0,0,0,1);group.matrixWorldNeedsUpdate=true;group.visible=instance.enabled;}
    for(const a of this.animations){const u=a.material.uniforms;u.time.value=seconds;u.unlit.value=this.fullbright||a.water||Number(a.instance.entity.rendermode)===5?1:0;u.fogDensity.value=underwater?.0035:0;
      const texture=this.map.textures[a.textureIndex];if(texture.name.startsWith('+')){const suffix=texture.name.slice(2).toLowerCase(),alternate=!!a.instance.alternate;const frames=this.map.textures.map((t,index)=>({t,index})).filter(({t})=>t.name.startsWith('+')&&t.name.slice(2).toLowerCase()===suffix&&(alternate?/^[a-j]$/i:/^[0-9]$/).test(t.name[1])).sort((a,b)=>a.t.name.localeCompare(b.t.name));if(frames.length)u.diffuseMap.value=this.textureMaps[frames[Math.floor(seconds*5)%frames.length].index];}
      const fx=Number(a.instance.entity.renderfx)||0;let alpha=a.opacity;
      if(fx>=1&&fx<=4)alpha+=Math.sin(seconds*(fx%2?2:8))*(fx<3?.06:.25);
      if(fx>=9&&fx<=11)alpha*=Math.sin(seconds*[0,0,0,0,0,0,0,0,0,4,16,36][fx])>=0?1:0;
      if(fx===12||fx===13)alpha*=Math.sin(seconds*17)+Math.sin(seconds*23)>0?1:0;u.opacity.value=Math.max(0,Math.min(1,alpha));
    }
    const leaf=findLeaf(this.map,fromGame(camera.position));
    const viewKey=camera.matrixWorld.elements.join(',')+camera.projectionMatrix.elements.join(',');
    if(leaf!==this.leaf||this.lastPvs!==this.pvsEnabled||viewKey!==this.viewKey){
      this.viewKey=viewKey;this.frustum.setFromProjectionMatrix(this.frustumMatrix.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));this.leaf=leaf;this.lastPvs=this.pvsEnabled;this.stats.leaf=leaf;
      const bits=visibleLeaves(this.map,leaf),visible=new Uint8Array(this.map.faces.length);if(!this.pvsEnabled||leaf===0)visible.fill(1);else for(let i=1;i<=this.map.models[0].visLeaves;i++)if((bits[(i-1)>>3]&(1<<((i-1)&7)))&&this.frustum.intersectsBox(this.leafBounds[i])){const l=this.map.leaves[i];for(let j=0;j<l.numMarks;j++)visible[this.map.marks[l.firstMark+j]]=1;}
      let total=0;for(const batch of this.batches){if(batch.instance.index!==0){total+=batch.ranges.length;continue;}const out=batch.mesh.geometry.index.array;let n=0;for(const r of batch.ranges)if(visible[r.face]){out.set(batch.indices.subarray(r.first,r.first+r.count),n);n+=r.count;total++;}batch.mesh.geometry.setDrawRange(0,n);batch.mesh.geometry.index.needsUpdate=true;batch.mesh.visible=n>0;}
      this.stats.visibleFaces=total;
    }
  }
  dispose(){for(const g of this.geometries)g.dispose();for(const m of this.materials)m.dispose();for(const t of this.textures)t.dispose();this.root.removeFromParent();}
}

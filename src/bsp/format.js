// GoldSrc BSP30 / WAD3, little endian. Axes remain native until the render boundary.
export const CONTENTS={EMPTY:-1,SOLID:-2,WATER:-3,SLIME:-4,LAVA:-5,SKY:-6};
export const toGame=([x,y,z])=>({x,y:z,z:-y});
export const fromGame=({x,y,z})=>[x,-z,y];
export const vec=value=>(value||'0 0 0').trim().split(/\s+/).map(Number).concat([0,0,0]).slice(0,3);
export const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
export const add=(a,b,s=1)=>a.map((v,i)=>v+b[i]*s);
const text=(bytes)=>new TextDecoder('windows-1252').decode(bytes).replace(/\0.*$/s,'');
function reader(input){const bytes=input instanceof Uint8Array?input:new Uint8Array(input);return {bytes,d:new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength)};}
function range(bytes,offset,length,label){if(!Number.isInteger(offset)||!Number.isInteger(length)||offset<0||length<0||offset+length>bytes.length)throw new Error(`Uszkodzony ${label}: zakres danych poza plikiem.`);}
export function parseEntities(source){
  const tokens=source.match(/"(?:\\.|[^"\\])*"|[{}]/g)||[],entities=[];let i=0;
  const unquote=t=>t.slice(1,-1).replace(/\\(["\\])/g,'$1');
  while(i<tokens.length){if(tokens[i++]!=='{')throw new Error('Nieprawidłowy blok encji BSP.');const entity=Object.create(null);
    while(tokens[i]!=='}'){const key=tokens[i++],value=tokens[i++];if(!key?.startsWith('"')||!value?.startsWith('"'))throw new Error('Niekompletna encja BSP.');entity[unquote(key)]=unquote(value);}
    i++;entities.push(entity);
  }return entities;
}
export function readMipTexture(input,offset=0){
  const {bytes,d}=reader(input);range(bytes,offset,40,'miptex');
  const name=text(bytes.subarray(offset,offset+16)),width=d.getUint32(offset+16,true),height=d.getUint32(offset+20,true);
  if(!width||!height||width>8192||height>8192||width*height>16777216)throw new Error(`Nieprawidłowy rozmiar tekstury ${name}.`);
  const offsets=Array.from({length:4},(_,i)=>d.getUint32(offset+24+i*4,true));
  if(!offsets[0])return {name,width,height,external:true,mipmaps:[]};
  const sizes=offsets.map((_,i)=>Math.max(1,width>>i)*Math.max(1,height>>i));
  for(let i=0;i<4;i++)range(bytes,offset+offsets[i],sizes[i],`miptex ${name}`);
  const paletteOffset=offset+offsets[3]+sizes[3];range(bytes,paletteOffset,2,'paleta');const colors=d.getUint16(paletteOffset,true);if(colors<1||colors>256)throw new Error(`Nieprawidłowa paleta ${name}.`);
  range(bytes,paletteOffset+2,colors*3,'paleta');const palette=bytes.subarray(paletteOffset+2,paletteOffset+2+colors*3);
  const masked=name.startsWith('{');const mipmaps=offsets.map((o,level)=>{const data=new Uint8Array(sizes[level]*4);
    for(let i=0;i<sizes[level];i++){const index=bytes[offset+o+i];if(index>=colors)throw new Error(`Indeks palety poza zakresem: ${name}.`);data.set(palette.subarray(index*3,index*3+3),i*4);data[i*4+3]=masked&&index===255?0:255;}
    return {data,width:Math.max(1,width>>level),height:Math.max(1,height>>level)};
  });
  return {name,width,height,external:false,mipmaps,masked};
}
export function parseWad(input){
  const {bytes,d}=reader(input);range(bytes,0,12,'WAD');if(text(bytes.subarray(0,4))!=='WAD3')throw new Error('Oczekiwano WAD3 z paletami GoldSrc.');
  const count=d.getInt32(4,true),offset=d.getInt32(8,true);if(count<0||count>100000)throw new Error('Nieprawidłowa liczba wpisów WAD.');range(bytes,offset,count*32,'katalog WAD');
  const textures=new Map();for(let i=0;i<count;i++){const o=offset+i*32,pos=d.getInt32(o,true),size=d.getInt32(o+4,true),type=d.getUint8(o+12),compression=d.getUint8(o+13);range(bytes,pos,size,'wpis WAD');
    if(type!==0x43)continue;if(compression)throw new Error('Skompresowane tekstury WAD nie są obsługiwane przez GoldSrc loader.');
    const name=text(bytes.subarray(o+16,o+32)).toLowerCase();textures.set(name,()=>readMipTexture(bytes.subarray(pos,pos+size)));
  }return textures;
}
export function parseBsp(input){
  const {bytes,d}=reader(input);range(bytes,0,124,'nagłówek BSP');const version=d.getInt32(0,true);if(version!==30)throw new Error(`BSP ${version}: ten renderer wymaga GoldSrc BSP 30.`);
  const lumps=Array.from({length:15},(_,i)=>{const offset=d.getInt32(4+i*8,true),length=d.getInt32(8+i*8,true);range(bytes,offset,length,`lump ${i}`);return {offset,length};});
  const read=(index,stride,fn)=>{const l=lumps[index];if(l.length%stride)throw new Error(`Uszkodzony lump ${index}.`);return Array.from({length:l.length/stride},(_,i)=>fn(l.offset+i*stride));};
  const f=o=>d.getFloat32(o,true),i=o=>d.getInt32(o,true),s=o=>d.getInt16(o,true),u=o=>d.getUint16(o,true),v=o=>[f(o),f(o+4),f(o+8)],shorts=o=>[s(o),s(o+2),s(o+4)];
  const map={version,lumps,entities:parseEntities(text(bytes.subarray(lumps[0].offset,lumps[0].offset+lumps[0].length))),
    planes:read(1,20,o=>({normal:v(o),dist:f(o+12),type:i(o+16)})),vertices:read(3,12,v),
    nodes:read(5,24,o=>({plane:i(o),children:[s(o+4),s(o+6)],mins:shorts(o+8),maxs:shorts(o+14),firstFace:u(o+20),numFaces:u(o+22)})),
    texinfo:read(6,40,o=>({s:[...v(o),f(o+12)],t:[...v(o+16),f(o+28)],texture:i(o+32),flags:i(o+36)})),
    faces:read(7,20,o=>({plane:u(o),side:s(o+2),firstEdge:i(o+4),numEdges:u(o+8),texinfo:u(o+10),styles:Array.from(bytes.subarray(o+12,o+16)),lightOffset:i(o+16)})),
    clipnodes:read(9,8,o=>({plane:i(o),children:[s(o+4),s(o+6)]})),
    leaves:read(10,28,o=>({contents:i(o),visOffset:i(o+4),mins:shorts(o+8),maxs:shorts(o+14),firstMark:u(o+20),numMarks:u(o+22),ambient:Array.from(bytes.subarray(o+24,o+28))})),
    marks:read(11,2,u),edges:read(12,4,o=>[u(o),u(o+2)]),surfedges:read(13,4,i),
    models:read(14,64,o=>({mins:v(o),maxs:v(o+12),origin:v(o+24),headnodes:[i(o+36),i(o+40),i(o+44),i(o+48)],visLeaves:i(o+52),firstFace:i(o+56),numFaces:i(o+60)})),
    lighting:bytes.slice(lumps[8].offset,lumps[8].offset+lumps[8].length),visibility:bytes.slice(lumps[4].offset,lumps[4].offset+lumps[4].length),textures:[],pvsCache:new Map(),
  };
  const l=lumps[2];range(bytes,l.offset,4,'katalog tekstur');const count=i(l.offset);if(count<0||count>65536||4+count*4>l.length)throw new Error('Nieprawidłowy katalog tekstur BSP.');
  for(let n=0;n<count;n++){const off=i(l.offset+4+n*4);if(off===-1)map.textures.push({name:`missing_${n}`,width:64,height:64,external:true,mipmaps:[]});else {range(bytes.subarray(l.offset,l.offset+l.length),off,40,'tekstura BSP');map.textures.push(readMipTexture(bytes.subarray(l.offset,l.offset+l.length),off));}}
  const ref=(n,array,label)=>{if(!Number.isInteger(n)||n<0||n>=array.length)throw new Error(`Nieprawidłowy indeks ${label}: ${n}.`);};
  for(const p of map.planes)if(![...p.normal,p.dist].every(Number.isFinite))throw new Error('Nieprawidłowa płaszczyzna BSP.');
  for(const vertex of map.vertices)if(!vertex.every(Number.isFinite))throw new Error('Nieprawidłowy wierzchołek BSP.');
  for(const edge of map.edges)for(const n of edge)ref(n,map.vertices,'vertex');
  for(const n of map.surfedges)ref(Math.abs(n),map.edges,'edge');
  for(const t of map.texinfo){ref(t.texture,map.textures,'texture');if(![...t.s,...t.t].every(Number.isFinite))throw new Error('Nieprawidłowe UV.');}
  for(const [index,face] of map.faces.entries()){
    ref(face.plane,map.planes,'plane');ref(face.texinfo,map.texinfo,'texinfo');if(face.numEdges<3||face.numEdges>4096||face.firstEdge<0||face.firstEdge+face.numEdges>map.surfedges.length)throw new Error('Nieprawidłowy obrys ściany.');
    if(face.lightOffset < -1)throw new Error('Nieprawidłowy offset lightmapy.');
    face.index=index;face.vertices=Array.from({length:face.numEdges},(_,j)=>{const e=map.surfedges[face.firstEdge+j];return map.vertices[map.edges[Math.abs(e)][e<0?1:0]];});
    const info=map.texinfo[face.texinfo];face.uv=face.vertices.map(p=>[dot(p,info.s)+info.s[3],dot(p,info.t)+info.t[3]]);
    const mins=[0,1].map(k=>Math.floor(Math.min(...face.uv.map(uv=>uv[k]))/16)),maxs=[0,1].map(k=>Math.ceil(Math.max(...face.uv.map(uv=>uv[k]))/16));
    face.light={mins,width:maxs[0]-mins[0]+1,height:maxs[1]-mins[1]+1};
    if(face.lightOffset>=0){const n=face.styles.filter(x=>x!==255).length;range(map.lighting,face.lightOffset,face.light.width*face.light.height*3*n,'lightmap');}
  }
  for(const n of map.marks)ref(n,map.faces,'marksurface');
  for(const node of map.nodes){ref(node.plane,map.planes,'node plane');for(const n of node.children)ref(n>=0?n:-n-1,n>=0?map.nodes:map.leaves,'child');}
  for(const node of map.clipnodes){ref(node.plane,map.planes,'clip plane');for(const n of node.children)if(n>=0)ref(n,map.clipnodes,'clip child');}
  // Validate all trees once, so malformed graphs cannot recurse forever later.
  const checkTree=(nodes)=>{const state=new Uint8Array(nodes.length);const visit=(n,depth)=>{if(n<0)return;if(depth>512||state[n]===1)throw new Error('Cykliczne lub zbyt głębokie drzewo BSP.');if(state[n]===2)return;state[n]=1;for(const child of nodes[n].children)visit(child,depth+1);state[n]=2;};for(let n=0;n<nodes.length;n++)visit(n,0);};checkTree(map.nodes);checkTree(map.clipnodes);
  for(const leaf of map.leaves)if(leaf.firstMark+leaf.numMarks>map.marks.length||leaf.visOffset < -1||leaf.visOffset>=map.visibility.length&&leaf.visOffset!==-1)throw new Error('Nieprawidłowy liść BSP.');
  for(const model of map.models){if(model.firstFace<0||model.numFaces<0||model.firstFace+model.numFaces>map.faces.length||![...model.mins,...model.maxs,...model.origin].every(Number.isFinite))throw new Error('Nieprawidłowy model BSP.');model.headnodes.forEach((n,k)=>{if(n>=0)ref(n,k===0?map.nodes:map.clipnodes,'model headnode');});}
  if(!map.models.length)throw new Error('BSP nie zawiera modelu świata.');
  for(const model of map.models){if(model.visLeaves<0||model.visLeaves>=map.leaves.length)throw new Error('Nieprawidłowa liczba liści modelu.');if(model.headnodes[0]<0)ref(-model.headnodes[0]-1,map.leaves,'model leaf');}
  return map;
}
export function findLeaf(map,point,root=map.models[0].headnodes[0]){
  let n=root;while(n>=0){const node=map.nodes[n],p=map.planes[node.plane];n=node.children[dot(point,p.normal)-p.dist>=0?0:1];}return -n-1;
}
export function visibleLeaves(map,leafIndex){
  if(map.pvsCache.has(leafIndex))return map.pvsCache.get(leafIndex);
  const size=Math.ceil(map.models[0].visLeaves/8),out=new Uint8Array(size),leaf=map.leaves[leafIndex];
  if(!leaf||leafIndex===0||leaf.visOffset<0)out.fill(255);
  else {let p=leaf.visOffset,n=0;while(n<size){if(p>=map.visibility.length)throw new Error('Urwane PVS.');const b=map.visibility[p++];if(b)out[n++]=b;else {if(p>=map.visibility.length)throw new Error('Urwane PVS RLE.');const run=map.visibility[p++];if(!run)throw new Error('Nieprawidłowy przebieg PVS.');n+=run;}}}
  if(map.pvsCache.size>256)map.pvsCache.clear();map.pvsCache.set(leafIndex,out);return out;
}
export function resolveTextures(map,wads){
  const missing=[];map.textures=map.textures.map(texture=>{if(!texture.external)return texture;for(const wad of wads){const read=wad.get(texture.name.toLowerCase());if(read)return read();}missing.push(texture.name);return texture;});return missing;
}

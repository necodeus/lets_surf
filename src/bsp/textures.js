// Preserve palette artwork, but never let the RGB transparency key leak
// into visible pixels during bilinear/trilinear filtering.
export function bleedTransparentRgb(level){
  const {width,height}=level,data=new Uint8Array(level.data),count=width*height,queue=new Int32Array(count),seen=new Uint8Array(count);let read=0,write=0;
  for(let i=0;i<count;i++)if(data[i*4+3]){seen[i]=1;queue[write++]=i;}
  while(read<write){const i=queue[read++],x=i%width,y=Math.floor(i/width);
    for(const next of [y*width+(x+width-1)%width,y*width+(x+1)%width,((y+height-1)%height)*width+x,((y+1)%height)*width+x]){
      if(seen[next])continue;seen[next]=1;queue[write++]=next;for(let c=0;c<3;c++)data[next*4+c]=data[i*4+c];
    }
  }return {width,height,data};
}
const coverage=(data,scale=1)=>{let solid=0;for(let i=3;i<data.length;i+=4)if(data[i]*scale>=128)solid++;return solid/(data.length/4);};
function preserveCoverage(data,target){
  let low=0,high=8,best=1,error=Math.abs(coverage(data)-target);
  for(let i=0;i<16;i++){const scale=(low+high)/2,value=coverage(data,scale),difference=Math.abs(value-target);
    if(difference<error){best=scale;error=difference;}if(value<target)low=scale;else high=scale;
  }
  for(let i=3;i<data.length;i+=4)data[i]=Math.min(255,Math.round(data[i]*best));
}
export function textureMipmaps(texture){
  let source=texture.mipmaps;
  if(!source.length){const data=new Uint8Array(16*16*4);for(let i=0;i<256;i++){const c=((i%16>>2)^(i/16>>2))&1;data.set(c?[255,0,200,255]:[20,20,20,255],i*4);}source=[{data,width:16,height:16}];}
  // Authored lower mips of {bars become entirely transparent, while {grate2
  // loses its holes. Rebuild masked levels from the full-resolution mask.
  const levels=texture.masked?[bleedTransparentRgb(source[0])]:[...source];
  const target=coverage(levels[0].data);let last=levels.at(-1);
  while(last.width>1||last.height>1){
    const width=Math.max(1,last.width>>1),height=Math.max(1,last.height>>1),data=new Uint8Array(width*height*4);
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      let alpha=0;const rgb=[0,0,0];
      for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++){
        const p=(Math.min(last.height-1,y*2+dy)*last.width+Math.min(last.width-1,x*2+dx))*4,a=last.data[p+3];alpha+=a;
        for(let c=0;c<3;c++)rgb[c]+=last.data[p+c]*(texture.masked?a:1);
      }
      const p=(y*width+x)*4;for(let c=0;c<3;c++)data[p+c]=Math.round(rgb[c]/(texture.masked?(alpha||1):4));data[p+3]=Math.round(alpha/4);
    }
    if(texture.masked)preserveCoverage(data,target);
    last=texture.masked?bleedTransparentRgb({width,height,data}):{width,height,data};levels.push(last);
  }return levels;
}
export function surfaceState(texture,entity){
  const mode=Number(entity.rendermode)||0,opacity=mode?Math.max(0,Math.min(1,Number(entity.renderamt??255)/255)):1;
  const cutout=!!texture.masked&&opacity===1&&[0,2,4].includes(mode);
  const transparent=mode!==0&&mode!==4&&!cutout;
  return {mode,opacity,cutout,transparent,depthWrite:!transparent};
}

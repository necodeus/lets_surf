import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseWad} from '../src/bsp/format.js';
import {bleedTransparentRgb,textureMipmaps,surfaceState} from '../src/bsp/textures.js';

test('masked filtering removes the blue key without changing artwork or transparency',()=>{
  const source={width:2,height:2,data:new Uint8Array([100,120,140,255,0,0,255,0,0,0,255,0,0,0,255,0])},original=source.data.slice();
  const result=bleedTransparentRgb(source);
  for(let i=0;i<4;i++){assert.deepEqual([...result.data.slice(i*4,i*4+3)],[100,120,140]);assert.equal(result.data[i*4+3],original[i*4+3]);}
  assert.deepEqual(source.data,original);
  const levels=textureMipmaps({masked:true,mipmaps:[source]});
  assert.deepEqual([...levels[1].data.slice(0,3)],[100,120,140]);
});

test('actual cage mipmaps keep bars and floor holes visible at reduced resolution',()=>{
  const wad=parseWad(fs.readFileSync(new URL('../public/assets/goldsrc/halflife.wad',import.meta.url)));
  for(const name of ['{bars','{grate2']){
    const texture=wad.get(name)(),original=texture.mipmaps[0].data.slice(),levels=textureMipmaps(texture);
    for(const level of levels){
      for(let i=0;i<level.data.length;i+=4)assert.ok(!(level.data[i]===0&&level.data[i+1]===0&&level.data[i+2]===255),'blue palette key leaked into filtered texture');
    }
    const reduced=levels[3].data,solid=reduced.filter((v,i)=>i%4===3&&v>=128).length;
    assert.ok(solid>0&&solid<reduced.length/4,`${name} loses its mask at mip 3`);
    for(let i=0;i<original.length;i+=4){assert.equal(levels[0].data[i+3],original[i+3]);if(original[i+3])assert.deepEqual(levels[0].data.slice(i,i+4),original.slice(i,i+4));}
    assert.deepEqual(texture.mipmaps[0].data,original);
  }
});

test('fully opaque masked TransTexture brushes write depth while translucent glass still blends',()=>{
  const cage=surfaceState({masked:true},{rendermode:'2',renderamt:'255'});
  assert.equal(cage.cutout,true);assert.equal(cage.transparent,false);assert.equal(cage.depthWrite,true);
  for(const texture of [{masked:true},{masked:false}]){
    const glass=surfaceState(texture,{rendermode:'2',renderamt:'100'});
    assert.equal(glass.cutout,false);assert.equal(glass.transparent,true);assert.equal(glass.depthWrite,false);
  }
});

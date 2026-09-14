import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseBsp} from '../src/bsp/format.js';
import {lumps,countOf,recordName,recordRange,references} from '../src/inspector/schema.js';
import {diagnose,entitySupport,entityNotes,unclaimedRanges} from '../src/inspector/diagnostics.js';
const bytes=fs.readFileSync(new URL('../surf_ski_2.bsp',import.meta.url)),map=parseBsp(bytes);

test('inspector describes all 15 actual lumps and fixed record byte ranges match the BSP',()=>{
  assert.equal(lumps.length,15);
  for(let id=0;id<15;id++){
    assert.ok(lumps[id].description);assert.ok(countOf(map,id)>0);
    if(lumps[id].stride){assert.equal(countOf(map,id)*lumps[id].stride,map.lumps[id].length);const last=recordRange(map,bytes,id,countOf(map,id)-1);assert.equal(last.offset+last.length,map.lumps[id].offset+map.lumps[id].length);}
  }
  const range=recordRange(map,bytes,7,35),view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  assert.equal(view.getUint16(range.offset,true),map.faces[35].plane);assert.equal(view.getInt32(range.offset+16,true),map.faces[35].lightOffset);
});
test('texture ranges are miptex headers, entity ranges honestly cover their whole text lump',()=>{
  for(let i=0;i<map.textures.length;i++){const range=recordRange(map,bytes,2,i);assert.equal(range.length,40);assert.equal(bytes.subarray(range.offset,range.offset+16).toString('latin1').split('\0')[0],map.textures[i].name);}
  assert.deepEqual(recordRange(map,bytes,0,4),map.lumps[0]);assert.match(recordName(map,14,16),/func_wall/);
});
test('reference navigation distinguishes BSP leaves from collision content codes',()=>{
  assert.deepEqual(references(5,{plane:1,children:[5,-8]}).at(-1),{lump:10,index:7,label:'children[1]'});
  assert.equal(references(9,{plane:1,children:[-1,-2]}).length,1);
  assert.deepEqual(references(13,-17),[{lump:12,index:17,label:'edge'}]);
  assert.deepEqual(references(0,{model:'*16'}),[{lump:14,index:16,label:'model'}]);
});
test('actual map diagnostics separate missing gameplay, partial behavior and external textures',()=>{
  const report=diagnose(map,bytes);
  assert.equal(report.classes.find(c=>c.name==='armoury_entity').status,'excluded');assert.equal(report.classes.find(c=>c.name==='func_door').status,'partial');
  assert.equal(report.external.length,55);assert.ok(report.findings.some(f=>f.status==='unsupported'&&f.message.startsWith('health')));
});
test('unknown classes and custom properties stay visible, including hostile prototype names',()=>{
  for(const classname of ['custom_portal','__proto__','constructor','toString']){assert.equal(entitySupport({classname})[0],'unknown');assert.ok(entityNotes({classname,custom_key:'<script>alert(1)</script>'}).some(n=>n.status==='unknown'));}
  const notes=entityNotes({classname:'func_wall',rendermode:'123',renderfx:'17'});assert.ok(notes.some(n=>n.message.startsWith('rendermode')));assert.ok(notes.some(n=>n.message.startsWith('renderfx')));
});
test('unparsed appended data is exposed with an exact byte range, not silently discarded',()=>{
  const extended=Buffer.concat([bytes,Buffer.from('BSPX unknown extension')]),gaps=unclaimedRanges(map,extended),tail=gaps.at(-1);
  assert.equal(tail.offset,bytes.length);assert.equal(tail.length,22);assert.equal(tail.nonzero,true);
  for(const gap of unclaimedRanges(map,bytes))assert.ok(!gap.nonzero,'original map has only zero padding outside lumps');
});

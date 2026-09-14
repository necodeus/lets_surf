export class EntityAudio {
  constructor(){this.context=null;this.buffers=new Map();this.active=new Map();this.tokens=new Map();this.failures=new Set();}
  resume(){try{this.context??=new AudioContext();void this.context.resume().catch(()=>{});}catch{/* Audio is optional on hosts without Web Audio. */}}
  pause(){if(this.context)void this.context.suspend().catch(()=>{});}
  stop(key){this.tokens.set(key,(this.tokens.get(key)||0)+1);const current=this.active.get(key);if(current){current.source.stop();this.active.delete(key);}}
  async play(event){
    if(event.stop){this.stop(event.key);return;}if(!this.context||!event.path||!/^[a-z0-9_/.-]+\.wav$/i.test(event.path)||event.path.includes('..'))return;
    const key=event.loop?event.key:Symbol(event.path);if(event.loop)this.stop(key);const token=this.tokens.get(key)||0;
    try{
      if(!this.buffers.has(event.path))this.buffers.set(event.path,fetch(`/assets/goldsrc/sound/${event.path}`).then(r=>{if(!r.ok)throw new Error(`HTTP ${r.status}`);return r.arrayBuffer();}).then(b=>this.context.decodeAudioData(b)));
      const buffer=await this.buffers.get(event.path);if((this.tokens.get(key)||0)!==token)return;
      const source=this.context.createBufferSource(),panner=this.context.createPanner(),gain=this.context.createGain();source.buffer=buffer;source.loop=!!event.loop;panner.panningModel='HRTF';panner.distanceModel='inverse';panner.refDistance=128;panner.maxDistance=4096;gain.gain.value=.55;
      panner.positionX.value=event.position.x;panner.positionY.value=event.position.y;panner.positionZ.value=event.position.z;source.connect(panner).connect(gain).connect(this.context.destination);source.onended=()=>{source.disconnect();panner.disconnect();gain.disconnect();if(this.active.get(key)?.source===source)this.active.delete(key);if(typeof key==='symbol')this.tokens.delete(key);};this.active.set(key,{source,panner});source.start();
    }catch(error){if(!this.failures.has(event.path)){this.failures.add(event.path);console.warn(`Dźwięk mapy niedostępny: ${event.path}`,error.message);}}
  }
  listener(position,yaw,pitch){if(!this.context)return;const l=this.context.listener;if(!l.positionX)return;l.positionX.value=position.x;l.positionY.value=position.y;l.positionZ.value=position.z;l.forwardX.value=-Math.sin(yaw)*Math.cos(pitch);l.forwardY.value=Math.sin(pitch);l.forwardZ.value=-Math.cos(yaw)*Math.cos(pitch);l.upX.value=0;l.upY.value=1;l.upZ.value=0;}
  positions(instances){for(const i of instances){const item=this.active.get(`${i.index}:move`);if(!item)continue;const p=i.soundPosition;if(p){item.panner.positionX.value=p.x;item.panner.positionY.value=p.y;item.panner.positionZ.value=p.z;}}}
}

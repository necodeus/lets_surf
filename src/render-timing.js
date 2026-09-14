export const defaultFpsMax=0;
export const validFpsMax=value=>typeof value==='number'&&Number.isFinite(value)&&(value===0||(value>=1&&value<=1000));

export class FrameLimiter {
  constructor(){this.reset();}
  reset(){this.next=null;this.limit=null;}
  shouldRender(now,limit){
    if(limit===0){this.reset();return true;}
    const interval=1000/limit;
    if(this.next===null||limit!==this.limit){this.limit=limit;this.next=now+interval;return true;}
    if(now+1e-7<this.next)return false;
    // Keep the phase across refresh rates; drop missed frames after a stall.
    this.next+=Math.max(1,Math.floor((now-this.next+1e-7)/interval)+1)*interval;
    return true;
  }
}

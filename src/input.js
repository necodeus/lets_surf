export const defaultBinds = {
  KeyW: '+forward', KeyS: '+back', KeyA: '+moveleft', KeyD: '+moveright',
  Space: '+jump', ShiftLeft: '+duck', ShiftRight: '+duck',
  ControlLeft: '+duck', ControlRight: '+duck',
  mwheelup: '+jump', mwheeldown: '+duck',
};
export const actions = ['+forward', '+back', '+moveleft', '+moveright', '+jump', '+duck', '+speed', 'none'];
const aliases = {space:'Space',shift:'ShiftLeft',ctrl:'ControlLeft',control:'ControlLeft',mwheelup:'mwheelup',mwheeldown:'mwheeldown'};
export function keyCode(name) {
  const key = name.toLowerCase();
  return aliases[key] || (/^[a-z]$/.test(key) ? `Key${key.toUpperCase()}` : Object.keys(defaultBinds).find(k=>k.toLowerCase()===key));
}
export class MovementInput {
  constructor(binds={}) { this.binds={...defaultBinds,...binds}; this.clear(); }
  clear() { this.keys=new Set(); this.jumpPressed=false; this.duckQueue=0; this.duckRelease=false; }
  down(code) { if(!this.keys.has(code)&&this.binds[code]==='+jump')this.jumpPressed=true; this.keys.add(code); }
  up(code) { this.keys.delete(code); }
  wheel(direction) {
    const action=this.binds[direction];
    if(action==='+jump')this.jumpPressed=true;
    if(action==='+duck')this.duckQueue=Math.min(32,this.duckQueue+1);
  }
  next(yaw=0,pitch=0) {
    const held=new Set([...this.keys].map(k=>this.binds[k]));
    // Every wheel notch is +duck for one simulation tick, then -duck.
    // A held keyboard duck remains independent of that release.
    let pulse=false;
    if(this.duckRelease)this.duckRelease=false;
    else if(this.duckQueue>0){this.duckQueue--;pulse=true;this.duckRelease=true;}
    const input={forward:Number(held.has('+forward'))-Number(held.has('+back')),right:Number(held.has('+moveright'))-Number(held.has('+moveleft')),jump:held.has('+jump'),jumpPressed:this.jumpPressed,duck:held.has('+duck')||pulse,walk:held.has('+speed'),yaw,pitch};
    this.jumpPressed=false;
    return input;
  }
}

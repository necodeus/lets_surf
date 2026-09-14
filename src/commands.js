import { defaultFpsMax, validFpsMax } from './render-timing.js';
import { defaults } from './physics.js';
import { actions, keyCode } from './input.js';
export const cvars={
  friction:{key:'friction',min:0,max:30},accelerate:{key:'acceleration',min:0,max:150},
  airaccelerate:{key:'airAcceleration',min:0,max:1000},gravity:{key:'gravity',min:0,max:4000},
  maxspeed:{key:'speed',min:1,max:2000},stopspeed:{key:'stopSpeed',min:0,max:1000},
  wateraccelerate:{key:'acceleration',min:0,max:150},waterfriction:{key:'friction',min:0,max:30},
  ladderspeed:{key:'ladderSpeed',min:1,max:1000},autobhop:{key:'autoBhop',min:0,max:1,boolean:true},
  autobunnyhopping:{key:'autoBhop',min:0,max:1,boolean:true},
  enablebunnyhopping:{key:'enableBunnyhopping',min:0,max:1,boolean:true},
  jump_penalty:{key:'jumpPenalty',min:0,max:1,boolean:true},jumpbuffer:{key:'jumpBufferMs',min:0,max:250},
  stamina_restore_rate:{key:'staminaRestoreRate',min:0,max:1000},
  edgefriction:{key:'edgeFriction',min:0,max:30},surfacefriction:{key:'surfaceFriction',min:0,max:1},
  bounce:{key:'bounce',min:0,max:10},maxvelocity:{key:'maxVelocity',min:1,max:20000},stepsize:{key:'stepSize',min:0,max:512},
};
export const commandNames=['air_accelerate','sensitivity','fov','setpos','setang','bsp_info','noclip','spawn_next','r_fullbright','r_novis','fps_max','help','clear','bind','unbind','binds','reset_physics','restart','map',...Object.keys(cvars),...Object.keys(cvars).map(k=>`sv_${k}`)];
export function runCommand(line,ctx) {
  // Parse a tiny command language; never execute JavaScript or shell input.
  const tokens=line.trim().match(/"[^"\n]*"|[^\s"]+/g)?.map(s=>s.replace(/^"|"$/g,''))||[];
  if(!tokens.length)return [];
  const [raw,...args]=tokens,cmd=raw.toLowerCase().replace(/^sv_/,'').replace(/^air_accelerate$/,'airaccelerate');
  if(['sensitivity','fov'].includes(cmd))return ctx.viewCommand?.(cmd,args)||['Brak ustawień kamery.'];
  if(['setpos','setang','bsp_info','noclip','spawn_next','r_fullbright','r_novis'].includes(cmd))return ctx.bspCommand?.(cmd,args)||['Brak aktywnej mapy BSP.'];
  if(cmd==='fps_max'){
    if(!args.length)return [`fps_max = ${ctx.renderSettings.fpsMax} (0 = bez limitu)`];
    const value=Number(args[0]);
    if(args.length!==1||args[0].trim()===''||!validFpsMax(value))return ['Błąd: fps_max wymaga 0 (bez limitu) lub liczby 1–1000.'];
    ctx.renderSettings.fpsMax=value;ctx.renderChanged();
    return [`fps_max = ${value} (domyślnie ${defaultFpsMax}). Limit renderowania; osiągane FPS zależą od wydajności i odświeżania przeglądarki.`];
  }
  if(Object.hasOwn(cvars,cmd)) {
    const spec=cvars[cmd];
    if(!args.length)return [`sv_${cmd} = ${Number(ctx.settings[spec.key])} (domyślnie ${Number((ctx.defaults||defaults)[spec.key])})`];
    const value=Number(args[0]);
    if(args.length!==1||args[0].trim()===''||!Number.isFinite(value)||value<spec.min||value>spec.max||(spec.boolean&&value!==0&&value!==1))return [`Błąd: ${cmd} wymaga liczby ${spec.min}–${spec.max}.`];
    ctx.settings[spec.key]=spec.boolean?!!value:value;ctx.changed();
    return [`sv_${cmd} = ${value}`];
  }
  if(cmd==='help')return ['Komendy: '+commandNames.filter(k=>!k.startsWith('sv_')).join(', '),'fps_max 100 / 300 ogranicza renderowanie; fps_max 0 usuwa limit. Tickrate fizyki pozostaje 128.','sensitivity 1 / fov 90 — kamera (FOV poziomy). Ustawienia, bindy i fps_max zapisują się automatycznie w przeglądarce.','Podaj samą nazwę, aby odczytać wartość. Przykład: sv_gravity 800','waterfriction / wateraccelerate to lokalne aliasy friction / accelerate (wspólna fizyka lądu i wody).','sv_enablebunnyhopping 1 wyłącza limiter; sv_autobunnyhopping 1 włącza automatyczne skoki.','Lokalne rozszerzenia: jump_penalty (0/1), jumpbuffer (ms), surfacefriction (mnożnik gracza).','bind mwheelup "+jump" | bind mwheeldown "+duck" | bind shift "+duck"','map surf_ski_2. ~ lub F1: konsola; ↑ ↓: historia; Tab: uzupełnianie.'];
  if(cmd==='clear'){ctx.clear?.();return [];}
  if(cmd==='reset_physics'){Object.assign(ctx.settings,ctx.defaults||defaults);ctx.changed();return ['Przywrócono domyślną fizykę.'];}
  if(cmd==='restart'){ctx.restart();return ['Powrót na start.'];}
  if(cmd==='map'){if(args.length!==1||!['bsp','surf_ski_2'].includes(args[0]))return ['Użycie: map surf_ski_2'];ctx.map(args[0]);return ['Punkt startu: '+args[0]];}
  if(cmd==='binds')return Object.entries(ctx.input.binds).map(([k,v])=>`${k}: ${v}`);
  if(cmd==='bind'||cmd==='unbind'){
    const key=keyCode(args[0]||'');
    if(!key)return ['Nieznany klawisz. Użyj space, shift, ctrl, litery, mwheelup lub mwheeldown.'];
    if(cmd==='bind'&&args.length===1)return [`${key}: ${ctx.input.binds[key]||'none'}`];
    const action=cmd==='unbind'?'none':args[1];
    if(args.length!==(cmd==='unbind'?1:2)||!actions.includes(action)||((key==='mwheelup'||key==='mwheeldown')&&!['+duck','+jump','none'].includes(action)))return ['Niepoprawny bind. Kółko obsługuje +jump, +duck lub none.'];
    ctx.input.clear();ctx.input.binds[key]=action;
    if(['shift','ctrl','control'].includes((args[0]||'').toLowerCase()))ctx.input.binds[key.replace('Left','Right')]=action;
    ctx.changed();return [`bind ${args[0]} "${action}"`];
  }
  return [`Nieznana komenda: ${raw}. Wpisz help.`];
}

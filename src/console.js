import { runCommand, commandNames } from './commands.js';
export function setupConsole(ctx) {
  const panel=document.getElementById('console'),field=document.getElementById('console-input'),output=document.getElementById('console-output');
  let history=[];try{const saved=JSON.parse(localStorage.getItem('strafe-console-history')||'[]');if(Array.isArray(saved))history=saved.filter(x=>typeof x==='string'&&x.length<=200).slice(-100);}catch{}
  let cursor=history.length,draft='';
  function print(text){const row=document.createElement('div');row.textContent=text;output.append(row);while(output.children.length>200)output.firstChild.remove();output.scrollTop=output.scrollHeight;}
  function close(){panel.hidden=true;field.blur();document.getElementById('hud').inert=false;ctx.resume?.();document.getElementById('game').focus({preventScroll:true});}
  function open(){panel.hidden=false;ctx.pause();document.getElementById('hud').inert=true;field.focus();}
  function toggle(){if(panel.hidden)open();else close();}
  document.getElementById('console-close').addEventListener('click',close);
  document.addEventListener('keydown',event=>{
    if(event.code==='Backquote'||event.code==='F1'){event.preventDefault();event.stopImmediatePropagation();if(!event.repeat)toggle();}
    else if(!panel.hidden&&event.code==='Escape'){event.preventDefault();event.stopImmediatePropagation();close();}
  },true);
  field.addEventListener('keydown',event=>{
    if(event.key==='Enter'){
      event.preventDefault();const line=field.value.trim();if(!line)return;
      history.push(line);history=history.slice(-100);try{localStorage.setItem('strafe-console-history',JSON.stringify(history));}catch{}cursor=history.length;draft='';print('> '+line);
      for(const message of runCommand(line,{...ctx,clear:()=>output.replaceChildren()}))print(message);field.value='';
    }else if(event.key==='ArrowUp'||event.key==='ArrowDown'){
      event.preventDefault();if(cursor===history.length)draft=field.value;
      cursor=Math.max(0,Math.min(history.length,cursor+(event.key==='ArrowUp'?-1:1)));field.value=cursor===history.length?draft:history[cursor];
    }else if(event.key==='Tab'){
      event.preventDefault();const prefix=field.value.trim().toLowerCase();const matches=commandNames.filter(s=>s.startsWith(prefix));
      if(matches.length===1)field.value=matches[0]+' ';else if(matches.length)print(matches.join('  '));
    }
  });
  print('STRAFE console / wpisz help. Zmiany są zapisywane lokalnie i działają po wznowieniu gry.');
  print('Domyślne: friction 4 · accelerate 10 · airaccelerate 100 · gravity 800 · stepsize 224 · fov 90');
  print('Domyślnie: limiter bhopa i kary po skoku włączone, auto-bhop wyłączony, brak bufora skoku.');
  return {open,close};
}

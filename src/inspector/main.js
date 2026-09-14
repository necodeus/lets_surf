import './style.css';
import {parseBsp} from '../bsp/format.js';
import {lumps,countOf,recordName,recordRange,references} from './schema.js';
import {diagnose,entitySupport,entityNotes,statusNames} from './diagnostics.js';
import formatCode from '../bsp/format.js?raw';
import collisionCode from '../bsp/collision.js?raw';
import rendererCode from '../bsp/renderer.js?raw';
import runtimeCode from '../bsp/runtime.js?raw';
import textureCode from '../bsp/textures.js?raw';
import entityCode from '../bsp/entities.js?raw';
import audioCode from '../bsp/audio.js?raw';
import effectCode from '../bsp/effects.js?raw';
const modules=[
  ['format.js','Parser BSP30 i WAD3','Odczyt little endian, kontrola zakresów i indeksów, rekonstrukcja ścian, rozpakowanie palet i PVS.',formatCode],
  ['collision.js','Kolizje i hulle','Przejście po drzewie clipnodes, śledzenie ruchu bryły gracza oraz transformacje modeli encji.',collisionCode],
  ['renderer.js','Renderer Three.js','Budowanie siatek z Faces, atlasów lightmap i materiałów. Selekcja ścian przez PVS i frustum kamery.',rendererCode],
  ['runtime.js','Zachowanie encji','Spawny, teleporty, boosty, ruch drzwi i aktywowanie przycisków na podstawie danych BSP.',runtimeCode],
  ['textures.js','Filtrowanie tekstur','Przygotowanie mipmap, usuwanie obwódek koloru kluczującego i ustawienia materiałów maskowanych.',textureCode],
  ['entities.js','Parametry i zasoby encji','Klucze świata, lokalne nazwy WAD, tryby użycia i tablice dźwięków.',entityCode],
  ['audio.js','Dźwięki przestrzenne','Odtwarzanie lokalnych WAV, pozycje źródeł, pętle drzwi i pauza.',audioCode],
  ['effects.js','Efekty mapy','Krótkotrwałe odłamki wizualne bez przedmiotów i uzbrojenia.',effectCode],
];
const $=id=>document.getElementById(id),number=n=>n.toLocaleString('pl-PL'),hex=n=>'0x'+n.toString(16).toUpperCase().padStart(8,'0');
function el(tag,text,className){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(className)e.className=className;return e;}
function button(text,action,className){const b=el('button',text,className);b.type='button';b.onclick=action;return b;}
let map,bytes,report,fileName='',selection={kind:'overview'},tab='data',generation=0;
const content=$('content');
function select(next){selection=next;tab='data';render();for(const row of document.querySelectorAll('[data-selection]'))row.classList.toggle('active',row.dataset.selection===JSON.stringify(next));$('main').scrollTop=0;}
function row(label,next,small){const b=button('',()=>select(next),'tree-row');b.append(el('span',label));if(small!==undefined)b.append(el('small',small));b.dataset.selection=JSON.stringify(next);b.classList.toggle('active',JSON.stringify(next)===JSON.stringify(selection));return b;}
function buildTree(){
  const tree=$('tree');tree.replaceChildren();if(!map)return;
  tree.append(row(fileName,{kind:'overview'},'BSP 30'));
  tree.append(row('Obsługa i nieznane dane',{kind:'report'},'RAPORT'));
  const query=$('search').value.trim().toLowerCase();tree.append(el('div','DANE PLIKU','tree-label'));
  lumps.forEach((spec,id)=>{
    const raw=[4,8].includes(id),total=countOf(map,id),allMatch=`${spec.key} ${spec.title} ${id}`.toLowerCase().includes(query);
    const matches=[];if(!raw)for(let i=0;i<total;i++)if(!query||allMatch||`${i} ${recordName(map,id,i)}`.toLowerCase().includes(query))matches.push(i);
    if(query&&!allMatch&&!matches.length)return;
    const d=el('details',undefined,'branch'),s=el('summary');s.append(el('span',String(id).padStart(2,'0'),'tree-id'),el('span',spec.key),el('small',number(raw?map.lumps[id].length:total)+(raw?' B':'')));d.append(s);
    const children=el('div',undefined,'branch-children');d.append(children);let loaded=false;
    const populate=()=>{if(loaded)return;loaded=true;children.append(row('Opis i struktura',{kind:'lump',id}));let shown=0;
      const more=button('Pokaż kolejne 100',()=>append(),'more');
      function append(){more.remove();for(const index of matches.slice(shown,shown+100))children.append(row(`[${index}] ${recordName(map,id,index)}`,{kind:'record',id,index}));shown+=100;if(shown<matches.length)children.append(more);}
      append();
    };
    d.addEventListener('toggle',()=>{if(d.open)populate();});if(query){populate();d.open=true;}tree.append(d);
  });
  tree.append(el('div','KOD SILNIKA','tree-label'));
  modules.forEach(([name,title],index)=>{if(!query||`${name} ${title}`.toLowerCase().includes(query))tree.append(row(name,{kind:'source',index},'JS'));});
}
function heading(kicker,title,description){content.append(el('div',kicker,'eyebrow'),el('h1',title));if(description)content.append(el('p',description,'intro'));}
function cards(items){const grid=el('div',undefined,'cards');for(const [label,value] of items){const c=el('div',undefined,'card');c.append(el('span',label),el('strong',value));grid.append(c);}content.append(grid);}
function table(headers,rows){const wrap=el('div',undefined,'table-wrap'),t=el('table'),head=el('thead'),tr=el('tr');headers.forEach(h=>tr.append(el('th',h)));head.append(tr);t.append(head);const body=el('tbody');rows.forEach(values=>{const r=el('tr');values.forEach(value=>{const cell=el('td');cell.append(value instanceof Node?value:document.createTextNode(String(value)));r.append(cell);});body.append(r);});t.append(body);wrap.append(t);return wrap;}
function showCode(code,needle){
  const lines=el('div',undefined,'source-code'),target=needle?code.split('\n').findIndex(line=>line.includes(needle)):-1;
  code.split('\n').forEach((line,i)=>{const row=el('div',undefined,i===target?'code-line highlighted':'code-line');row.append(el('span',String(i+1),'line-number'),el('code',line||' '));lines.append(row);});
  content.append(lines);if(target>=0)requestAnimationFrame(()=>{lines.scrollTop=Math.max(0,target*22-88);});
}
function tabs(){const bar=el('div',undefined,'tabs');for(const [id,name] of [['data','Dane i opis'],['hex','Bajty / HEX'],['code','Kod parsera']]){const b=button(name,()=>{tab=id;render();},tab===id?'selected':'');b.setAttribute('aria-pressed',String(tab===id));bar.append(b);}content.append(bar);}
function hexView(range){
  let page=0;const total=Math.ceil(range.length/256),controls=el('div',undefined,'hex-controls'),output=el('pre',undefined,'hex'),info=el('span');
  const prev=button('← Poprzednie',()=>{page--;update();}),next=button('Następne →',()=>{page++;update();});controls.append(prev,info,next);content.append(el('p','Offsety po lewej są bezwzględne, liczone od początku pliku. Po prawej: interpretacja ASCII.','note'),controls,output);
  function update(){const start=range.offset+page*256,end=Math.min(range.offset+range.length,start+256),lines=[];
    for(let i=start;i<end;i+=16){const block=bytes.subarray(i,Math.min(i+16,end));lines.push(`${hex(i)}  ${Array.from(block,v=>v.toString(16).padStart(2,'0')).join(' ').padEnd(47)}  ${Array.from(block,v=>v>=32&&v<127?String.fromCharCode(v):'·').join('')}`);}
    output.textContent=lines.join('\n')||'Ta sekcja jest pusta.';info.textContent=`${number(range.length)} B · strona ${total?page+1:0} / ${total}`;prev.disabled=page===0;next.disabled=page+1>=total;
  }update();
}
function jsonTree(value,label='dane',depth=0){
  if(value===null||typeof value!=='object')return el('code',`${label}: ${JSON.stringify(value)}`,'value');
  const entries=Object.entries(value),d=el('details',undefined,'object'),s=el('summary',`${label}  ${Array.isArray(value)||ArrayBuffer.isView(value)?'['+entries.length+']':'{'+entries.length+'}'}`);d.append(s);let ready=false;
  function populate(){if(ready)return;ready=true;for(const [key,v] of entries.slice(0,100))d.append(jsonTree(v,key,depth+1));if(entries.length>100)d.append(el('p',`Podgląd pierwszych 100 z ${number(entries.length)} wartości.`,'note'));}
  d.addEventListener('toggle',()=>{if(d.open)populate();});if(depth===0){populate();d.open=true;}return d;
}
function texturePreview(texture){
  if(texture.external){content.append(el('p','Tekstura zewnętrzna — BSP zawiera nazwę i wymiary. Piksele należy odczytać z WAD.','notice'));return;}
  const strip=el('div',undefined,'mipmaps');texture.mipmaps.forEach((m,i)=>{const figure=el('figure'),canvas=el('canvas');canvas.width=m.width;canvas.height=m.height;canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(m.data),m.width,m.height),0,0);figure.append(canvas,el('figcaption',`MIP ${i} · ${m.width} × ${m.height}`));strip.append(figure);});content.append(strip);
}
function overview(){
  heading('GOLDSRC / BSP 30',fileName,'Mapa od środka. Rozwiń sekcję po lewej, wybierz rekord i prześledź jego powiązania. Dane pochodzą bezpośrednio z parsera używanego przez grę.');
  cards([['ROZMIAR PLIKU',number(bytes.length)+' B'],['SEKCJE / LUMPS','15'],['ŚCIANY',number(map.faces.length)],['ENCJE',number(map.entities.length)]]);
  content.append(button('Sprawdź obsługę encji, nieznane dane i zasoby →',()=>select({kind:'report'}),'report-link'));
  const banner=el('div',undefined,'notice');banner.append(el('strong','Od pliku do obrazu'),el('p','Nagłówek → 15 sekcji → walidacja indeksów → rekonstrukcja ścian → tekstury i światło → renderer. Kolizje korzystają z osobnych drzew clipnodes.'));content.append(banner);
  content.append(el('h2','Katalog sekcji'),table(['ID / sekcja','Znaczenie','Offset','Rozmiar','Rekordy'],lumps.map((s,id)=>[button(`${String(id).padStart(2,'0')}  ${s.key}`,()=>select({kind:'lump',id}),'link'),s.title,hex(map.lumps[id].offset),number(map.lumps[id].length)+' B',[4,8].includes(id)?'strumień':number(countOf(map,id))])));
  content.append(el('h2','Nagłówek · 124 bajty'),table(['Pole','Typ','Offset','Opis'],[['version','int32',0,'Wersja formatu: 30.'],['lumps[15]','{ int32 offset; int32 length; }',4,'15 wpisów po 8 bajtów, w kolejności katalogu powyżej. Wszystkie liczby little endian.']]));
}
function badge(status){return el('span',statusNames[status],`badge ${status}`);}
function reportView(){
  heading('DIAGNOSTYKA / ZAKRES OBSŁUGI','Obsługa i nieznane dane','Poprawny odczyt pliku nie oznacza pełnej obsługi zachowania mapy. Ten raport porównuje dane z możliwościami obecnego silnika; nie jest pełnym walidatorem encji CS.');
  cards([['KLASY NIEZNANE',String(report.classes.filter(c=>c.status==='unknown').length)],['KLASY NIEOBSŁUGIWANE',String(report.classes.filter(c=>c.status==='unsupported').length)],['KLASY CZĘŚCIOWE',String(report.classes.filter(c=>c.status==='partial').length)],['TEKSTURY Z WAD',String(report.external.length)]]);
  content.append(el('h2','Klasy encji'),table(['Klasa / pierwszy wpis','Liczba','Status','Zakres'],report.classes.map(c=>[button(c.name,()=>select({kind:'record',id:0,index:c.indices[0]}),'link'),c.indices.length,badge(c.status),c.description])));
  content.append(el('h2',`Właściwości i wartości wymagające uwagi · ${report.findings.length}`));
  const list=el('div',undefined,'findings');content.append(list);let shown=0;const more=button('Pokaż kolejne 100 uwag',append);
  function append(){more.remove();for(const f of report.findings.slice(shown,shown+100)){const card=el('div',undefined,'finding');card.append(badge(f.status),el('p',f.message),button(`${lumps[f.lump].key}[${f.index}] →`,()=>select({kind:'record',id:f.lump,index:f.index}),'link'));list.append(card);}shown+=100;if(shown<report.findings.length)list.append(more);}append();
  if(!report.findings.length)list.append(el('p','Nie wykryto dodatkowych nieznanych wartości w sprawdzanym zakresie.','note'));
  content.append(el('h2','Zasoby zewnętrzne'),el('p','Inspektor nie rozwiązuje WAD ani plików nieba. Poniższa lista oznacza zależności BSP, nie potwierdzone braki tekstur w grze.','note'));
  const resources=el('div',undefined,'references');report.external.forEach(({t,index})=>resources.append(button(t.name,()=>select({kind:'record',id:2,index}),'reference')));content.append(resources);
  content.append(el('h2','Bajty poza standardowymi sekcjami'),el('p','Krótkie luki mogą być wyrównaniem. Niezerowe dane mogą zawierać rozszerzenia lub metadane; nie są automatycznie uznawane za uszkodzenie. BSPX nie jest interpretowane.','note'));
  content.append(table(['Offset','Rozmiar','Zawartość','Podgląd'],report.gaps.map(g=>[hex(g.offset),g.length+' B',g.nonzero?'Nieznane dane niezerowe':'Zera / możliwe wyrównanie',button('HEX →',()=>select({kind:'range',range:g}),'link')])));
  content.append(el('p','Obsługiwany format: standardowy GoldSrc BSP 30. BSP2, BSPX i Source BSP nie są interpretowane przez ten parser. Nietypowa wersja lub uszkodzona struktura daje jawny błąd odczytu.','notice'));
}
function render(){
  content.replaceChildren();if(!map)return;
  if(selection.kind==='overview'){overview();return;}
  if(selection.kind==='report'){reportView();return;}
  if(selection.kind==='range'){heading('DANE POZA SEKCJAMI',hex(selection.range.offset),'Bajty nieprzypisane do standardowego nagłówka ani 15 sekcji BSP.');hexView(selection.range);return;}
  if(selection.kind==='source'){const [name,title,description,code]=modules[selection.index];heading('KOD SILNIKA / SRC / BSP',name,`${title}. ${description}`);content.append(el('p','Rzeczywisty kod projektu, tylko do odczytu.','note'));showCode(code);return;}
  const {id,index}=selection,spec=lumps[id],isRecord=selection.kind==='record',range=isRecord?recordRange(map,bytes,id,index):map.lumps[id];
  heading(`LUMP ${String(id).padStart(2,'0')} / ${spec.title.toUpperCase()}`,isRecord?recordName(map,id,index):spec.key,spec.description);
  cards([['OFFSET',hex(range.offset)],['ROZMIAR',number(range.length)+' B'],['FORMAT',spec.stride?spec.stride+' B / rekord':'zmienna długość'],['INDEKS',isRecord?String(index):number(countOf(map,id))+([4,8].includes(id)?' bajtów':' rekordów')]]);tabs();
  if(tab==='hex'){if(isRecord&&id===0)content.append(el('p','Encja jest częścią tekstu o zmiennej długości — poniżej bajty całej sekcji Entities.','notice'));if(isRecord&&id===2)content.append(el('p','Poniżej nagłówek miptex (lub wpis −1 w katalogu). Offsety mipmap są względne wobec początku miptex.','note'));hexView(range);return;}
  if(tab==='code'){showCode(formatCode,spec.parser);return;}
  if(isRecord){
    const value=map[spec.key][index],refs=references(id,value).filter(r=>r.index>=0&&r.index<countOf(map,r.lump));
    if(refs.length){content.append(el('h2','Powiązania'));const links=el('div',undefined,'references');refs.forEach(r=>links.append(button(`${r.label} → ${lumps[r.lump].key}[${r.index}]`,()=>select({kind:'record',id:r.lump,index:r.index}),'reference')));content.append(links);}
    if(id===2)texturePreview(value);
    if(id===0){const [status,description]=entitySupport(value);const info=el('div',undefined,'notice');info.append(badge(status),el('p',description));content.append(info);const notes=entityNotes(value);if(notes.length){content.append(el('h2','Obsługa właściwości'),table(['Status','Informacja'],notes.map(n=>[badge(n.status),n.message])));}}
    content.append(el('h2','Sparsowane dane'),jsonTree(id===2?{...value,mipmaps:value.mipmaps.map(({width,height,data})=>({width,height,rgbaBytes:data.length}))}:value,`${spec.key}[${index}]`));
  }
  if(spec.fields.length){content.append(el('h2',id===2?'Układ nagłówka miptex':'Układ rekordu binarnego'),table(['Pole','Typ','Offset w rekordzie','Opis'],spec.fields.map(([name,type,offset,description])=>[name,type,'+'+offset,description])));}
  if(!isRecord&&![4,8].includes(id)){content.append(el('h2','Rekordy'),el('p','Pierwsze 20 wpisów. Pełna lista z wyszukiwaniem i kolejnymi partiami znajduje się w rozwijanym drzewie.','note'));const list=el('div',undefined,'record-list');for(let i=0;i<Math.min(20,countOf(map,id));i++)list.append(button(`[${i}] ${recordName(map,id,i)} →`,()=>select({kind:'record',id,index:i})));content.append(list);}
  if([4,8].includes(id))content.append(el('p','To strumień bajtów, nie tablica rekordów o stałym rozmiarze. Otwórz zakładkę „Bajty / HEX”, żeby zobaczyć zawartość.','notice'));
}
async function load(buffer,name,ticket){
  if(ticket!==generation)return;
  try{if(buffer.byteLength>64*1024*1024)throw new Error('Limit podglądu to 64 MB.');const nextBytes=new Uint8Array(buffer),nextMap=parseBsp(nextBytes);bytes=nextBytes;map=nextMap;report=diagnose(map,bytes);fileName=name;selection={kind:'overview'};$('search').value='';buildTree();render();$('status').textContent='';$('file-status').textContent=`${name} · BSP ${map.version} · ${number(bytes.length)} B · sparsowano poprawnie`;}
  catch(error){$('status').textContent=`Nie można otworzyć pliku: ${error.message}${map?' Poprzednia mapa pozostaje dostępna.':''}`;}
}
$('open-file').onclick=()=>$('file').click();
$('file').onchange=async event=>{const file=event.target.files[0];if(!file)return;const ticket=++generation;$('status').textContent='Odczyt pliku…';try{if(file.size>64*1024*1024)throw new Error('Limit podglądu to 64 MB.');await load(await file.arrayBuffer(),file.name,ticket);}catch(error){if(ticket===generation)$('status').textContent=error.message;}event.target.value='';};
let searchTimer;$('search').oninput=()=>{clearTimeout(searchTimer);searchTimer=setTimeout(buildTree,150);};
$('collapse').onclick=()=>document.querySelectorAll('#tree details').forEach(d=>d.open=false);
const ticket=++generation;
fetch(new URL('../../surf_ski_2.bsp',import.meta.url)).then(response=>{if(!response.ok)throw new Error(`HTTP ${response.status}`);return response.arrayBuffer();}).then(buffer=>load(buffer,'surf_ski_2.bsp',ticket)).catch(error=>{if(ticket===generation)$('status').textContent='Błąd wczytywania mapy: '+error.message;});

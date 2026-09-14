const support={
  worldspawn:['supported','Geometria, lightmapy, skyname, lista lokalnych WAD i MaxRange. Pozostałe klucze mają osobną diagnostykę.'],
  info_player_start:['supported','Pozycja i kąty punktu startowego.'],info_player_deathmatch:['supported','Alternatywny punkt startowy.'],info_target:['supported','Pozycja celu encji.'],info_teleport_destination:['supported','Pozycja celu teleportu.'],
  func_wall:['supported','Statyczna bryła, kolizja, materiał i przełączanie alternatywnej tekstury.'],func_illusionary:['supported','Statyczna geometria bez kolizji; skin określa opcjonalną zawartość cieczy.'],func_ladder:['supported','Objętość drabiny, kierunek wspinania i usuwanie przez killtarget.'],
  func_water:['partial','Ruch jak func_door, target/killtarget, wait, start-open; transformowana objętość cieczy i falowanie. Niepełne flagi drzwi i efekty optyczne.'],
  func_door:['partial','Start-open, toggle, use-only, passable, lip/speed/wait, cele po zakończeniu ruchu, blokowanie i dmg, dźwięki. Niepełne grupowanie drzwi i zdania głosowe.'],
  func_door_rotating:['partial','Osie, kierunek, powrót, blokowanie i dźwięki. Klapa opuszcza gracza bez przenikania; kierunek od gracza i złożone kontakty obrotowe pozostają uproszczone.'],
  func_button:['partial','Dont-move, touch-only, toggle, wait i cel po dojściu, dźwięki oraz API aktywacji obrażeniami. Brak iskier i zdań głosowych.'],
  trigger_push:['partial','Pełna obsługa przyspieszenia gracza: start-off, push-once, sumowanie pól i wyjście. Pola nie wpływają jeszcze na skrzynki i inne obiekty.'],
  trigger_teleport:['partial','Filtr no-clients, master, przełączanie aktywności, kąty celu, keep-angles/velocity, przekierowanie prędkości i landmark. Dotyczy lokalnego gracza.'],
  trigger_hurt:['partial','Obrażenia lub leczenie co 0,5 s, start-off, no-clients, target-once i respawn po śmierci. Brak specjalnych typów obrażeń i radiacji.'],
  trigger_multiple:['supported','Powtarzanie przy stałym kontakcie po wait, filtr gracza, master i opóźnione cele.'],trigger_once:['supported','Jednorazowa aktywacja, master, no-clients i opóźnione cele.'],trigger_relay:['supported','Tryby off/on/toggle, delay, killtarget i jednorazowe użycie.'],multi_manager:['partial','Kolejka opóźnionych celów, sufiksy # i ponowne uruchomienie. Uproszczona współbieżność; bez rund serwera.'],multisource:['partial','Bramka master wymagająca wszystkich wejść; brak globalstate.'],
  func_wall_toggle:['supported','Start-off, przełączanie renderowania i kolizji.'],func_breakable:['partial','Zdrowie, trigger-only, touch/pressure, materiał, dźwięk, cele i wizualne odłamki. Brak pełnych modeli odłamków oraz wybuchów. Przedmioty wyłączone z zakresu.'],func_pushable:['partial','Pchanie przy kontakcie i E, limit zależny od friction, grawitacja i przybliżona wyporność buoyancy. Próbkowanie kolizji bryły; brak pełnego PUSHSTEP, ciągnięcia i stosów skrzynek.'],
  light:['supported','Oświetlenie kompilowane w lightmapach, przełączanie stylów i wzorce pattern. Statyczne światło nie wymaga dynamicznej lampy.'],light_spot:['supported','Reflektor kompilowany w lightmapach; przełączane style i pattern. Brak dynamicznego reflektora jest zgodny z tą klasą.'],light_environment:['supported','Oświetlenie kierunkowe kompilowane w lightmapach; nie jest dynamiczną lampą.'],
  armoury_entity:['excluded','Uzbrojenie i zbieranie wyposażenia świadomie pominięte zgodnie z zakresem projektu.'],func_buyzone:['excluded','Zakupy świadomie pominięte. Strefa nie wpływa na obraz ani kolizję.'],func_bomb_target:['excluded','Logika uzbrojenia i podkładania bomby poza zakresem.'],func_hostage_rescue:['unsupported','Brak zakładników i ratowania.'],ambient_generic:['unsupported','Brak pełnej obsługi encji dźwięków otoczenia.'],env_sprite:['unsupported','Brak renderowania sprite’ów.'],env_model:['unsupported','Brak renderowania modeli MDL.'],
};
export const statusNames={supported:'Obsługa podstawowa',partial:'Częściowo',unsupported:'Nieobsługiwane',excluded:'Poza zakresem',unknown:'Nieznane',info:'Informacja'};
export const entitySupport=e=>Object.hasOwn(support,e.classname)?support[e.classname]:['unknown','Brak dedykowanej obsługi tej klasy w obecnym silniku. Parser zachowuje jej klucze; bryła *N może nadal otrzymać ogólne renderowanie lub kolizję.'];
const common=new Set('classname origin angles angle model target targetname killtarget delay master spawnflags rendermode renderamt rendercolor renderfx'.split(' '));
const moving='lip wait speed skin WaveHeight netname movesnd stopsnd locked_sound unlocked_sound';
const classKeys={worldspawn:'skyname wad mapversion MaxRange',info_player_start:'',info_player_deathmatch:'',func_door:moving,func_door_rotating:moving+' distance',func_button:moving+' health sounds',trigger_push:'speed',trigger_teleport:'landmark',trigger_multiple:'wait',trigger_once:'wait',trigger_hurt:'dmg',trigger_relay:'triggerstate',func_water:moving,func_breakable:'health material',func_pushable:'health material friction buoyancy',func_illusionary:'skin',light:'style pattern pitch',light_spot:'style pattern pitch',light_environment:'style pattern pitch'};
const ignored=new Set('health dmg sounds stopsnd movesnd unlocked_sentence locked_sentence unlocked_sound locked_sound explodemagnitude spawnobject explosion material buoyancy friction size team count item MaxRange'.split(' '));
export function entityNotes(e){
  const notes=[];if(entitySupport(e)[0]==='excluded')return [{status:'info',message:'Klucze zachowane do podglądu; ta funkcja jest świadomie poza zakresem projektu.'}];for(const key of Object.keys(e)){
    if(['func_door','func_door_rotating','func_water'].includes(e.classname)&&key==='dmg')continue;
    if(common.has(key)||(Object.hasOwn(classKeys,e.classname)?classKeys[e.classname]:'').split(' ').includes(key))continue;
    if(e.classname==='multi_manager'&&Number.isFinite(Number(e[key])))continue;
    if(key.startsWith('_')||key.startsWith('zhlt_')){notes.push({status:'info',message:`${key}: parametr kompilacji/światła, zachowany jako tekst; brak odrębnego przetwarzania w runtime.`});continue;}
    notes.push({status:ignored.has(key)?'unsupported':'unknown',message:`${key} = ${e[key]}: ${ignored.has(key)?'brak realizacji tej właściwości w obecnym runtime.':'brak zadeklarowanej interpretacji tego klucza; wartość pozostaje dostępna w danych.'}`});
  }
  const mode=Number(e.rendermode||0),fx=Number(e.renderfx||0);
  if(!Number.isInteger(mode)||mode<0||mode>5)notes.push({status:'unknown',message:`rendermode ${e.rendermode}: nieznany tryb materiału.`});
  if(![0,1,2,3,4,9,10,11,12,13].includes(fx))notes.push({status:'unsupported',message:`renderfx ${e.renderfx}: efekt nie jest zaimplementowany.`});
  if(e.spawnflags&&Number(e.spawnflags)!==0)notes.push({status:'info',message:`spawnflags ${e.spawnflags}: pole zostało odczytane, ale kompletność interpretacji flag zależy od klasy. Nie oznacza pełnej zgodności z CS.`});
  return notes;
}
export function unclaimedRanges(map,bytes){
  const segments=[{offset:0,length:124},...map.lumps].filter(r=>r.length).sort((a,b)=>a.offset-b.offset),gaps=[];let end=0;
  const add=(offset,length)=>{if(!length)return;const data=bytes.subarray(offset,offset+length),nonzero=data.some(v=>v!==0);gaps.push({offset,length,nonzero});};
  for(const part of segments){if(part.offset>end)add(end,part.offset-end);end=Math.max(end,part.offset+part.length);}if(end<bytes.length)add(end,bytes.length-end);return gaps;
}
export function diagnose(map,bytes){
  const classes=new Map();map.entities.forEach((e,index)=>{const name=e.classname||'(brak classname)';if(!classes.has(name))classes.set(name,{name,status:entitySupport(e)[0],description:entitySupport(e)[1],indices:[]});classes.get(name).indices.push(index);});
  const findings=[];map.entities.forEach((e,index)=>{for(const note of entityNotes(e))if(note.status!=='info')findings.push({...note,lump:0,index});if(/^\*\d+$/.test(e.model||'')&&Number(e.model.slice(1))>=map.models.length)findings.push({status:'unknown',message:`Model ${e.model} nie istnieje w sekcji Models.`,lump:0,index});});
  map.leaves.forEach((l,index)=>{if(![-1,-2,-3,-4,-5,-6].includes(l.contents))findings.push({status:'unknown',message:`contents ${l.contents}: poza zestawem nazwanych typów obecnego silnika.`,lump:10,index});});
  map.texinfo.forEach((t,index)=>{if(t.flags&~1)findings.push({status:'unknown',message:`flags ${t.flags}: nieznane bity poza TEX_SPECIAL.`,lump:6,index});});
  const external=map.textures.map((t,index)=>({t,index})).filter(({t})=>t.external),gaps=unclaimedRanges(map,bytes);
  return {classes:[...classes.values()],findings,external,gaps};
}

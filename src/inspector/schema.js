// Names and layouts mirror the actual reads in bsp/format.js.
const lump=(key,title,stride,description,fields,parser)=>({key,title,stride,description,fields,parser});
export const lumps=[
  lump('entities','Encje',0,'Tekstowe pary klucz–wartość opisują świat, spawny, teleporty, drzwi i inne obiekty. Model „*N” wskazuje wpis N w sekcji Models.',[], 'parseEntities'),
  lump('planes','Płaszczyzny',20,'Płaszczyzny dzielą przestrzeń. Punkt leży na płaszczyźnie, gdy dot(normal, punkt) = dist.',[['normal','float32[3]',0,'Wektor normalny płaszczyzny.'],['dist','float32',12,'Odległość od początku układu wzdłuż normalnej.'],['type','int32',16,'Typ osi: 0–2 osiowe X/Y/Z, 3–5 ogólne.']], 'planes:read'),
  lump('textures','Tekstury',0,'Katalog miptex: liczba tekstur, względne offsety i nagłówki. Piksele mogą być osadzone w BSP albo pochodzić z WAD. Ten podgląd pokazuje zawartość samego BSP.',[['name','char[16]',0,'Nazwa materiału; prefiks { oznacza maskę, + animację.'],['width','uint32',16,'Szerokość pełnej tekstury.'],['height','uint32',20,'Wysokość pełnej tekstury.'],['offsets','uint32[4]',24,'Offsety czterech mipmap od początku miptex; pierwszy równy 0 oznacza teksturę zewnętrzną.']], 'readMipTexture'),
  lump('vertices','Wierzchołki',12,'Punkty geometrii w oryginalnych współrzędnych GoldSrc: X/Y poziomo, Z w górę.',[['position','float32[3]',0,'Współrzędne X, Y, Z.']], 'vertices:read'),
  lump('visibility','Widoczność / PVS',0,'Skompresowane bitsety potencjalnie widocznych liści. Bajt 0 rozpoczyna RLE: następny bajt podaje liczbę zer. Liść wskazuje początek swojego wiersza przez visOffset.',[], 'visibleLeaves'),
  lump('nodes','Węzły BSP',24,'Drzewo przestrzeni renderowanej. Dodatnie indeksy dzieci wskazują węzły, ujemne liście: indeks liścia = −child − 1.',[['plane','int32',0,'Płaszczyzna podziału.'],['children','int16[2]',4,'Dzieci po przedniej i tylnej stronie płaszczyzny.'],['mins','int16[3]',8,'Minimum obwiedni.'],['maxs','int16[3]',14,'Maksimum obwiedni.'],['firstFace','uint16',20,'Pierwsza ściana w sekcji Faces.'],['numFaces','uint16',22,'Liczba ścian węzła.']], 'nodes:read'),
  lump('texinfo','Mapowanie UV',40,'Dwie osie z przesunięciem przeliczają pozycję 3D na współrzędne tekstury w pikselach: u = dot(p, s.xyz) + s.w.',[['s','float32[4]',0,'Oś U i przesunięcie.'],['t','float32[4]',16,'Oś V i przesunięcie.'],['texture','int32',32,'Indeks katalogu tekstur.'],['flags','int32',36,'Flagi powierzchni; bit 1 oznacza TEX_SPECIAL.']], 'texinfo:read'),
  lump('faces','Ściany',20,'Wielokąty odsyłają do płaszczyzny, UV i łańcucha krawędzi. Parser wylicza dodatkowo vertices, uv i rozmiar lightmapy — te pola nie są zapisane bezpośrednio w rekordzie.',[['plane','uint16',0,'Indeks płaszczyzny.'],['side','int16',2,'Strona płaszczyzny; 1 odwraca normalną.'],['firstEdge','int32',4,'Początek zakresu w Surfedges.'],['numEdges','uint16',8,'Liczba krawędzi wielokąta.'],['texinfo','uint16',10,'Indeks parametrów UV.'],['styles','uint8[4]',12,'Style oświetlenia, 255 oznacza niewykorzystany slot.'],['lightOffset','int32',16,'Offset bajtowy do Lighting; −1 oznacza brak lightmapy.']], 'faces:read'),
  lump('lighting','Oświetlenie',0,'Próbki RGB8 lightmap. Wymiary i liczba warstw wynikają z UV ściany oraz jej stylów. Próbka przypada na 16 jednostek współrzędnych tekstury.',[], 'lighting:bytes'),
  lump('clipnodes','Węzły kolizji',8,'Osobne drzewa kolizji dla przygotowanych brył gracza. Ujemne dzieci to bezpośrednio typ zawartości (np. −1 pusto, −2 bryła), a nie indeksy liści.',[['plane','int32',0,'Płaszczyzna testu kolizji.'],['children','int16[2]',4,'Dzieci lub ujemne kody zawartości.']], 'clipnodes:read'),
  lump('leaves','Liście',28,'Końcowe obszary drzewa BSP. Określają zawartość, widoczność i listę ścian należących do obszaru.',[['contents','int32',0,'−1 pusto, −2 bryła, −3 woda, −4 szlam, −5 lawa, −6 niebo.'],['visOffset','int32',4,'Offset w skompresowanym PVS; −1 oznacza brak wiersza.'],['mins','int16[3]',8,'Minimum obwiedni liścia.'],['maxs','int16[3]',14,'Maksimum obwiedni liścia.'],['firstMark','uint16',20,'Początek zakresu w Marksurfaces.'],['numMarks','uint16',22,'Liczba odwołań do ścian.'],['ambient','uint8[4]',24,'Poziomy dźwięków otoczenia.']], 'leaves:read'),
  lump('marks','Odwołania do ścian',2,'Marksurfaces łączą liście ze ścianami. Każdy wpis jest indeksem w Faces.',[['face','uint16',0,'Indeks ściany.']], 'marks:read'),
  lump('edges','Krawędzie',4,'Każda krawędź zawiera indeksy dwóch wierzchołków. Kierunek użycia jest zapisany osobno w Surfedges.',[['vertices','uint16[2]',0,'Indeksy początku i końca krawędzi.']], 'edges:read'),
  lump('surfedges','Skierowane krawędzie',4,'Dodatnia wartość wybiera początek krawędzi, ujemna jej koniec. Wartość bezwzględna wskazuje rekord w Edges.',[['edge','int32',0,'Indeks krawędzi ze znakiem kierunku.']], 'surfedges:read'),
  lump('models','Modele',64,'Model 0 to statyczny świat. Modele *1, *2… są bryłami encji, np. drzwiami lub triggerami. Każdy model ma zakres ścian i korzenie hullów.',[['mins','float32[3]',0,'Minimum obwiedni.'],['maxs','float32[3]',12,'Maksimum obwiedni.'],['origin','float32[3]',24,'Początek modelu.'],['headnodes','int32[4]',36,'Korzenie hullów: 0 render/punkt, 1 stojący, 2 duży, 3 kucający.'],['visLeaves','int32',52,'Liczba liści widoczności modelu.'],['firstFace','int32',56,'Pierwsza ściana modelu.'],['numFaces','int32',60,'Liczba ścian modelu.']], 'models:read'),
];
export const countOf=(map,id)=>map[lumps[id].key].length;
export function recordName(map,id,index){
  const value=map[lumps[id].key][index];
  if(id===0)return `${value.classname||'encja'}${value.targetname?' · '+value.targetname:''}${value.model?' · '+value.model:''}`;
  if(id===2)return `${value.name} · ${value.width}×${value.height}${value.external?' · WAD':''}`;
  if(id===14)return index===0?'worldspawn':`*${index} · ${map.entities.find(e=>e.model===`*${index}`)?.classname||'model'}`;
  return `${lumps[id].key}[${index}]`;
}
export function recordRange(map,bytes,id,index){
  const {offset,length}=map.lumps[id],{stride}=lumps[id];
  if(stride)return {offset:offset+index*stride,length:stride};
  if(id===2){const d=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),relative=d.getInt32(offset+4+index*4,true);return relative<0?{offset:offset+4+index*4,length:4}:{offset:offset+relative,length:40};}
  // Entities are variable-length text; show the full lump rather than inventing offsets.
  return {offset,length};
}
export function references(id,value){
  const refs=[],add=(lump,index,label)=>refs.push({lump,index,label});
  if(id===0&&/^\*\d+$/.test(value.model||''))add(14,Number(value.model.slice(1)),'model');
  if([5,7,9].includes(id))add(1,value.plane,'plane');
  if(id===6)add(2,value.texture,'texture');
  if(id===7){add(6,value.texinfo,'texinfo');add(13,value.firstEdge,'firstEdge');}
  if(id===5)for(const [i,child] of value.children.entries())add(child>=0?5:10,child>=0?child:-child-1,`children[${i}]`);
  if(id===9)for(const [i,child] of value.children.entries())if(child>=0)add(9,child,`children[${i}]`);
  if(id===10&&value.numMarks)add(11,value.firstMark,'firstMark');
  if(id===11)add(7,value,'face');
  if(id===12)value.forEach((v,i)=>add(3,v,`vertices[${i}]`));
  if(id===13)add(12,Math.abs(value),'edge');
  if(id===14){if(value.numFaces)add(7,value.firstFace,'firstFace');value.headnodes.forEach((n,i)=>{if(n>=0)add(i===0?5:9,n,`hull ${i}`);else if(i===0)add(10,-n-1,'hull 0');});}
  return refs;
}

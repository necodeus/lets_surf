# Renderer GoldSrc BSP 30

## Uruchomienie i zasoby

`surf_ski_2.bsp` z katalogu głównego ładuje się automatycznie. Vite dołącza go także do produkcyjnego `dist/`. Z instalacji Steam skopiowano `valve/halflife.wad` oraz sześć plików `cstrike/gfx/env/office*.tga` do `public/assets/goldsrc/`. Loader używa 9 tekstur osadzonych w BSP i 55 z WAD: łącznie 64/64. Osadzone grafiki autora mapy zachowują pierwszeństwo.

Aplikacja uruchamia wyłącznie `surf_ski_2`, bez strony startowej, selektora i importu innych map. Renderer pozostaje modułem BSP30, ale gra używa stałego zestawu zasobów w `public/assets/goldsrc/`.

Brak materiału daje jawną szachownicę i komunikat, a brak nieba daje jednolite tło. Parametry konsoli są zapisywane w pamięci przeglądarki. Pełne sterowanie i konfiguracja są opisane w [README](../README.md).

## Renderowanie

- Parser wszystkich 15 sekcji standardowego BSP 30, z kontrolą rozmiarów, indeksów, cykli drzew i zakresów danych.
- Geometria świata i modeli `*n`, signed surfedges, UV z wektorów `texinfo`, poprawna orientacja całych wielokątów. Punkty współliniowe dodane przez kompilator do naprawy T-junctions nie powodują już odwrócenia powierzchni i dziur.
- WAD3 oraz palety lokalne, cztery oryginalne poziomy mipmap i wygenerowany mniejszy ogon, filtrowanie anizotropowe. Tekstury `{` mają przezroczystość indeksu 255; ich mipmapy są odbudowane z maski pełnej rozdzielczości z ważeniem kolorów przez alfa i korektą pokrycia. Kolor kluczujący w przezroczystych pikselach zastępuje kolor sąsiednich prętów, bez zmiany oryginalnych widocznych pikseli. Zapobiega to niebieskim obwódkom oraz błędom oryginalnych mipmap `{bars` i `{grate2`. Sekwencje `+0…9` i alternatywne `+A…J` zmieniają klatki.
- Cztery warstwy RGB lightmap, atlas z marginesami zapobiegającymi przeciekom, style oświetlenia 10 Hz i przełączane światła encji. Powierzchnie bez lightmap mają osobny neutralny texel.
- Sześć oryginalnych ścian nieba TGA. Tło i ściany `sky` używają wspólnej projekcji z poprawioną orientacją boków oraz biegunów.
- Materiały zwykłe, maskowane, kolorowe, przezroczyste i addytywne; podstawowe efekty pulsowania, stroboskopu i migotania. Woda ma animowane UV, wysokość fali encji i mgłę pod wodą.
- Maskowane kraty z `rendermode 2` i `renderamt 255` korzystają z odcięcia alfa i zapisują głębokość. Ściany brushy są jednostronne, więc tylne powierzchnie cienkiej klatki nie dublują prętów; woda pozostaje dwustronna.
- PVS z liścia kamery, dekompresja RLE, odrzucanie liści poza frustum, grupowanie ścian według modelu i tekstury. Bufor indeksów aktualizuje widoczny fragment geometrii.

`surf_ski_2`: **4541 ścian, 50 modeli BSP, 7379 clipnodes, 64 tekstury**. Modele triggerów, drabin oraz powierzchnie narzędziowe nie są rysowane jako ściany. Licznik partii opisuje utworzone grupy geometrii; licznik ścian opisuje geometrię wybraną do renderowania, nie liczbę pikseli po teście głębokości.

## Połączenie z ruchem

Geometria renderowania i przygotowane przez kompilator hulle kolizji są odczytywane osobno z tego samego pliku. Hull 0 służy do zapytań punktowych, hull 1 do gracza stojącego, hull 3 do kucającego. Ślady uwzględniają oryginalne płaszczyzny ramp, `startsolid`, `allsolid`, margines 1/32 oraz transformacje modeli. Fizykę strafe, surf, bhop, duck i schodów wykonuje dotychczasowy `Player`.

Działają wszystkie 18 spawnów oraz 10 teleportów tej mapy, boosty `trigger_push` z zachowaniem prędkości po wyjściu z pola, flagami `push_once` i `start_off`, zawartość wody, objętości drabin, użycie przycisków, przesuwane i obrotowe drzwi, podstawowe cele/killtarget i przełączanie świateł. Cel teleportu jest pozycją stóp + 1 unit; punkt startowy gracza jest środkiem stojącego hulla. Zmiana modelu przez runtime jest wspólna dla obrazu i kolizji.

To renderer map i lokalny runtime ruchu. Nie obejmuje jeszcze modeli MDL, sprite'ów ani pełnego systemu encji serwera CS. Zakupy, bronie/armoury i walka są celowo poza zakresem. Działają dźwięki drzwi, przycisków i rozbijania; pełne encje dźwięków otoczenia nie są zaimplementowane. Przesuwanie skrzynek, wizualne odłamki, specjalne typy obrażeń oraz złożone kontakty platform obrotowych są uproszczone. Rozwiniętą obsługę stanów drzwi/przycisków, triggerów, dźwięków i materiałów opisuje [dokument encji](bsp-entities.md). Efekty wody, gamma i renderfx nie odtwarzają wszystkich wariantów oryginalnego renderera piksel w piksel. BSP2, Source BSP, WAD2 i rozszerzenia BSPX nie są obsługiwane.

## Sterowanie i diagnostyka

| Wejście / komenda | Działanie |
| --- | --- |
| `map surf_ski_2` / `map bsp` | Restart mapy surf_ski_2 |
| `R` / `restart` | Bieżący spawn |
| `E` | Użycie obiektu w zasięgu 128 units |
| `N` / `noclip 1` | Swobodny lot; `noclip 0` przywraca kolizje |
| `spawn_next` | Następny punkt startowy |
| `bsp_info` | Statystyki mapy i ostatnie zdarzenie |
| `r_novis 1` / `0` | Wyłączenie / przywrócenie PVS |
| `r_fullbright 1` / `0` | Wyłączenie / przywrócenie lightmap |
| `setpos x y z` | Origin w oryginalnych osiach GoldSrc, Z do góry |
| `setang pitch yaw` | Oryginalne kąty GoldSrc, w stopniach |

## Sprawdzenie

`tests/bsp.test.js` korzysta z dostarczonej mapy i oryginalnego WAD. Obejmuje komplet tekstur, maski alfa, wszystkie wiersze PVS, uszkodzone pliki, wszystkie spawny i teleporty, trace przez ściany, surf na rzeczywistej rampie, drabiny, pływanie, boosty, powiązane przyciski/drzwi, wspólny styl wielu świateł, atlas lightmap, osie nieba oraz orientację wszystkich 4541 ścian. Pozostałe testy ruchu i konsoli nadal obowiązują.

W podglądzie WebGL sprawdzono oryginalne tekstury i niebo, spawn oraz widok ramp. Test regresji orientacji wykrywa przypadek współliniowych początkowych wierzchołków odpowiedzialny za zgłoszone dziury. Diagnostyka GPU nie zgłasza błędów kompilacji shaderów.

## Referencje formatu i zachowania

- [Valve Half-Life SDK: bspfile.h](https://github.com/ValveSoftware/halflife/blob/master/utils/common/bspfile.h) — układ BSP30.
- [ReHLDS: pmovetst.cpp](https://github.com/rehlds/ReHLDS/blob/master/rehlds/engine/pmovetst.cpp) — trace po przygotowanych hullach.
- [ReHLDS: sv_user.cpp](https://github.com/rehlds/ReHLDS/blob/master/rehlds/engine/sv_user.cpp) — przekazanie basevelocity przy opuszczeniu pola przyspieszenia.
- [ReGameDLL_CS: triggers.cpp](https://github.com/rehlds/ReGameDLL_CS/blob/master/regamedll/dlls/triggers.cpp) — cele teleportów i push.
- [Xash3D FWGS: gl_warp.c](https://github.com/FWGS/xash3d-fwgs/blob/master/ref/gl/gl_warp.c) — konwencja kierunków i UV nieba GoldSrc.

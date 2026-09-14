# STRAFE / surf_ski_2

Lokalny prototyp FPS z ruchem inspirowanym CS 1.6 i rendererem GoldSrc BSP 30. Jedyną mapą gry jest dostarczona `surf_ski_2.bsp`. Gra wchodzi na nią automatycznie, bez strony startowej i wyboru map.

## Uruchomienie

Node.js 20.19+ lub 22.12+:

```sh
npm install
npm run dev
```

Otwórz **http://127.0.0.1:5173/**. Po wczytaniu mapy można od razu się poruszać. Pierwsze kliknięcie w mapę przechwytuje mysz; przeglądarka wymaga gestu użytkownika dla Pointer Lock. W podglądzie bez tej funkcji rozglądanie działa przez przeciąganie z LPM.

`~ / F1` otwiera konsolę i pauzuje ruch. `~ / F1 / Esc` ją zamyka i wznawia grę. Esc poza konsolą uwalnia mysz. Nie pojawia się ekran menu. Utrata fokusu lub ukrycie karty pauzuje fizykę i czyści przytrzymane wejścia.

HUD zawiera nazwę mapy, czas sesji, FPS, pole rekordu oraz dolne wskaźniki ruchu i klawiszy. Pole rekordu pozostaje puste, gdy nie ma zapisanego wyniku; oryginalna mapa nie ma wyznaczonej przez aplikację mety pomiarowej.

## Domyślne ustawienia i zapis

- `airaccelerate 100` (także alias `air_accelerate`), gravity 800, friction 4, accelerate 10.
- `stepsize 224` / `sv_stepsize 224`: zwiększona wysokość wejścia na przeszkodę pozwala wyjść ponad ścianą klatki (210 jednostek). Działa na całej mapie; klasyczna wartość to 18. Zakres komendy: 0–512. Stary domyślny zapis 18 migruje jednorazowo do 224, a późniejsze własne ustawienia są zachowywane.
- **FOV 90° w poziomie**, jak w klasycznym CS 1.6. Kamera Three.js dostaje przeliczony kąt pionowy, także po zmianie rozmiaru okna. Dla 4:3 wynosi on około 73,74°.
- Limiter bhopa i kary po skoku włączone, auto-bhop wyłączony, brak bufora skoku.
- Domyślne bindy: WASD ruch, spacja skok, oba Ctrl/Shift kucanie, kółko w górę impuls jump, kółko w dół chwilowy duck.

Zmiany komend konsoli zapisują się od razu w `localStorage` pod kluczem `strafe-settings`: fizyka, bindy (również własne klawisze), czułość, FOV, FPS i przełączniki BSP. Po odświeżeniu strony są odczytywane przed rozpoczęciem ruchu. Historia ostatnich 100 komend jest zapisana osobno; jej treść nie jest automatycznie wykonywana.

Stare pionowe FOV jest jednorazowo zastępowane poziomym 90°, a stare domyślne air acceleration 10 przechodzi na 100. Późniejsze własne wartości, również ponownie ustawione 10, pozostają zachowane. Uszkodzony zapis nie blokuje uruchomienia; ustawienia spoza zakresu zastępowane są domyślnymi. Pamięć przeglądarki dotyczy bieżącego originu; zablokowana lub wyczyszczona pamięć nie zachowuje konfiguracji.

Punkty odniesienia FOV: [klient Half-Life SDK](https://github.com/ValveSoftware/halflife/blob/master/cl_dll/hud_redraw.cpp) i [opis FOV 90 w CS 1.6 w repozytorium Valve](https://github.com/ValveSoftware/halflife/issues/1978). Domyślne air acceleration 100 jest ustawieniem tego projektu do surfowania; klasyczna referencja fizyki używa 10.

## Konsola i sterowanie

```text
help
friction 4
sv_accelerate 10
airaccelerate 100
gravity 800
fps_max 100
fps_max 300
fps_max 0
sensitivity 1
fov 90
bind space "+jump"
bind shift "+duck"
bind ctrl "+duck"
bind mwheelup "+jump"
bind mwheeldown "+duck"
bind f "+duck"
binds
reset_physics
restart
map surf_ski_2
bsp_info
spawn_next
noclip 1
r_fullbright 0
r_novis 0
```

Sama nazwa cvara odczytuje jego wartość. `reset_physics` przywraca domyślną fizykę projektu, w tym air acceleration 100, zachowując bindy, kamerę i limit FPS. Pozostałe cvars, m.in. `maxspeed`, `stopspeed`, `autobhop`, `enablebunnyhopping`, `jump_penalty`, `jumpbuffer`, `maxvelocity`, `stepsize`, są wymienione w `help`. Prefiks `sv_` jest opcjonalny. Konsola nie wykonuje JavaScript ani poleceń systemowych.

**R** resetuje spawn, **E** używa obiektu, **N** przełącza noclip. Klawisze 1–5 nie wybierają map. `map bsp` jest aliasem restartu bieżącej `surf_ski_2`. Nie ma importu i przełączania innych map w interfejsie.

## Renderer i fizyka

BSP dostarcza 4541 ścian, 50 modeli oraz 7379 clipnodes. Wczytywane są wszystkie 64 tekstury: 9 z mapy i 55 z lokalnego `halflife.wad`, a także oryginalne niebo `office`. Działają lightmapy, animowane/maskowane materiały, PVS, kolizje po przygotowanych hullach, teleporty, boosty, woda, drabiny i podstawowe encje interaktywne. Po wyjściu z pola `trigger_push` jego pozostała prędkość jest jednorazowo przekazywana graczowi, zgodnie z [SV_CheckMovingGround w ReHLDS](https://github.com/rehlds/ReHLDS/blob/master/rehlds/engine/sv_user.cpp). Pionowa składowa jest wcześniej konsumowana przez krok grawitacji; nie daje dodatkowego impulsu przy opuszczeniu pola.

[Zakres renderera i jego ograniczenia](docs/bsp-renderer.md). [Historyczny audyt ruchu względem ReGameDLL_CS](docs/regamedll-audit.md). To własna implementacja ruchu i lokalnego runtime; nie jest portem kompletnego silnika ani serwera CS.

## Sprawdzenie

```sh
npm test
npm run build
npm run preview
```

133 testy obejmują inspektor i diagnostykę, BSP, geometrię, maski i filtrowanie krat, ruch, konsolę, limiter klatek, trwały zapis i przeliczenie FOV. Dawne mapy treningowe zostały usunięte z kodu gry; ich geometria pozostała wyłącznie w `tests/fixtures/movement-world.js` do testów regresji fizyki i nie trafia do aplikacji.

Licznik FPS mierzy faktycznie narysowane klatki; `fps_max` nie zmienia tickrate fizyki 128 Hz. Limit jest maksimum, nie gwarantowaną liczbą klatek: [requestAnimationFrame zależy od odświeżania przeglądarki](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame).

## Inspektor struktury BSP

Otwórz [BSP Atlas](http://127.0.0.1:5173/bsp.html): rozwijane sekcje i rekordy, opisy pól, powiązania, HEX, kod parsera oraz raport elementów nieznanych i nieobsługiwanych. Domyślnie wczytuje `surf_ski_2`; można też otworzyć lokalny BSP30. Więcej: [opis inspektora](docs/bsp-inspector.md).


## Obsługa encji mapy

Runtime obsługuje stany drzwi i przycisków (w tym nieruchomy przycisk klatki), flagi start-open/toggle/use-only/touch-only/passable, cele uruchamiane po zakończeniu ruchu, `delay`, `killtarget`, `wait`, przełączanie on/off i bramkę `multisource`. Ruchome bryły przenoszą gracza i wycofują ruch po zablokowaniu; klapa klatki pozwala spaść w dół. Woda może poruszać się jak encja drzwi. Teleporty uwzględniają no-clients, kąty celu, keep-angles/velocity i landmark.

Są też środowiskowe obrażenia/leczenie, zdrowie brył breakable, rozbijanie przez trigger, nacisk i odpowiednio silne zderzenie, wizualne odłamki, grawitacja skrzynek oraz przybliżona wyporność i kolizje przy pchaniu. Rozbijanie przez samo `E` usunięto: oryginalny breakable nie jest przyciskiem. Dźwięki drzwi/przycisków/rozbijania pochodzą z lokalnych plików Half-Life i uruchamiają się po kliknięciu w grę. Konsola i utrata fokusu pauzują dźwięk.

Świat odczytuje listę nazw WAD, `skyname` oraz `MaxRange`; zasoby muszą być dostępne lokalnie w `public/assets/goldsrc`. Klasy `light`, `light_spot` i `light_environment` korzystają z oświetlenia skompilowanego w mapie. Przełączane style obsługują też `pattern`. Zakupy i uzbrojenie są celowo **poza zakresem**.

To nadal nie jest cały serwer GoldSrc: złożone kontakty obrotowe, stosy i ciągnięcie skrzynek, grupowanie drzwi, specjalne typy obrażeń, zdania głosowe, pełne modele odłamków i wybuchy pozostają niepełne. Aktualny, szczegółowy zakres pokazuje raport w inspektorze. Referencje i ograniczenia: [obsługa encji](docs/bsp-entities.md).

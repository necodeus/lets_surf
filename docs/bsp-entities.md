# Encje środowiska — rozszerzenie runtime

Implementacja korzysta z danych encji BSP i wspólnych transformacji renderera oraz kolizji. Nie dodaje broni, przedmiotów wyposażenia ani kupowania. Raport inspektora oznacza `armoury_entity` i `func_buyzone` jako **Poza zakresem**, a rzeczywiste braki jako częściowe lub nieobsługiwane.

## Cykl ruchu i aktywacji

- Drzwi liniowe, obrotowe i `func_water`: pozycja początkowa start-open, kierunek/osi obrotu, speed, lip/distance, wait, toggle, use-only, passable. Cele odpalane po dojechaniu, także close-target (`netname`). Dźwięk ruchu w pętli, zatrzymanie i dźwięk końca. Woda o ujemnym skin nie jest solidna i pozostaje cicha.
- Przyciski: dont-move, touch-only, toggle, wait, domyślna prędkość 40, tekstura wciśnięcia, cel po zakończeniu ruchu, ignorowanie użycia podczas ruchu/powrotu. API `damageEntity` pozwala aktywować przycisk mający health przez obrażenia środowiskowe, bez dodawania broni.
- Ruch bryły jest dzielony na krótkie odcinki. Podpora przenosi gracza; niemożliwy ruch jest wycofywany, drzwi z nieujemnym wait zmieniają kierunek. Obrażenia zgniatania są ograniczone czasowo. Klapa opadająca pod graczem pozwala odłączyć się od podłoża. Nie jest to pełny wieloobiektowy solver pusherów GoldSrc.
- `target`, `killtarget` i `delay` działają również na encje punktowe. Kolejka zachowuje kolejność czasową. Są tryby on/off/toggle, jednorazowe przekaźniki, opóźnione cele multi_manager i bramka multisource. Rekurencja i rozmiar kolejki są ograniczone; nieznany master nie odblokowuje encji.

Referencje zachowania: [ReGameDLL doors.cpp](https://github.com/rehlds/ReGameDLL_CS/blob/master/regamedll/dlls/doors.cpp), [buttons.cpp](https://github.com/rehlds/ReGameDLL_CS/blob/master/regamedll/dlls/buttons.cpp).

## Triggery i środowisko

`trigger_multiple` ponawia aktywację przy utrzymanym kontakcie po wait, a `trigger_once` wyłącza się po pierwszym użyciu. Filtr no-clients i master dotyczą lokalnego gracza. `trigger_hurt` nalicza dmg/2 co pół sekundy, ujemne wartości leczą, flagi kontrolują start-off, no-clients i target-once. Śmierć przywraca gracza na spawn i 100 zdrowia; ręczny restart też przywraca zdrowie. Nie ma osobnego HUD zdrowia.

Teleporty obsługują pozycję i pełne kąty celu, no-clients, przełączanie aktywności, master, landmark i rozszerzenia ReGameDLL keep-angles (256), keep-velocity (512), redirect-velocity (1024). Dotychczasowe basevelocity boostów pozostaje zachowane: suma pól i jednorazowe przekazanie reszty po wyjściu. Nie symulujemy teleportowania potworów ani wpływu boostów na skrzynki.

Breakable zachowuje health i material; trigger-only odrzuca zwykłe obrażenia, unbreakable glass nie rozpada się. Touch wymaga dostatecznie silnego zderzenia, pressure uruchamia opóźnione pęknięcie. Działają cele, lokalne dźwięki i krótkotrwałe odłamki wizualne. Nie ma przedmiotów, modeli MDL odłamków ani pełnych wybuchów. Samo `E` nie niszczy bryły.

Pushable używa próbek hull-0 bryły do ograniczania przesunięcia. Wspiera kontakt, `E`, ograniczenie prędkości przez friction, grawitację i przybliżoną siłę buoyancy w cieczy. To nadal przybliżenie: nie obsługuje pełnego PUSHSTEP, ciągnięcia, stosów, rozmiarów hullów według klucza size ani wszystkich kontaktów narożników. Uśpione skrzynki wymagają poruszenia, aby ponownie szukały podpory.

Referencje: [triggers.cpp](https://github.com/rehlds/ReGameDLL_CS/blob/master/regamedll/dlls/triggers.cpp), [func_break.cpp](https://github.com/rehlds/ReGameDLL_CS/blob/master/regamedll/dlls/func_break.cpp).

## Oświetlenie i zasoby

Klasy light/spot/environment są światłami kompilowanymi w lightmapach. Brak dynamicznej lampy nie jest sam w sobie brakiem obsługi. Nazwane style ≥32 wspierają start-off, przełączanie i wzorce `pattern` odtwarzane przy 10 Hz. Stan jest zamrażany razem z czasem gry podczas pauzy. [Referencja Valve: lights.cpp](https://github.com/ValveSoftware/halflife/blob/master/dlls/lights.cpp).

Worldspawn dostarcza listę nazw WAD, skyname i MaxRange. Wyszukiwanie jest ograniczone do lokalnego katalogu zasobów; ścieżki z pliku BSP nie są wykonywane ani używane jako dowolne URL. Nieobecne zasoby nadal są zgłaszane. Z instalacji Steam skopiowano 113 plików WAV z katalogów doors/buttons/debris (około 1,5 MB). Web Audio używa źródeł przestrzennych, buforuje pliki i zaczyna pracę po interakcji z grą. Nie obsługuje zdań głosowych ani pełnej encji ambient_generic.

## Sprawdzenie

`tests/entities.test.js`: rzeczywisty cykl klatki i opadanie podłogi, moment odpalenia celu przycisku, flagi ruchu i woda, kolejki i usuwanie encji punktowych, triggery repeat/once/hurt, flagi teleportu, health brył, multisource, skrzynka na rzeczywistej mapie, lokalne zasoby i pattern świateł. Test kontrolowany sprawdza przenoszenie na platformie, cofnięcie po blokadzie i obrażenia. Pozostałe testy BSP/ruchu obowiązują bez zmiany klasycznych parametrów referencyjnych.

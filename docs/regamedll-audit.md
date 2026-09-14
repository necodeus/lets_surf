# Weryfikacja ruchu względem ReGameDLL_CS

Aktualizacja: 2026-09-15. Referencja: commit **b0889847fe6d03898be88acc9e366660efb40ab5** z 2026-08-27. Wariant: legacy `mp_flymove_method 0`, `mp_unduck_method 0`, `stamina_restore_rate 0`, bez automatycznego bhopa i bez wyłączenia limitera.

- [Kod ruchu, przypięta wersja](https://github.com/rehlds/ReGameDLL_CS/blob/b0889847fe6d03898be88acc9e366660efb40ab5/regamedll/pm_shared/pm_shared.cpp)
- [Stałe ruchu](https://github.com/rehlds/ReGameDLL_CS/blob/b0889847fe6d03898be88acc9e366660efb40ab5/regamedll/pm_shared/pm_shared.h)
- [Ustawienia serwera](https://github.com/rehlds/ReGameDLL_CS/blob/b0889847fe6d03898be88acc9e366660efb40ab5/regamedll/dlls/game.cpp)
- [Warstwa trasowania po stronie ReHLDS](https://github.com/rehlds/ReHLDS/blob/master/rehlds/engine/pmovetst.cpp)

## Wyrównanie po pierwszym audycie

Domyślnie aktywny jest teraz **CS 1.6 — klasyczny**. Dotychczasowe pominięcia limitera bhopa, kar po skoku i legacy rozwiązywania kolizji zostały zastąpione regułami opisanymi poniżej. Opcjonalny profil treningowy wyłącza kary i limiter; nie zmienia algorytmu kolizji.

| Obszar | Zaimplementowane zachowanie |
| --- | --- |
| `PM_PreventMegaBunnyJumping` | Przy wybiciu długość całego wektora jest porównywana z 1,2 × maxspeed. Po przekroczeniu granicy wektor jest przeskalowany do 0,8 tej granicy. Wyłączenie przez `sv_enablebunnyhopping 1` jest niezależne od auto-bhopa i kar. |
| `PM_ReduceTimers`, `PM_Jump` | Timer `fuser2` zmniejsza się o czas komendy, po skoku przyjmuje 1315,789429 ms. Kolejny impuls pionowy jest mnożony przez `1 − fuser2 × 0,00019`. |
| `PM_WalkMove` | Ten sam współczynnik osłabia poziomą prędkość po tarciu, przed przyspieszeniem. Dodatni `stamina_restore_rate` opcjonalnie podnosi współczynnik do potęgi `dt × rate`. |
| Wejście skoku | Domyślnie brak bufora. Naciśnięcie w powietrzu ustawia stan przycisku; trzymanie go do lądowania nie powoduje skoku. Impuls kółka jest jedną komendą wejścia. |
| Kolejność grawitacji | Pierwsza połowa przed skokiem, korekta po impulsie w samym skoku, ostatnia połowa po ruchu i ponownym sprawdzeniu podłoża/wody. Pierwsza połowa wchodzi także do długości wektora używanej przez limiter. |
| `PM_ClipVelocity` | Projekcja na płaszczyznę, overbounce i zerowanie składowych o module mniejszym od 0,1. |
| Legacy `PM_FlyMove` | Cztery iteracje, maksymalnie pięć płaszczyzn, zerowanie listy po przebyciu części drogi, zachowanie pierwotnego wektora, rozwiązywanie kolejnych płaszczyzn i nienormalizowanej krawędzi dwóch płaszczyzn. Zatrzymanie przy allsolid, braku postępu i odwróceniu ruchu w gałęzi wielopłaszczyznowej. |
| `PM_WalkMove` — stopnie | Próba ruchu bezpośredniego; po blokadzie porównanie drogi zwykłej i podniesionej o stepsize. Odrzucenie stromego lądowania i zachowanie pionowej składowej z wariantu dolnego. |
| `PM_WaterMove` — stopnie | Próba zejścia z wysokości stepsize + 1 w miejscu docelowym, w razie blokady zwykły ślizg. |
| `PM_Friction` | Tarcie krawędziowe: próba hull 16 units przed graczem i 34 w dół, mnożnik edgefriction przy braku podłoża. |
| Tarcie gracza i `PM_CheckVelocity` | Współczynnik gracza wpływa na tarcie, przyspieszanie i overbounce. Limit maxvelocity działa osobno na każdą składową; wartości niefinitywne są usuwane. |
| Lokalny trace | Rozróżnienie startsolid/allsolid, margines kontaktu 1/32, poprawiona obsługa niemal równoległych promieni i dodatkowe płaszczyzny przy skończonych krawędziach brył. |

W profilu klasycznym: air acceleration 10, auto-bhop 0, limiter włączony, kary włączone, bufor 0 ms. W treningowym: air acceleration 100, auto-bhop 1, limiter wyłączony, kary wyłączone, bufor 90 ms. `reset_physics` przywraca ustawienia klasyczne. Zmiana profilu odtwarza cały zestaw parametrów i restartuje mapę. Migracja wersji fizyki uruchamia profil klasyczny raz, zachowując bindy, FOV i czułość; następne własne konfiguracje są zapisywane.

`jump_penalty`, `jumpbuffer` i `surfacefriction` są lokalnymi rozszerzeniami. Pierwsze dwa służą do treningu; trzecie reprezentuje mnożnik tarcia gracza, a nie automatyczne rozpoznawanie materiałów mapy.

## Zachowane poprawki pierwszego audytu

- Woda używa wspólnych `friction` i `accelerate`; limit przyspieszenia liczy od długości całego wektora po tarciu. `waterfriction` i `wateraccelerate` pozostają aliasami.
- Skok w wodzie ustawia pionowo 100; nie dodaje drugiego przyspieszenia do góry. Waterjump używa dwóch punktowych prób brzegu i osobnego stanu wyjścia.
- Sprawdzenie podłoża: próba 2 units w dół, granica pionowej prędkości 180, normalna co najmniej 0,7.
- Duck ogranicza wish acceleration także w powietrzu; zmiana hull w powietrzu zachowuje środek bryły. Legacy double-duck zachowano.
- Wysokość widoku od stóp: 53 podczas stania, 30 po kucnięciu; przejście 0,4 s. Kolejność próbkowania wody: stopy, środek, oczy.

## Granica zgodności

**Aktualizacja BSP (15.09.2026):** poniższe ograniczenie dotyczy historycznego etapu z lokalnych brył. Zaimportowana `surf_ski_2` korzysta już z oryginalnych clipnodes, transformacji modeli, teleportów i zawartości wody. [Zakres nowego renderera i runtime](bsp-renderer.md).

Algorytm odpowiedzi na kolizję odpowiada wybranemu legacy wariantowi ReGameDLL. Źródłowy `PM_PlayerTrace` jest jednak funkcją silnika: działa na przygotowanych hullach BSP. Tutaj trasujemy hull po lokalnych wypukłych bryłach. Nie importujemy BSP, encji obrotowych, poruszających się podłoży ani modelowych hitboxów. Nie jest to deklaracja identycznych wyników na dowolnej mapie CS.

Pozostają też różnice poza zakresem tego wyrównania: stały krok 1/128 s i liczby JavaScript zamiast oryginalnego strumienia komend z całkowitoliczbowym `msec` i arytmetyką C++; pierwsza komenda waterjump; 250 ms ochrony przed ponownym przyczepieniem do drabiny i pomoc wejścia na dach; nurkowanie przez duck; wygładzanie renderowanej kamery. Nie ma broni, multiplayera, obrażeń ani prądów wodnych. Nie zaimplementowano alternatywnego `PM_FlyMove_New`.

## Weryfikacja

**70 testów przechodzi**, w tym 23 nowe testy wyrównania. Obejmują próg limitera i zmianę maxspeed, niezależność przełączników bhopa, wartości impulsu i kar, regenerację, opuszczony impuls kółka, tarcie krawędziowe, limit składowych, overbounce, allsolid, ruch niemal równoległy, narożniki, krawędź ściana/podłoga, stopnie i wodne stopnie.

Przykładowa kontrola: prędkość 600, maxspeed 250 i dt = 1/128 dają poziomo `600 × 240 / hypot(600, 3,125)` przy pierwszym wybiciu. Pionowo po całej komendzie pozostaje `sqrt(72000) − 6,25`. Przy początkowym timerze 1000 ms współczynnik następnego wybicia wynosi 0,811484375.

Pełna trasa `movement_origin` przechodzi na domyślnych klasycznych ustawieniach: bhop, tunel, double-duck, woda, drabina, surf i meta. Test sprawdza brak przenikania brył w każdej komendzie. Geometria nie została zmieniona; sterowanie testu wybija się później na platformach i skręca na przejściu między rampami, zamiast stosować wcześniejsze ułatwione wejście.

Build produkcyjny przechodzi. W przeglądarce sprawdzono oba profile, odczyt i zmianę nowych komend, oznaczenie własnych ustawień oraz zapis klasycznego profilu po odświeżeniu. Brak błędów i ostrzeżeń w konsoli przeglądarki.

Testy wartości liczbowych są niezależnymi oczekiwaniami wyliczonymi z reguł referencji. Nie uruchamiają oryginalnego C++ ani pełnego serwera CS. Zgodność binarna wymagałaby odtwarzania identycznych komend na identycznych hullach w obu silnikach.

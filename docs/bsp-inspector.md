# BSP Atlas — inspektor struktury

Uruchom `npm run dev` i otwórz `http://127.0.0.1:5173/bsp.html`. Inspektor jest osobną stroną, dołączaną również do produkcyjnego `dist/bsp.html`; główny adres nadal uruchamia grę. Domyślnie otwiera `surf_ski_2.bsp`. Przycisk **Otwórz BSP** pozwala odczytać lokalny plik GoldSrc BSP30 do 64 MB. Plik nie jest wysyłany na serwer ani modyfikowany.

- Rozwijane drzewo wszystkich 15 sekcji, wyszukiwanie nazw sekcji, indeksów, klas encji, targetname, modeli i nazw tekstur. Listy rozwijają się partiami po 100 rekordów.
- Opisy struktur, typów, offsetów i znaczenia pól. Współrzędne pozostają w układzie GoldSrc.
- Sparsowane obiekty z rozwijanymi tablicami, przejścia do powiązanych rekordów oraz podgląd czterech mipmap osadzonych tekstur.
- Stronicowany HEX z bezwzględnymi offsetami. Encje o zmiennej długości pokazują całą sekcję tekstową; tekstury pokazują nagłówek miptex.
- Rzeczywisty kod parsera, kolizji, runtime i renderera z numerami linii. Zakładka „Kod parsera” przewija do odpowiedniego odczytu.

## Raport obsługi

**Obsługa i nieznane dane** pokazuje klasy encji z oznaczeniem obsługi podstawowej, częściowej, braku obsługi lub klasy nieznanej. Dodatkowo opisuje nieinterpretowane właściwości, nieznane tryby materiałów i flagi UV, nieobsługiwane renderfx, nietypowe contents oraz odwołania do nieistniejących modeli. Statusy odnoszą się do lokalnego silnika, nie do możliwości oryginalnego CS. Odczyt tekstowych kluczy nie oznacza wykonywania ich logiki.

Raport opiera się na jawnym rejestrze w `src/inspector/diagnostics.js`. Przy rozszerzaniu runtime trzeba aktualizować również ten rejestr. Nie jest to pełny walidator FGD, wszystkich flag spawnflags, kluczy ani rozszerzeń. Nieznany klucz oznacza brak zadeklarowanej interpretacji w rejestrze, nie dowód uszkodzenia pliku. Wartości nadal można obejrzeć w danych i HEX.

Inspektor nie dołącza WAD ani TGA: tekstury zewnętrzne są zależnościami, nie potwierdzonymi brakami w grze. Raport ujawnia zakresy bajtów poza standardowym nagłówkiem i sekcjami; rozróżnia zera/wyrównanie od nieznanych danych niezerowych. Nie dekoduje BSPX. Błędna wersja lub struktura powoduje jawny komunikat parsera, zachowując wcześniej otwartą mapę.

## Kod

`schema.js` opisuje struktury i ich relacje, `diagnostics.js` ocenia zakres obsługi, a `main.js` buduje interfejs. Odczyt binarny nadal wykonuje wspólny `src/bsp/format.js`. Inspektor nie tworzy drugiego, rozbieżnego parsera. Dane pliku są prezentowane przez `textContent`, bez interpretowania HTML ani kodu encji.

Testy `tests/inspector.test.js` porównują offsety z rzeczywistymi bajtami BSP, sprawdzają odwołania do liści i krawędzi, diagnostykę mapy, nieznane klasy i dane dopisane poza sekcjami.

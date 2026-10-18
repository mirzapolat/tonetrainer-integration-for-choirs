# Trainingsansicht – Spezifikation

Verbindlich sind **Aufbau, Inhalte, Verhalten und Texte**. Farben, Schrift, Radien, Schatten und Komponentenstil kommen aus der Host-App (siehe DESIGN-ANPASSUNG.md). Referenzimplementierung: `react/PracticeView.tsx`.

## Layout

### Desktop (≥ 1024 px)
```
┌──────────────────────────────────────────────────────────────────────────┐
│ ←  Titel  [Stimme ▾]              [♪ Mitsingen | ⧗ Warten]   ⚙︎mix 📊 ⚙︎   │ Header
├───────────────────────────────────────────────┬──────────────────────────┤
│ PARTITUR (helles Papier, scrollt vertikal)    │ TUNER                    │
│  Cursor folgt, bewertete Noten eingefärbt     │  Ziel G4        Gesungen │
│                          [Alle] [−] [+]       │                          │
├───────────────────────────────────────────────┤         F♯ 4             │
│ PIANO-ROLL (Canvas)                           │   ↑ 18 Cent zu tief      │
│  Tonnamen │ Taktnr.  Soll-Balken  Linie  ●    │                          │
│           │          Playhead bei 28 %        │  ───╭──●──╮──── (Saite)  │
├───────────────────────────────────────────────┤  −100 −50  0  +50 +100   │
│ Liedtext: Lei·se sinkt der A·bend …           │  [Halte-Balken]  (Warten)│
│                                               │  Eingang ▬▬▬▬            │
├───────────────────────────────────────────────┴──────────────────────────┤
│ ⏮  ( ▶ )  [Ton hören] ⏭   Takt 5 von 32           [⏲ 100 %] [⟲ Abschnitt]│ Transport
└──────────────────────────────────────────────────────────────────────────┘
```
Grid: Spalten `1fr | 21rem`, Zeilen `1.15fr | 1fr`, Tuner über beide Zeilen. Ansicht füllt die Viewport-Höhe, nur die Partitur scrollt.

### Handy (< 1024 px)
```
┌──────────────────────────┐
│ ← Titel  [Stimme▾] ⚙ 📊 ⚙│
│  [Mitsingen|Warten bis …]│
├──────────────────────────┤
│ PARTITUR (nur eigene St.)│  0.95fr
├──────────────────────────┤
│ Ziel H3 │  ──╭─●─╮──     │  kompakter Tuner (auto)
│ A 3     │ −100 … +100    │
│ ↑ 2 HT  │                │
├──────────────────────────┤
│ PIANO-ROLL + Liedtext    │  1fr
├──────────────────────────┤
│ ⏮ (▶)          [⏲] [⟲]  │
└──────────────────────────┘
```
Nichts darf horizontal überlaufen (Grid-Spalte `minmax(0, 1fr)`). Dialoge werden zu Bottom-Sheets.

## Bereiche und Verhalten

### Header
- Zurück, Titel (einzeilig gekürzt), **Stimmauswahl** (Select mit allen Tracks).
- **Modus**: „Mitsingen“ / „Warten“ (Handy: „Mitsingen“ / „Warten bis getroffen“). Wechsel pausiert und speichert die laufende Sitzung.
- Icons: Mixer, Fortschritt (nur wenn `onOpenProgress`), Einstellungen.

### Stimmauswahl (Dialog)
Beim ersten Öffnen eines Stücks ohne gespeicherte Stimme. Titel „Welche Stimme singst du?“. Je Stimme: Name + Umfang („Fis3 bis E4“). Schließen ohne Wahl → erste Stimme.

### Partitur
- Ganze Partitur, eigene Stimme in Tinte, andere Stimmen blass. Umschalter „Alle“/„Meine“ (getrennt gespeichert für Desktop [Standard Alle] und Handy [Standard Meine]); Zoom −/+ (getrennt gespeichert pro Gerätetyp).
- Cursor folgt der Wiedergabe (bzw. der aktuellen Note im Warte-Modus) und scrollt automatisch mit.
- Bewertete Noten werden eingefärbt: sauber / ok / zu tief / zu hoch / nicht gesungen. Farben bleiben nach dem Durchgang stehen und werden erst beim nächsten Start zurückgesetzt.
- Klick auf einen Takt springt dorthin (bei Wiederholungen zum nächsten Vorkommen ab der aktuellen Position).

### Piano-Roll
- Y: Tonumfang der eigenen Stimme ± 3 Halbtöne, Zeilen mit Tonnamen, schwarze Tasten leicht abgedunkelt. X: Beats, Playhead bei 28 % der Breite.
- Eigene Noten als abgerundete Balken mit Silbe; aktuelle Note in Akzentfarbe mit Glow; kommende hell, vergangene blass, bewertete in Bewertungsfarbe. Andere Stimmen als dünne blasse Linien.
- Gesungene Tonhöhe als geglättete Kurve, Farbe je Abweichung (sauber / zu tief / zu hoch). Punkt am Playhead = aktuelle Tonhöhe.
- Mitsingen: scrollt mit dem Beat. Warten: Balken stehen, die Linie fließt in Echtzeit nach links aus.
- Einzählen: große Zahl (3, 2, 1) mittig. Loop-Bereich leicht hinterlegt. Klick springt zum Takt.
- Darunter: **Liedtext** um die aktuelle Note, aktuelle Silbe hervorgehoben, gesungene blass. Nur wenn die Stimme Text hat.
- Mikrofon aus → Overlay über der Rolle: „Mikrofon aktivieren, um zu starten“, Hinweis „Mit Kopfhörern hört das Mikrofon nur dich.“, Button „Mikrofon aktivieren“ (während Anfrage „Warte auf Freigabe …“), ggf. Fehlertext.

### Tuner
- Kopf: „Ziel <Note>“ und „Gesungen“.
- Groß: gesungener Notenname + Oktave, Farbe nach Abweichung; still = „–“ gedimmt.
- Meldung mit Richtungspfeil: „Sauber getroffen“ ✓ · „18 Cent zu tief“ ↑ · „2 Halbtöne zu hoch“ ↓ (ab 90 Cent in Halbtönen) · „Sing G4“ · „Begleitung erkannt, sing lauter oder nutze Kopfhörer“ · „Mikrofon ist aus“. Ohne Ziel (Pause): Abweichung zum nächsten Halbton.
- **Saite**: Skala −100 … +100 Cent, Mittelstrich in Akzentfarbe, Toleranzzone hinterlegt; der Punkt sitzt bei der Abweichung, die Saite biegt sich dorthin (Feder-Animation). > 100 Cent: Punkt am Rand + „◀ höher singen“ / „tiefer singen ▶“. Im Toleranzbereich leuchtet der Hintergrund dezent in „sauber“.
- Warte-Modus: Halte-Balken + „Halte den Ton, bis der Balken voll ist.“
- Unten: Eingangspegel.
- Handy: eine Zeile – links Ziel/Name/Meldung, rechts Saite (+ Halte-Balken).

### Transport
- Zum Anfang (bzw. Anfang der Schleife), großer Start/Pause-Button.
- Nur Warte-Modus: „Ton hören“ (Taste R), Überspringen (→).
- „Takt N von M“ (bei Wiederholungen „Takt N (2. Mal)“).
- Nur Mitsingen: **Tempo**-Popover (Regler 40–130 %, Schnellwahl 60/75/90/100 %, Anzeige in BPM, Schalter Metronom).
- **Abschnitt**-Popover: „von Takt“ / „bis Takt“, „Schleife starten“, „Schleife beenden“. Aktive Schleife zeigt „T. 5–8“.
- Tastatur: Leertaste Start/Pause, R Referenzton, → Überspringen (nicht in Eingabefeldern/Dialogen).

### Mixer (Dialog)
Segment-Auswahl der Presets mit einzeiliger Erklärung darunter (oder „Eigene Mischung“):
- Lernen – „Deine Stimme laut, die anderen leise“
- Festigen – „Deine Stimme leise als Stütze“
- Allein – „Nur die anderen, du singst deine Stimme“
- Nur meine – „Nur deine Stimme“

Darunter je Stimme (eigene oben, markiert „deine Stimme“): Lautstärke-Regler, Stumm, Solo. Gespeichert pro Stück.

### Einstellungen (Dialog)
Mikrofon (Geräteauswahl nach Freigabe), „Ich nutze Kopfhörer“, Erkennung (Tolerant/Normal/Streng) · Bewertung: Toleranz ±10–50 Cent, „Oktave egal“ · Üben: Einzählen, „Ton vorspielen im Warte-Modus“, Notennamen (C D E … H / C D E … B), Kammerton A4 430–446 Hz.

### Auswertung (Dialog, nach Ende eines Durchgangs)
- Große Prozentzahl „der Noten getroffen (N bewertet, Stimme)“, Vergleich zum letzten Mal („+12 Punkte zum letzten Mal“).
- „Takt für Takt“: Kacheln mit Taktnummer, Farbe nach Genauigkeit (≥ 85 % / ≥ 60 % / darunter); Klick = Takt in Schleife.
- „Hier lohnt sich Üben“: bis zu 4 schwächste Takte < 70 % mit Hinweis „meist zu tief (Ø 35 Cent)“ / „oft nicht gesungen“ und Button „Üben“.
- Buttons: „Fortschritt über Zeit“, „Weiter üben“.

## Fortschritt (eigene Ansicht)
Kennzahlen (Geübt insgesamt, Durchgänge, Zuletzt, Bestwert) · Kurve „Genauigkeit pro Durchgang“ · drei Listen „Hartnäckig“ / „Besser geworden“ / „Nachgelassen“ (Takt, Richtungshinweis, letzte Werte „45 → 60 → 80 %“, Klick = üben) · Heatmap „Takt für Takt über die Zeit“ (Zeile = Durchgang, neuester unten, Spalte = Takt). Stimmauswahl, wenn mehrere Stimmen geübt wurden.

## Übungszeit (Widget für die Übersicht)
Titel „Übungszeit“, Segment Tag/Woche/Monat, Summe für den aktuellen Zeitraum, Streak („🔥 3 Tage“), Balken der letzten 14 Tage / 12 Wochen / 12 Monate, aktueller Balken in Akzentfarbe.

## Texte
Deutsch, sachlich, ohne Werbesprache. Keine erklärenden Untertitel auf Übersichtsseiten.

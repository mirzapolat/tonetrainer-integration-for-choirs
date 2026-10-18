# Architektur

## Datenfluss

```
MusicXML ──parseScore()──► ParsedScore ─┐
                                         ├─► Timeline (Spielreihenfolge, Tempo, Noten in Beats)
OSMD (ScoreView) ──Walk mit Iterator──► measure order (inkl. Wiederholungen/Volten)
                                         │
             ┌───────────────────────────┴──────────────┐
             ▼                                          ▼
        Player (Web Audio)                       PracticeEngine
   synthetisiert alle Stimmen,          ◄── Mic → PitchTracker (pro Frame)
   Mixer/Loop/Tempo/Einzählen                 bewertet Noten, Sitzungsstatistik
             │                                          │
             └──────► usePracticeSession ◄──────────────┘
                     (rAF-Loop: engine.frame() + Cursor setzen)
                                 │
       ScoreView · PianoRoll · Tuner · TransportBar · Dialoge
                                 │
                       PracticeStorage (Prefs, Sitzungen)
```

## Module

| Datei                    | Aufgabe |
|--------------------------|---------|
| `pitch/fft.ts`           | Radix-2-FFT. |
| `pitch/mpm.ts`           | **McLeod Pitch Method**: normierte quadratische Differenzfunktion (Autokorrelation via FFT), erster Key-Peak ≥ 0,9 × Maximum, parabolische Interpolation. Liefert Frequenz + „Clarity“ (0..1). |
| `pitch/tracker.ts`       | Macht daraus eine stabile Tonhöhenspur: adaptive Rauschsperre, Clarity-Schwelle, Oktavsprung-Sperre (±12 HT muss 4 Frames bestehen), Median über 5 Frames, 2 Frames Überbrückung bei Aussetzern. |
| `audio/mic.ts`           | `getUserMedia` ohne Browserfilter, Hochpass 45 Hz, Analyser mit ~42 ms Fenster (2 Perioden von C2). `latency` = halbes Fenster + Basislatenz. |
| `audio/synth.ts`         | Gemeinsamer `AudioContext`; weicher Ton (Säge + Dreieck, Tiefpass, verzögertes Vibrato); Metronom-Klick. |
| `audio/player.ts`        | Look-ahead-Scheduler (25 ms Tick, 150 ms Vorlauf) auf der Audio-Uhr. Position als Anker (Audiozeit ↔ Beat) → Tempowechsel/Seek exakt. Gain pro Stimme (Mute/Solo), Loop, Einzählen, Referenzton, `soundingAt()` für den Lautsprecherschutz. |
| `musicxml/load.ts`       | `.mxl` entpacken (fflate), UTF-16 erkennen. |
| `musicxml/parse.ts`      | Parts → Tracks. Mehrere `<voice>` in einem Part → mehrere Tracks. Klingende Tonhöhe = notiert + `<transpose>` (Oktav-Schlüssel ändern `<pitch>` nicht). Haltebögen zusammengeführt. Akkord in einer Stimme: oberster Ton = Bewertung, alle Töne = Wiedergabe. Liedtext mit Silbentrennung. Tempo aus `<sound tempo>` oder `<metronome>`. |
| `timeline.ts`            | Takt-„Visits“ in Spielreihenfolge, Noten in absoluten Beats, Tempo-Segmente, `beatToSec`/`secToBeat`, `noteAt()`. |
| `engine.ts`              | Siehe unten. |
| `stats.ts`               | Übungsminuten pro Tag/Woche/Monat, Streak, Trend je Takt über Sitzungen. |

## Wiederholungen
OSMDs Cursor-Iterator wertet Wiederholungszeichen und Volten aus. `ScoreView.layout()` läuft nach jedem Rendern einmal mit dem Iterator durchs Stück und sammelt:
1. die Reihenfolge der Takte (→ `Timeline`), einen neuen „Visit“ bei Taktwechsel oder Zeitrücksprung,
2. pro Visit die Cursor-Schritte (Offset im Takt + geklonter Iterator) → Cursor wird später per `iterator.clone()` gesetzt, ohne erneut zu laufen,
3. pro Note (Part, Voice, Takt, Offset) die SVG-Gruppen → Färbung bewerteter Noten.

## Engine
- **Mitsingen**: Bewertet wird mit Latenzausgleich (`mic.latency + outputLatency`), also gegen den Beat, den der Sänger tatsächlich gehört hat. Pro Note nach einer Schonzeit (min(0,12 s, 30 % der Note)): Frames, gesungene Frames, Treffer (≤ Toleranz), Fast-Treffer (≤ 2 × Toleranz), mittlere Abweichung.
  - `silent`: < 30 % der Frames gesungen
  - `good`: ≥ 40 % aller Frames und ≥ 50 % der gesungenen Frames im Toleranzbereich
  - `ok`: (Treffer + Fast-Treffer) ≥ 50 %
  - sonst `flat`/`sharp` nach Vorzeichen der mittleren Abweichung
- **Warte-Modus**: Ziel = aktuelle Note. Wird der Ton 400 ms (kurze Noten 250 ms) im Toleranzbereich gehalten, geht es weiter. Note `good` bei < 2 s Gesamtzeit, `ok` < 5 s, sonst Richtung.
- **Lautsprecherschutz** (ohne Kopfhörer): Frames, deren Tonhöhe einem gerade klingenden Begleitton (nicht dem Ziel) entspricht, werden verworfen.
- **Sitzung**: Statistik pro Quelltakt (Wiederholungen zählen in denselben Takt). Gespeichert bei Ende, Modus-/Stimmwechsel, Verlassen, Tab im Hintergrund – wenn ≥ 8 s geübt wurde. Punkte: good = 1, ok = 0,6, Rest 0.
- **Events**: `state` (UI neu rendern), `graded` (Note färben), `finished` (Auswertung zeigen).

## Anzeige-Glättung
`PianoRoll` glättet die Tonhöhenlinie mit einem One-Euro-Filter (nur Anzeige). Bewertung und Tuner-Text nutzen die ungeglätteten Werte, der Tuner-Zeiger hat eine eigene Feder-Animation.

## Stellschrauben

| Wert | Ort | Standard | Wirkung |
|------|-----|----------|---------|
| Toleranz | Einstellung | ±25 Cent | Treffer-Grenze |
| Clarity | `settings.ts` `CLARITY` | 0,80 / 0,86 / 0,92 | Erkennungsschwelle (tolerant / normal / streng) |
| Rauschsperre | `tracker.ts` | max(−62 dBFS, Grundrauschen + 9 dB) | ab wann überhaupt analysiert wird |
| Oktavsperre | `tracker.ts` `OCTAVE_CONFIRM_FRAMES` | 4 | Frames bis ein Oktavsprung geglaubt wird |
| Notenbewertung | `engine.ts` `gradePlay()` | siehe oben | Strenge im Mitsing-Modus |
| Haltezeit | `engine.ts` `frame()` | 400 / 250 ms | Warte-Modus |
| Mindest-Sitzung | `engine.ts` `summary()` | 8 s | wann gespeichert wird |
| Linien-Glättung | `PianoRoll.tsx` `smoothTrail()` | minCutoff 1, beta 0,25 | kleiner = ruhiger / größer = schneller |

## Bekannte Grenzen
- Divisi in einer Stimme: bewertet wird der oberste Ton.
- `score-timewise` wird nicht unterstützt (Fehlermeldung).
- Sehr schnelle Melismen (< ~80 ms pro Ton) werden oft nicht bewertet (zu wenige Frames).

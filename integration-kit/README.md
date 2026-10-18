# Tonetrainer – Integration Kit

Gesangstrainer für Chorstimmen: MusicXML laden, eigene Stimme wählen, singen. Die App erkennt live die gesungene Tonhöhe, zeigt die Abweichung in Cent, bewertet jede Note und speichert den Fortschritt über die Zeit.

Dieses Kit ist für den Einbau in eine **bestehende App mit eigener Notenverwaltung und eigener Design Language** gedacht. Funktion und Aufbau der Trainingsansicht bleiben gleich, das Aussehen passt sich der Host-App an.

## Lesereihenfolge

1. `docs/INTEGRATION.md` – Einbau Schritt für Schritt, Datenanbindung, Stolperfallen, Abnahme-Checkliste
2. `docs/TRAININGSANSICHT.md` – verbindliche UI-Spezifikation (Aufbau, Zustände, Texte, Verhalten)
3. `docs/DESIGN-ANPASSUNG.md` – welche Tokens gemappt werden, was fix bleiben muss
4. `docs/ARCHITEKTUR.md` – Module, Datenfluss, Algorithmen, Stellschrauben

## Inhalt

```
integration-kit/
├── src/
│   ├── core/                     framework-unabhängiges TypeScript (kein React, kein CSS)
│   │   ├── pitch/                FFT, McLeod Pitch Method, PitchTracker (Glättung, Oktavschutz)
│   │   ├── audio/                Mikrofon, Synth, Player (Look-ahead-Scheduler, Mixer, Loop)
│   │   ├── musicxml/             .musicxml/.xml/.mxl lesen + parsen (Stimmen, Liedtext, Tempo)
│   │   ├── timeline.ts           Spielreihenfolge (Wiederholungen), Beat ↔ Sekunden
│   │   ├── engine.ts             Übungslogik: Mitsingen/Warte-Modus, Bewertung, Sitzungen
│   │   ├── stats.ts              Übungszeit-Buckets, Trends pro Takt
│   │   ├── storage.ts            PracticeStorage-Interface + IndexedDB-Default
│   │   ├── settings.ts, types.ts, music.ts, demo.ts
│   │   └── index.ts
│   └── react/
│       ├── usePracticeSession.ts GESAMTE Logik der Trainingsansicht als Hook (headless)
│       ├── PracticeView.tsx      Referenz-Layout der Trainingsansicht
│       ├── ScoreView.tsx         Partitur (OpenSheetMusicDisplay) mit Cursor + Notenfärbung
│       ├── PianoRoll.tsx         Canvas: Soll-Noten + gesungene Tonhöhenlinie
│       ├── Tuner.tsx             Notenname + Cent-„Saite“
│       ├── TransportBar.tsx, dialogs.tsx, ui.tsx
│       ├── ProgressView.tsx      Fortschritt pro Stück (Kurve, Heatmap, Trends)
│       ├── PracticeTimeChart.tsx Übungsminuten Tag/Woche/Monat
│       ├── theme.ts              liest Farben aus CSS-Variablen (für Canvas/SVG/Partitur)
│       ├── useLocalSettings.ts
│       ├── tonetrainer.css       Referenz-Styles, alles über --tt-* Tokens
│       └── index.ts
├── tests/pitch.test.ts           20 Tests der Tonhöhenerkennung (vitest)
└── dev/simulated-singer.js       simuliertes Mikrofon zum Testen ohne Singen
```

## Abhängigkeiten

```
npm i opensheetmusicdisplay fflate idb lucide-react
npm i -D vitest        # optional, für tests/
```

React ≥ 18 (entwickelt mit 19). Kein Tailwind, kein framer-motion, kein State-Manager nötig.

## Minimaler Einbau

```tsx
import { createIndexedDbStorage } from './tonetrainer/core'
import { PracticeView } from './tonetrainer/react'
import './tonetrainer/react/tonetrainer.css'

const storage = createIndexedDbStorage() // oder eigener Adapter gegen das Backend

<PracticeView
  scoreId={score.id}
  title={score.title}
  xml={score.musicXml} // String; .mxl vorher mit readScoreFile() entpacken
  storage={storage}
  onBack={() => navigate(-1)}
  onOpenProgress={() => navigate(`/scores/${score.id}/fortschritt`)}
/>
```

## Status

- Tonhöhenerkennung mit Unit-Tests abgesichert.
- Gesamte Kette (Mikro → Bewertung → Auswertung → Statistik) wurde in der Ursprungs-App im Browser mit simuliertem Sänger getestet, auch in Handy-Breite.
- Das Kit ist typgeprüft, lief aber noch nicht in einer zweiten App. Kleine Anpassungen (Imports, CSS-Konflikte) sind zu erwarten.
- Mit echter Stimme und Partituren mit Wiederholungen noch wenig erprobt. Schwellwerte: `ARCHITEKTUR.md` → „Stellschrauben“.

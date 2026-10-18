# Integration – Schritt für Schritt

## 1. Dateien übernehmen

`src/core` und `src/react` z. B. nach `src/features/tonetrainer/` kopieren. Alle Imports im Kit sind relativ.

- `core/` hat keine React- und keine CSS-Abhängigkeit. Ist die Host-App nicht in React geschrieben: nur `core/` übernehmen und `react/usePracticeSession.ts` als Vorlage für Composable/Store nutzen, die Logik ist 1:1 übertragbar. `ScoreView`, `PianoRoll`, `Tuner` sind ebenfalls fast reines DOM/Canvas und leicht portierbar.

## 2. Abhängigkeiten

`opensheetmusicdisplay`, `fflate` (nur für .mxl), `idb` (nur für den IndexedDB-Default), `lucide-react` (Icons, durch das Icon-Set der Host-App ersetzbar).

OSMD ist ~1,5 MB → Trainingsansicht per `lazy(() => import(...))` laden.

## 3. Datenanbindung

### Noten
Der Trainer braucht pro Stück nur `scoreId` (stabile ID), `title` und `xml` (MusicXML-String, `score-partwise`).

- `.mxl` / `File` / `Blob` → `await readScoreFile(file)` liefert den String.
- `parseScore(xml)` vorab aufrufen, um zu prüfen, ob das Stück übbar ist (wirft verständliche deutsche Fehlermeldungen), und um Stimmen und Tonumfänge in der Notenliste der Host-App anzuzeigen.
- PDFs/Bilder gehen nicht, es braucht MusicXML.

### Speicher (`PracticeStorage`, `core/storage.ts`)
```ts
interface PracticeStorage {
  getPrefs(scoreId): Promise<ScorePrefs>          // gewählte Stimme, Mixer, Zoom, Tempo
  savePrefs(scoreId, prefs): Promise<void>        // MERGE, nicht ersetzen
  addSession(session: SessionRecord): Promise<void>
  sessions(scoreId?): Promise<SessionRecord[]>    // aufsteigend nach startedAt; ohne ID: alle
  deleteScore?(scoreId): Promise<void>
}
```
- Schnellstart: `createIndexedDbStorage()` (lokal im Browser).
- Mit Backend/Nutzerkonten: eigenen Adapter schreiben, der `SessionRecord` und `ScorePrefs` als JSON ablegt (Schema in `core/types.ts`). `SessionRecord.songId` ist die `scoreId`.
- Löscht die Host-App ein Stück → `storage.deleteScore(scoreId)`.

### Einstellungen (`core/settings.ts`)
Global, nicht pro Stück. Entweder nichts übergeben (dann `localStorage`, Key `tonetrainer-settings`), oder `settings` + `onSettingsChange(patch)` an `<PracticeView>` geben, wenn die Host-App Einstellungen selbst verwaltet.

## 4. Ansichten einhängen

| Ansicht               | Komponente            | Ort in der Host-App                                        |
|-----------------------|-----------------------|------------------------------------------------------------|
| Training              | `<PracticeView>`      | eigene Route, Vollbild, z. B. `/scores/:id/ueben`          |
| Fortschritt pro Stück | `<ProgressView>`      | Route `/scores/:id/fortschritt` oder Tab beim Stück        |
| Übungszeit gesamt     | `<PracticeTimeChart>` | Übersicht/Dashboard, `sessions = await storage.sessions()` |
| Einstieg              | –                     | „Üben“-Button an jedem Stück der vorhandenen Notenliste    |

- Deep-Link „Takt üben“: `ProgressView.onPractice(measureIndex)` → Trainingsansicht mit `initialLoopMeasure={measureIndex}` öffnen, der Takt läuft dann als Schleife.
- `.tt-practice` nimmt `100dvh` ein. Unter einer festen Host-Navigation: `height: calc(100dvh - <navhöhe>)`.

## 5. Eigene Oberfläche

Zwei Wege, beide erlaubt:

1. **Referenz behalten, Primitive tauschen.** `ui.tsx` (Dialog, Segmented, Switch, Slider) durch Host-Komponenten ersetzen, `tt-btn`/`tt-select` durch Host-Button/Select. Tokens mappen (DESIGN-ANPASSUNG.md). Schnellster Weg.
2. **Eigene View auf Basis von `usePracticeSession()`.** Der Hook liefert Zustand + Aktionen für alles. `ScoreView`, `PianoRoll` und `Tuner` weiterverwenden, sie sind funktional heikel. Der Rest wird frei gestaltet, aber nach `TRAININGSANSICHT.md`.

## 6. Stolperfallen

- **HTTPS** ist Pflicht für das Mikrofon (außer `localhost`). Fürs Handy im LAN z. B. `@vitejs/plugin-basic-ssl`.
- **AudioContext nur nach Nutzergeste** (iOS). Ist erfüllt: Mikro- und Start-Button resumen den Context. Nichts automatisch beim Laden starten.
- **Browser-Audiofilter bleiben aus**: `Mic.open()` setzt `noiseSuppression:false`, `autoGainControl:false`, `echoCancellation` nur ohne Kopfhörer. Nicht ändern, die Filter verfälschen Tonhöhe und Pegel.
- **OSMD `autoResize:false`** ist Absicht: Nach jedem Rendern müssen Cursor-Zuordnung und Notenfarben neu aufgebaut werden, das macht `ScoreView` selbst.
- **Partitur auf hellem Papier** (`--tt-paper`). OSMD-Noten sind dunkel; auch im Dark Mode der Host-App das Papier hell lassen.
- **CSS**: Alles ist mit `tt-` präfixiert, Resets laufen über `:where()` (Spezifität 0). Bei Tailwind das Kit-CSS nach den Tailwind-Layern laden oder in `@layer components` legen.
- **Hintergrund-Tab**: Übung pausiert, Sitzung wird gespeichert.
- **Kurze Sitzungen** (< 8 s Übungszeit) werden nicht gespeichert.

## 7. Testen ohne zu singen

`dev/simulated-singer.js`: ersetzt `getUserMedia` durch einen Oszillator mit Obertönen und singt automatisch die Zielnoten (optional verstimmt oder ausgelassen). Anleitung im Kopf der Datei. Damit lassen sich Erkennung, Bewertung, Auswertung und Statistik reproduzierbar prüfen.

Unit-Tests: `npx vitest run tests` (Importpfad im Test an den neuen Ort anpassen).

## 8. Abnahme-Checkliste

- [ ] Demo-Stück (`demoScoreXml()`) öffnet. Die Stimmauswahl erscheint, Tenor zeigt „Fis3 bis E4“ (Oktav-Violinschlüssel korrekt).
- [ ] Mikro aktivieren → Tuner zeigt Notennamen, Linie in der Rolle läuft.
- [ ] Mitsingen: Einzählen, Cursor folgt, bewertete Noten werden in der Partitur gefärbt, am Ende Auswertung mit Takt-Ampel und Problemstellen.
- [ ] Warte-Modus: Ton wird vorgespielt, Halte-Balken füllt sich, Cursor rückt Note für Note weiter.
- [ ] Mixer-Presets, Tempo, Schleife, Klick auf Takt (Partitur und Rolle) springt.
- [ ] Sitzung erscheint in ProgressView und PracticeTimeChart.
- [ ] Handy (< 1024 px): kompakter Tuner, nur eigene Stimme in der Partitur, nichts läuft horizontal über.
- [ ] Alle Farben kommen aus Host-Tokens; zu tief / sauber / zu hoch sind klar unterscheidbar.

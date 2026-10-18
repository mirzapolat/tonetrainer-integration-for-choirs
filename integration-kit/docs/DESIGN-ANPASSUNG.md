# Design-Anpassung

Das gesamte Aussehen hängt an CSS-Custom-Properties `--tt-*` in `react/tonetrainer.css` (Abschnitt „TOKENS“ auf `.tt-root`). Canvas (Piano-Roll), SVG (Tuner, Diagramme) und die Partitur lesen ihre Farben zur Laufzeit aus diesen Variablen (`react/theme.ts`). Es reicht also, die Tokens auf die Host-Tokens zu mappen:

```css
.tt-root {
  --tt-font: var(--app-font-sans);
  --tt-font-display: var(--app-font-heading);
  --tt-bg: var(--app-bg);
  --tt-accent: var(--app-primary);
  --tt-accent-contrast: var(--app-on-primary);
  /* … */
}
```

Wechselt die Host-App das Theme zur Laufzeit (hell/dunkel), muss `useTrainerColors(rootRef, [theme])` mit dem Theme als Abhängigkeit aufgerufen werden, damit Canvas/SVG neu lesen. Die Partitur übernimmt Änderungen erst nach dem nächsten Rendern (Zoom/Resize).

## Tokens

| Token | Bedeutung |
|-------|-----------|
| `--tt-font`, `--tt-font-display` | Fließtext / Überschriften, Notenname, große Zahlen |
| `--tt-bg` | Seitenhintergrund der Trainingsansicht |
| `--tt-surface`, `--tt-surface-2` | Karten (Verlauf oben → unten; gleich setzen für flach) |
| `--tt-raised`, `--tt-dialog-bg` | Popover, Dialoge |
| `--tt-border`, `--tt-hover`, `--tt-control-bg`, `--tt-backdrop` | Linien, Hover, Felder, Dialog-Hintergrund |
| `--tt-text`, `--tt-text-muted`, `--tt-text-dim` | Textstufen |
| `--tt-accent`, `--tt-accent-contrast`, `--tt-accent-glow`, `--tt-accent-soft` | Primäraktion, aktuelle Note, Cursor, Playhead, aktive Segmente |
| `--tt-tune`, `--tt-flat`, `--tt-sharp` | **Feedback: sauber / zu tief / zu hoch** |
| `--tt-ok`, `--tt-silent` | knapp getroffen / nicht gesungen |
| `--tt-free` | Tonhöhenlinie ohne Zielnote (Pause) |
| `--tt-level-from`, `--tt-level-to` | Pegelanzeige, Übungszeit-Balken |
| `--tt-roll-*` | Piano-Roll: kommende/vergangene/andere Noten, Zeilen, Raster, Taktstriche, Labels, Loop, Silbenschrift |
| `--tt-paper`, `--tt-score-ink`, `--tt-score-other`, `--tt-score-cursor` | Partitur-Papier, eigene Stimme, andere Stimmen, Cursor |
| `--tt-paper-good/-ok/-flat/-sharp/-silent` | Bewertungsfarben **auf dem Papier** (dunkler als die UI-Varianten) |
| `--tt-radius-lg/-md/-sm`, `--tt-shadow`, `--tt-gap` | Form, Abstände |

## Was frei ist
Schriften, Flächen, Radien, Schatten, Button-/Select-/Dialog-Stil, Icon-Set, Akzentfarbe, Hell- oder Dunkel-Theme, Animationen der Dialoge.

## Was fix bleibt
1. **Drei unterscheidbare Feedback-Farben** mit fester Bedeutung: zu tief = kühl (blau), sauber = eindeutig „richtig“ (grün/mint), zu hoch = warm (orange). Richtung wird zusätzlich durch Pfeile (↑ höher singen / ↓ tiefer singen) gezeigt, also nicht nur über Farbe.
2. Die Feedback-Farben gelten überall gleich: Tuner, Linie in der Rolle, Notenbalken, Partitur, Auswertung.
3. **Partitur auf hellem Papier**, auch im Dark Mode.
4. Akzentfarbe ≠ Feedback-Farben (sonst verwechselt man „aktuelle Note“ mit „getroffen“).
5. Aufbau und Größenverhältnisse aus TRAININGSANSICHT.md (Tuner rechts über volle Höhe; Handy: Partitur / kompakter Tuner / Rolle).
6. Notenname im Tuner bleibt die größte Typografie der Ansicht.
7. Kontrast: Text ≥ 4,5:1, die Feedback-Farben auf `--tt-bg` ≥ 3:1.

## Icons
Verwendet aus `lucide-react`: ArrowLeft, ArrowUp, ArrowDown, BarChart3, Check, Flame, FileMusic, Gauge, Headphones, Hourglass, Mic, MicOff, Minus, Music2, Pause, Play, Plus, Repeat, Settings2, SkipBack, SkipForward, SlidersHorizontal, Target, Timer, TrendingDown, TrendingUp, User, Users, Volume2, VolumeX, X. Beim Wechsel auf das Host-Icon-Set 1:1 ersetzen.

## Primitive tauschen
`react/ui.tsx` enthält Dialog (natives `<dialog>`), Segmented (Radiogroup), Switch (Checkbox mit `role="switch"`), Slider (Range). Popover in `TransportBar` nutzen das native `popover`-Attribut. Wer Host-Komponenten einsetzt, behält die Props-Semantik bei.

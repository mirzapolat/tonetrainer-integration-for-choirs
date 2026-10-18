/*
 * Simulierter Sänger – testet Erkennung, Bewertung und Statistik ohne zu singen.
 *
 * Verwendung (Browser-Konsole, Entwicklung):
 *   1. Dieses Skript in die Konsole einfügen, BEVOR die Trainingsansicht geöffnet wird
 *      (bzw. danach neu öffnen). Es ersetzt getUserMedia durch einen Oszillator mit Obertönen
 *      und setzt window.__TONETRAINER_DEBUG__, damit die Engine als window.__ttEngine erreichbar ist.
 *   2. In der App „Mikrofon aktivieren“ klicken.
 *   3. Automatisch die Zielnoten singen lassen:
 *        ttSinger.auto()                                   // sauber
 *        ttSinger.auto({ detune: -60 })                    // alles 60 Cent zu tief
 *        ttSinger.auto({ skipMeasures: [5], detuneMeasures: { 4: 40 } })   // 0-basierte Takte
 *        ttSinger.auto({ jitter: 25, vibrato: 30 })        // unruhige Stimme
 *      Dann in der App starten (Leertaste). Funktioniert in beiden Modi.
 *   4. Manuell: ttSinger.sing(57, -10)  // MIDI 57 (A3), 10 Cent tief;  ttSinger.sing(null) = still
 *      ttSinger.stop()
 *
 * Erwartung beim Demo-Stück (Tenor) mit { skipMeasures: [5], detuneMeasures: { 4: -60 } }:
 *   Auswertung 71 %, Takt 5 „meist zu tief (Ø 60 Cent)“, Takt 6 „oft nicht gesungen“.
 */
;(() => {
  window.__TONETRAINER_DEBUG__ = true
  let ctx, osc, gain, timer
  navigator.mediaDevices.getUserMedia = async () => {
    ctx = new AudioContext()
    await ctx.resume()
    osc = ctx.createOscillator()
    osc.type = 'sawtooth'
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 1800
    gain = ctx.createGain()
    gain.gain.value = 0
    const dest = ctx.createMediaStreamDestination()
    osc.connect(lp).connect(gain).connect(dest)
    osc.start()
    return dest.stream
  }
  navigator.mediaDevices.enumerateDevices = async () => [{ kind: 'audioinput', deviceId: 'sim', label: 'Simulierter Sänger', groupId: '' }]

  const sing = (midi, cents = 0) => {
    if (!ctx) return 'Mikrofon in der App zuerst aktivieren'
    if (midi == null) {
      gain.gain.setTargetAtTime(0, ctx.currentTime, 0.01)
      return 'still'
    }
    osc.frequency.setValueAtTime(440 * 2 ** ((midi + cents / 100 - 69) / 12), ctx.currentTime)
    gain.gain.setTargetAtTime(0.3, ctx.currentTime, 0.01)
    return 'ok'
  }

  const auto = ({ detune = 0, jitter = 0, vibrato = 0, skipMeasures = [], detuneMeasures = {}, waitDelayMs = 700 } = {}) => {
    clearInterval(timer)
    let waitIdx = -1
    let since = 0
    timer = setInterval(() => {
      const e = window.__ttEngine
      if (!e || !e.running) return sing(null)
      let n
      if (e.mode === 'wait') {
        if (e.waitIdx !== waitIdx) {
          waitIdx = e.waitIdx
          since = performance.now()
        }
        n = e.notes[waitIdx]
        if (performance.now() - since < waitDelayMs) return sing(null)
      } else {
        const b = e.player.currentBeat()
        n = e.notes.find((x) => x.startBeat <= b && b < x.startBeat + x.durBeats - 0.08)
      }
      if (!n || skipMeasures.includes(n.measureIndex)) return sing(null)
      const vib = vibrato * Math.sin((performance.now() / 1000) * 2 * Math.PI * 5.5)
      sing(n.midi, (detuneMeasures[n.measureIndex] ?? detune) + vib + (Math.random() - 0.5) * 2 * jitter)
    }, 15)
    return 'läuft – jetzt in der App starten'
  }

  window.ttSinger = {
    sing,
    auto,
    stop: () => {
      clearInterval(timer)
      return sing(null)
    },
  }
  return 'ttSinger bereit'
})()

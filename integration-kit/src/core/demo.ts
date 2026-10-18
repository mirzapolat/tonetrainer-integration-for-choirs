/**
 * A short original SATB chorale (G major, 4/4) generated as MusicXML, so the app can be tried
 * without a file. The tenor uses the octave-treble clef to exercise <clef-octave-change>.
 */
const LYRICS: [string, boolean][] = [
  ['Lei', true], ['se', false], ['sinkt', false], ['der', false], ['A', true], ['bend', false], ['nie', true], ['der', false],
  ['ü', true], ['ber', false], ['Feld', false], ['und', false], ['Wald', false], ['und', false], ['Hain', false],
  ['al', true], ['le', false], ['Stim', true], ['men', false], ['klin', true], ['gen', false], ['wie', true], ['der', false],
  ['hell', false], ['im', false], ['A', true], ['bend', true], ['schein', false],
]

// Pitches per measure as "Step[#]Octave:quarters".
const VOICES: { id: string; name: string; clef: 'treble' | 'treble8' | 'bass'; bars: string[] }[] = [
  { id: 'S', name: 'Sopran', clef: 'treble', bars: ['G4 A4 B4 C5', 'D5 C5 B4 A4', 'B4 B4 C5 D5', 'E5 D5 G4:2', 'B4 C5 D5 E5', 'D5 C5 B4 A4', 'G4 A4 B4 A4', 'G4:4'] },
  { id: 'A', name: 'Alt', clef: 'treble', bars: ['D4 D4 D4 E4', 'G4 E4 D4 D4', 'G4 G4 G4 F#4', 'G4 G4 D4:2', 'G4 E4 G4 G4', 'G4 G4 G4 F#4', 'D4 D4 E4 D4', 'D4:4'] },
  { id: 'T', name: 'Tenor', clef: 'treble8', bars: ['B3 A3 G3 G3', 'B3 A3 G3 F#3', 'D4 E4 E4 A3', 'C4 B3 B3:2', 'D4 A3 B3 C4', 'B3 C4 D4 D4', 'B3 F#3 G3 F#3', 'B3:4'] },
  { id: 'B', name: 'Bass', clef: 'bass', bars: ['G2 F#2 G2 C3', 'G2 A2 D3 D3', 'G3 E3 C3 D3', 'C3 B2 G2:2', 'G2 A2 B2 C3', 'G2 E3 D3 D3', 'G2 D3 E3 D3', 'G2:4'] },
]

const TYPES: Record<number, string> = { 1: 'quarter', 2: 'half', 4: 'whole' }

function syllabic(i: number) {
  const joinsNext = LYRICS[i]?.[1]
  const joinedFromPrev = i > 0 && LYRICS[i - 1][1]
  if (joinsNext) return joinedFromPrev ? 'middle' : 'begin'
  return joinedFromPrev ? 'end' : 'single'
}

function noteXml(token: string, syl: number) {
  const [pitch, len = '1'] = token.split(':')
  const q = Number(len)
  const m = /^([A-G])(#?)(\d)$/.exec(pitch)!
  const lyric = LYRICS[syl]
  const lyr = lyric ? `<lyric number="1"><syllabic>${syllabic(syl)}</syllabic><text>${lyric[0]}</text></lyric>` : ''
  return `<note><pitch><step>${m[1]}</step>${m[2] ? '<alter>1</alter>' : ''}<octave>${m[3]}</octave></pitch><duration>${q * 2}</duration><voice>1</voice><type>${TYPES[q]}</type>${m[2] ? '<accidental>sharp</accidental>' : ''}${lyr}</note>`
}

function clefXml(clef: string) {
  if (clef === 'bass') return '<clef><sign>F</sign><line>4</line></clef>'
  if (clef === 'treble8') return '<clef><sign>G</sign><line>2</line><clef-octave-change>-1</clef-octave-change></clef>'
  return '<clef><sign>G</sign><line>2</line></clef>'
}

export function demoScoreXml() {
  const parts = VOICES.map((v, pi) => {
    let syl = 0
    const measures = v.bars.map((bar, mi) => {
      const attrs =
        mi === 0
          ? `<attributes><divisions>2</divisions><key><fifths>1</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time>${clefXml(v.clef)}</attributes>` +
            (pi === 0 ? '<direction placement="above"><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>76</per-minute></metronome></direction-type><sound tempo="76"/></direction>' : '')
          : ''
      const notes = bar
        .split(' ')
        .map((t) => noteXml(t, syl++))
        .join('')
      const barline = mi === v.bars.length - 1 ? '<barline location="right"><bar-style>light-heavy</bar-style></barline>' : ''
      return `<measure number="${mi + 1}">${attrs}${notes}${barline}</measure>`
    })
    return `<part id="P${v.id}">${measures.join('')}</part>`
  })
  const partList = VOICES.map((v) => `<score-part id="P${v.id}"><part-name>${v.name}</part-name></score-part>`).join('')
  return `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1"><work><work-title>Abendlied (Demo)</work-title></work><identification><creator type="composer">Tonetrainer</creator></identification><part-list>${partList}</part-list>${parts.join('')}</score-partwise>`
}

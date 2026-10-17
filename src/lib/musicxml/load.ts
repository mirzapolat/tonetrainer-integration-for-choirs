import { strFromU8, unzipSync } from 'fflate'

/** Reads .musicxml / .xml / .mxl (zipped MusicXML) and returns the score XML as a string. */
export async function readScoreFile(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b
  if (!isZip) return decodeText(bytes)

  const entries = unzipSync(bytes)
  let path: string | undefined
  const container = entries['META-INF/container.xml']
  if (container) {
    const doc = new DOMParser().parseFromString(strFromU8(container), 'application/xml')
    path = doc.querySelector('rootfile')?.getAttribute('full-path') ?? undefined
  }
  path ??= Object.keys(entries).find((p) => !p.startsWith('META-INF') && /\.(xml|musicxml)$/i.test(p))
  if (!path || !entries[path]) throw new Error('Die .mxl-Datei enthält keine MusicXML-Partitur.')
  return decodeText(entries[path])
}

function decodeText(bytes: Uint8Array) {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes)
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes)
  return new TextDecoder('utf-8').decode(bytes)
}

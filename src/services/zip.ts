export type ZipEntry = {
  path: string
  data: string | Uint8Array
}

type ZipRecord = {
  name: Uint8Array
  data: Uint8Array
  crc: number
  offset: number
  time: number
  date: number
}

const encoder = new TextEncoder()
const crcTable = createCrcTable()

function createCrcTable() {
  const table = new Uint32Array(256)

  for (let i = 0; i < 256; i += 1) {
    let value = i
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
    }
    table[i] = value >>> 0
  }

  return table
}

function crc32(data: Uint8Array) {
  let value = 0xffffffff

  for (const byte of data) {
    value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8)
  }

  return (value ^ 0xffffffff) >>> 0
}

function toBytes(data: string | Uint8Array) {
  return typeof data === 'string' ? encoder.encode(data) : data
}

function normalizeZipPath(path: string) {
  return path
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .split('/')
    .filter((segment) => segment && segment !== '.' && segment !== '..')
    .join('/')
}

function getDosTimestamp(date = new Date()) {
  const year = Math.min(2107, Math.max(1980, date.getFullYear()))
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2)
  const dosDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()

  return { time: dosTime, date: dosDate }
}

function createHeader(length: number) {
  const header = new Uint8Array(length)
  const view = new DataView(header.buffer)

  return { header, view }
}

function setUint16(view: DataView, offset: number, value: number) {
  view.setUint16(offset, value, true)
}

function setUint32(view: DataView, offset: number, value: number) {
  view.setUint32(offset, value >>> 0, true)
}

function createLocalHeader(record: ZipRecord) {
  const { header, view } = createHeader(30)

  setUint32(view, 0, 0x04034b50)
  setUint16(view, 4, 20)
  setUint16(view, 6, 0x0800)
  setUint16(view, 8, 0)
  setUint16(view, 10, record.time)
  setUint16(view, 12, record.date)
  setUint32(view, 14, record.crc)
  setUint32(view, 18, record.data.length)
  setUint32(view, 22, record.data.length)
  setUint16(view, 26, record.name.length)
  setUint16(view, 28, 0)

  return header
}

function createCentralHeader(record: ZipRecord) {
  const { header, view } = createHeader(46)

  setUint32(view, 0, 0x02014b50)
  setUint16(view, 4, 20)
  setUint16(view, 6, 20)
  setUint16(view, 8, 0x0800)
  setUint16(view, 10, 0)
  setUint16(view, 12, record.time)
  setUint16(view, 14, record.date)
  setUint32(view, 16, record.crc)
  setUint32(view, 20, record.data.length)
  setUint32(view, 24, record.data.length)
  setUint16(view, 28, record.name.length)
  setUint16(view, 30, 0)
  setUint16(view, 32, 0)
  setUint16(view, 34, 0)
  setUint16(view, 36, 0)
  setUint32(view, 38, 0)
  setUint32(view, 42, record.offset)

  return header
}

function createEndOfCentralDirectory(fileCount: number, centralSize: number, centralOffset: number) {
  const { header, view } = createHeader(22)

  setUint32(view, 0, 0x06054b50)
  setUint16(view, 4, 0)
  setUint16(view, 6, 0)
  setUint16(view, 8, fileCount)
  setUint16(view, 10, fileCount)
  setUint32(view, 12, centralSize)
  setUint32(view, 16, centralOffset)
  setUint16(view, 20, 0)

  return header
}

export function createZipBlob(entries: ZipEntry[]) {
  const chunks: Uint8Array[] = []
  const centralChunks: Uint8Array[] = []
  const records: ZipRecord[] = []
  const timestamp = getDosTimestamp()
  let offset = 0

  for (const entry of entries) {
    const name = encoder.encode(normalizeZipPath(entry.path))
    const data = toBytes(entry.data)
    const record: ZipRecord = {
      name,
      data,
      crc: crc32(data),
      offset,
      time: timestamp.time,
      date: timestamp.date,
    }
    const localHeader = createLocalHeader(record)

    chunks.push(localHeader, name, data)
    records.push(record)
    offset += localHeader.length + name.length + data.length
  }

  const centralOffset = offset

  for (const record of records) {
    const centralHeader = createCentralHeader(record)
    centralChunks.push(centralHeader, record.name)
    offset += centralHeader.length + record.name.length
  }

  const centralSize = offset - centralOffset
  const end = createEndOfCentralDirectory(records.length, centralSize, centralOffset)
  const allChunks = [...chunks, ...centralChunks, end]
  const totalLength = allChunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const zipBytes = new Uint8Array(totalLength)
  let cursor = 0

  for (const chunk of allChunks) {
    zipBytes.set(chunk, cursor)
    cursor += chunk.length
  }

  return new Blob([zipBytes.buffer], { type: 'application/zip' })
}

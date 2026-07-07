import type { DataPackage } from '../types/dataPackage'
import type { ProductCatalog, ProductPart } from '../types/product'
import { resolveAssetPath } from './assetPath'
import { dataPackageToSqliteBytes, sqliteBytesToDataPackage, sqliteFileToDataPackage } from './sqliteDataPackage'
import { createZipBlob, readZipEntries, type ZipEntry, type ZipReadEntry } from './zip'

const dbName = 'bucket-demo-2d-db'
const dbVersion = 1
const storeName = 'dataPackages'
const activePackageKey = 'active'
const dataManagerDraftKey = 'data-manager-draft'

type PartGroup = 'excavators' | 'buckets' | 'teeth'

type ImageAsset = {
  path: string
  data: Uint8Array
}

type StoredSqlitePackage = {
  format: 'sqlite'
  name: string
  updatedAt: string
  bytes: Uint8Array | number[] | ArrayBuffer
}

type StoredPackage = DataPackage | StoredSqlitePackage

export function cloneSerializable<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function openDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(dbName, dbVersion)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(storeName)) {
        db.createObjectStore(storeName)
      }
    }

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
  })
}

async function withStore<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>) {
  const db = await openDb()

  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(storeName, mode)
    const store = tx.objectStore(storeName)
    const request = operation(store)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
    tx.oncomplete = () => db.close()
    tx.onerror = () => {
      db.close()
      reject(tx.error)
    }
  })
}

function isStoredSqlitePackage(value: unknown): value is StoredSqlitePackage {
  return Boolean(value && typeof value === 'object' && 'format' in value && value.format === 'sqlite')
}

function sqliteBytesFromStoredPackage(value: StoredSqlitePackage) {
  if (value.bytes instanceof Uint8Array) return value.bytes
  if (value.bytes instanceof ArrayBuffer) return new Uint8Array(value.bytes)

  return new Uint8Array(value.bytes)
}

export async function getActiveDataPackage() {
  const saved = await withStore<StoredPackage | undefined>('readonly', (store) => store.get(activePackageKey))
  if (!saved) return undefined

  return isStoredSqlitePackage(saved)
    ? sqliteBytesToDataPackage(sqliteBytesFromStoredPackage(saved), saved.name)
    : saved
}

export async function saveActiveDataPackage(dataPackage: DataPackage) {
  const bytes = await dataPackageToSqliteBytes(dataPackage)
  const storedPackage: StoredSqlitePackage = {
    format: 'sqlite',
    name: dataPackage.name,
    updatedAt: dataPackage.updatedAt,
    bytes,
  }

  return withStore<IDBValidKey>('readwrite', (store) => store.put(storedPackage, activePackageKey))
}

export function clearActiveDataPackage() {
  return withStore<undefined>('readwrite', (store) => store.delete(activePackageKey))
}

export function getDataManagerDraft<T>() {
  return withStore<T | undefined>('readonly', (store) => store.get(dataManagerDraftKey))
}

export function saveDataManagerDraft<T>(draft: T) {
  return withStore<IDBValidKey>('readwrite', (store) => store.put(draft, dataManagerDraftKey))
}

export function clearDataManagerDraft() {
  return withStore<undefined>('readwrite', (store) => store.delete(dataManagerDraftKey))
}

export function createDataPackage(name: string, catalog: ProductCatalog, layouts: Record<string, DataPackage['layouts'][string]>): DataPackage {
  return {
    schemaVersion: 1,
    name,
    updatedAt: new Date().toISOString(),
    catalog: cloneSerializable(catalog),
    layouts: cloneSerializable(layouts ?? {}),
  }
}

export async function loadBuiltinDataPackage() {
  const response = await fetch(resolveAssetPath('/data/mock-products.sqlite'))
  if (!response.ok) {
    throw new Error('内置 SQLite 产品数据库加载失败。')
  }

  return sqliteBytesToDataPackage(new Uint8Array(await response.arrayBuffer()), 'mock-products')
}

async function urlToDataUrl(url: string) {
  const blob = await urlToBlob(url)

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error)
    reader.onload = () => resolve(String(reader.result))
    reader.readAsDataURL(blob)
  })
}

async function urlToBlob(url: string) {
  const response = await fetch(resolveAssetPath(url))
  if (!response.ok) {
    throw new Error(`图片无法导出：${url}`)
  }

  return response.blob()
}

function dataUrlToBytes(dataUrl: string) {
  const [meta, payload] = dataUrl.split(',')
  if (!payload) {
    throw new Error('图片 data URL 格式不正确')
  }

  const mimeMatch = meta.match(/^data:([^;]+);base64$/)
  const mimeType = mimeMatch?.[1] ?? 'application/octet-stream'
  const binary = atob(payload)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return {
    bytes,
    extension: extensionFromMime(mimeType),
  }
}

function extensionFromMime(mimeType: string) {
  const extensionMap: Record<string, string> = {
    'image/svg+xml': 'svg',
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif',
  }

  return extensionMap[mimeType] ?? 'bin'
}

function extensionFromPath(path: string) {
  const pathname = path.split('?')[0].split('#')[0]
  const extension = pathname.match(/\.([a-z0-9]+)$/i)?.[1]

  return extension?.toLowerCase() ?? 'bin'
}

function mimeFromPath(path: string) {
  const extension = extensionFromPath(path)
  const mimeMap: Record<string, string> = {
    svg: 'image/svg+xml',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    gif: 'image/gif',
  }

  return mimeMap[extension] ?? 'application/octet-stream'
}

function safeFileSegment(value: string) {
  return value
    .trim()
    .replace(/[^a-z0-9\u4e00-\u9fa5_-]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.style.display = 'none'
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function embedCatalogImages(dataPackage: DataPackage) {
  const nextPackage = cloneSerializable(dataPackage)
  const failedImages: string[] = []

  for (const { group, part } of getAllParts(nextPackage.catalog)) {
    if (!part.image || part.image.startsWith('data:')) continue

    try {
      updatePartImage(nextPackage.catalog, group, part.id, await urlToDataUrl(part.image))
    } catch {
      failedImages.push(`${part.name}: ${part.image}`)
    }
  }

  if (failedImages.length) {
    throw new Error(`以下图片无法内嵌，请检查路径或先用高级入口导入包含图片的文件夹：${failedImages.join('；')}`)
  }

  return nextPackage
}

export async function downloadDataPackage(dataPackage: DataPackage) {
  const sqliteBytes = await dataPackageToSqliteBytes(dataPackage, { embedExternalImages: true })
  downloadBlob(
    new Blob([copyToArrayBuffer(sqliteBytes)], { type: 'application/vnd.sqlite3' }),
    `${dataPackage.name || 'bucket-demo-data'}.sqlite`,
  )
}

export async function createPortableDataPackage(dataPackage: DataPackage) {
  const nextPackage = cloneSerializable(dataPackage)
  const assets: ImageAsset[] = []
  const failedImages: string[] = []

  for (const { group, part } of getAllParts(nextPackage.catalog)) {
    if (!part.image) continue

    try {
      const asset = await createImageAsset(group, part)
      updatePartImage(nextPackage.catalog, group, part.id, asset.path)
      assets.push(asset)
    } catch {
      failedImages.push(`${part.name}: ${part.image}`)
    }
  }

  if (failedImages.length) {
    throw new Error(`以下图片无法写入 ZIP，请检查路径或先用高级入口导入包含图片的文件夹：${failedImages.join('；')}`)
  }

  return {
    ...nextPackage,
    updatedAt: new Date().toISOString(),
    assets,
  }
}

async function createImageAsset(group: PartGroup, part: ProductPart): Promise<ImageAsset> {
  const baseName = safeFileSegment(part.id || part.name)

  if (part.image.startsWith('data:')) {
    const { bytes, extension } = dataUrlToBytes(part.image)
    return {
      path: `assets/equipment/${group}/${baseName}.${extension}`,
      data: bytes,
    }
  }

  const blob = await urlToBlob(part.image)
  const bytes = new Uint8Array(await blob.arrayBuffer())
  const extension = extensionFromPath(part.image) || extensionFromMime(blob.type)

  return {
    path: `assets/equipment/${group}/${baseName}.${extension}`,
    data: bytes,
  }
}

export async function downloadDataPackageZip(dataPackage: DataPackage) {
  const sqliteBytes = await dataPackageToSqliteBytes(dataPackage, { embedExternalImages: true })
  const entries: ZipEntry[] = [
    {
      path: 'bucket-demo.sqlite',
      data: sqliteBytes,
    },
    {
      path: 'README.txt',
      data: [
        'Bucket Demo SQLite 数据包',
        '',
        'bucket-demo.sqlite: 产品数据、分类、图片、描述、参数、兼容关系、组合校准',
        '图片已经写入 SQLite 的 product_assets 表，可直接导入，不需要解压。',
        '',
        '在网页的数据包管理页选择“导入 ZIP 数据包”，直接选择此 ZIP 即可恢复，无需解压。',
      ].join('\n'),
    },
  ]

  downloadBlob(createZipBlob(entries), `${dataPackage.name || 'bucket-demo-data'}.zip`)
}

export async function readJsonFile(file: File) {
  const text = await file.text()
  const parsed = JSON.parse(text) as DataPackage | ProductCatalog

  if ('catalog' in parsed && 'layouts' in parsed) {
    return parsed
  }

  return createDataPackage(file.name.replace(/\.json$/i, ''), parsed, {})
}

export function readSqliteFile(file: File) {
  return sqliteFileToDataPackage(file)
}

function normalizePath(path: string) {
  return path.replace(/^\.?\//, '').replace(/^public\//, '').replace(/^src\//, '').replace(/^data\//, '')
}

function isSqlitePath(path: string) {
  return /\.(sqlite|sqlite3|db)$/i.test(path)
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error)
    reader.onload = () => resolve(String(reader.result))
    reader.readAsDataURL(file)
  })
}

function copyToArrayBuffer(bytes: Uint8Array) {
  const buffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(buffer).set(bytes)

  return buffer
}

function bytesToDataUrl(bytes: Uint8Array, mimeType: string) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    const blob = new Blob([copyToArrayBuffer(bytes)], { type: mimeType })
    reader.onerror = () => reject(reader.error)
    reader.onload = () => resolve(String(reader.result))
    reader.readAsDataURL(blob)
  })
}

function getAllParts(catalog: ProductCatalog) {
  return [
    ...catalog.excavators.map((part) => ({ group: 'excavators' as PartGroup, part })),
    ...catalog.buckets.map((part) => ({ group: 'buckets' as PartGroup, part })),
    ...catalog.teeth.map((part) => ({ group: 'teeth' as PartGroup, part })),
  ]
}

function updatePartImage(catalog: ProductCatalog, group: PartGroup, id: string, image: string) {
  const parts = catalog[group] as ProductPart[]
  const target = parts.find((part) => part.id === id)
  if (target) {
    target.image = image
  }
}

function findAssetFile(files: File[], imagePath: string) {
  const normalizedImage = normalizePath(imagePath)
  const imageBasename = normalizedImage.split('/').at(-1)

  return files.find((file) => {
    const relativePath = normalizePath(file.webkitRelativePath || file.name)
    return relativePath.endsWith(normalizedImage) || Boolean(imageBasename && relativePath.endsWith(imageBasename))
  })
}

function findAssetEntry(entries: ZipReadEntry[], imagePath: string) {
  const normalizedImage = normalizePath(imagePath)
  const imageBasename = normalizedImage.split('/').at(-1)

  return entries.find((entry) => {
    const relativePath = normalizePath(entry.path)
    return relativePath.endsWith(normalizedImage) || Boolean(imageBasename && relativePath.endsWith(imageBasename))
  })
}

export async function createDataPackageFromFolder(files: File[]) {
  const sqliteFile = files.find((file) => {
    return isSqlitePath(normalizePath(file.webkitRelativePath || file.name))
  })

  if (sqliteFile) {
    const dataPackage = await sqliteFileToDataPackage(sqliteFile)
    const catalog = cloneSerializable(dataPackage.catalog)

    for (const { group, part } of getAllParts(catalog)) {
      if (!part.image || part.image.startsWith('data:')) continue

      const assetFile = findAssetFile(files, part.image)
      if (assetFile) {
        updatePartImage(catalog, group, part.id, await fileToDataUrl(assetFile))
      }
    }

    return {
      ...dataPackage,
      name: dataPackage.name || sqliteFile.webkitRelativePath.split('/')[0] || 'bucket-demo-data',
      updatedAt: new Date().toISOString(),
      catalog,
    }
  }

  const jsonFile = files.find((file) => {
    const relativePath = normalizePath(file.webkitRelativePath || file.name)
    return relativePath.endsWith('products.json') || relativePath.endsWith('data-package.json')
  })

  if (!jsonFile) {
    throw new Error('文件夹里没有找到 .sqlite/.db 数据库。旧数据迁移时也可包含 products.json 或 data-package.json。')
  }

  const dataPackage = await readJsonFile(jsonFile)
  const catalog = cloneSerializable(dataPackage.catalog)

  for (const { group, part } of getAllParts(catalog)) {
    if (part.image.startsWith('data:')) continue

    const assetFile = findAssetFile(files, part.image)
    if (assetFile) {
      updatePartImage(catalog, group, part.id, await fileToDataUrl(assetFile))
    }
  }

  return {
    ...dataPackage,
    name: dataPackage.name || jsonFile.webkitRelativePath.split('/')[0] || 'bucket-demo-data',
    updatedAt: new Date().toISOString(),
    catalog,
  }
}

export async function createDataPackageFromZip(file: File) {
  const entries = await readZipEntries(file)
  const sqliteEntry = entries.find((entry) => isSqlitePath(normalizePath(entry.path)))

  if (sqliteEntry) {
    const dataPackage = await sqliteBytesToDataPackage(sqliteEntry.data, file.name.replace(/\.zip$/i, ''))
    const catalog = cloneSerializable(dataPackage.catalog)

    for (const { group, part } of getAllParts(catalog)) {
      if (!part.image || part.image.startsWith('data:')) continue

      const assetEntry = findAssetEntry(entries, part.image)
      if (assetEntry) {
        updatePartImage(catalog, group, part.id, await bytesToDataUrl(assetEntry.data, mimeFromPath(assetEntry.path)))
      }
    }

    return {
      ...dataPackage,
      name: dataPackage.name || file.name.replace(/\.zip$/i, '') || 'bucket-demo-data',
      updatedAt: new Date().toISOString(),
      catalog,
    }
  }

  const jsonEntry = entries.find((entry) => {
    const path = normalizePath(entry.path)
    return path.endsWith('data-package.json') || path.endsWith('products.json')
  })

  if (!jsonEntry) {
    throw new Error('ZIP 里没有找到 SQLite 数据库。旧数据迁移时也可包含 data-package.json 或 products.json。')
  }

  const parsed = JSON.parse(jsonEntry.text()) as DataPackage | ProductCatalog
  const dataPackage = 'catalog' in parsed && 'layouts' in parsed
    ? parsed
    : createDataPackage(file.name.replace(/\.zip$/i, ''), parsed, {})
  const catalog = cloneSerializable(dataPackage.catalog)
  const missingImages: string[] = []

  for (const { group, part } of getAllParts(catalog)) {
    if (!part.image || part.image.startsWith('data:')) continue

    const assetEntry = findAssetEntry(entries, part.image)
    if (assetEntry) {
      updatePartImage(catalog, group, part.id, await bytesToDataUrl(assetEntry.data, mimeFromPath(assetEntry.path)))
    } else {
      missingImages.push(`${part.name}: ${part.image}`)
    }
  }

  if (missingImages.length) {
    throw new Error(`ZIP 中缺少以下图片文件：${missingImages.join('；')}`)
  }

  return {
    ...dataPackage,
    name: dataPackage.name || file.name.replace(/\.zip$/i, '') || 'bucket-demo-data',
    updatedAt: new Date().toISOString(),
    catalog,
  }
}

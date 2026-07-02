import type { DataPackage } from '../types/dataPackage'
import type { ProductCatalog, ProductPart } from '../types/product'
import { createZipBlob, type ZipEntry } from './zip'

const dbName = 'bucket-demo-2d-db'
const dbVersion = 1
const storeName = 'dataPackages'
const activePackageKey = 'active'

type PartGroup = 'excavators' | 'buckets' | 'teeth'

type ImageAsset = {
  path: string
  data: Uint8Array
}

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

export function getActiveDataPackage() {
  return withStore<DataPackage | undefined>('readonly', (store) => store.get(activePackageKey))
}

export function saveActiveDataPackage(dataPackage: DataPackage) {
  return withStore<IDBValidKey>('readwrite', (store) => store.put(dataPackage, activePackageKey))
}

export function clearActiveDataPackage() {
  return withStore<undefined>('readwrite', (store) => store.delete(activePackageKey))
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
  const response = await fetch(url)
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
    throw new Error(`以下图片无法内嵌，请改用“导入文件夹”或检查路径：${failedImages.join('；')}`)
  }

  return nextPackage
}

export async function downloadDataPackage(dataPackage: DataPackage) {
  const embeddedPackage = await embedCatalogImages(dataPackage)
  const payload = JSON.stringify(
    {
      ...embeddedPackage,
      updatedAt: new Date().toISOString(),
    },
    null,
    2,
  )
  downloadBlob(new Blob([payload], { type: 'application/json;charset=utf-8' }), `${embeddedPackage.name || 'bucket-demo-data'}.json`)
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
    throw new Error(`以下图片无法写入 ZIP，请改用“导入文件夹”或检查路径：${failedImages.join('；')}`)
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
  const { assets, ...portablePackage } = await createPortableDataPackage(dataPackage)
  const entries: ZipEntry[] = [
    {
      path: 'data-package.json',
      data: JSON.stringify(portablePackage, null, 2),
    },
    {
      path: 'README.txt',
      data: [
        'Bucket Demo 数据包',
        '',
        'data-package.json: 产品数据、描述、参数、兼容关系、组合校准',
        'assets/equipment/: 产品图片文件',
        '',
        '在网页的数据包管理页选择“导入文件夹”，选中解压后的整个文件夹即可恢复。',
      ].join('\n'),
    },
    ...assets.map((asset) => ({
      path: asset.path,
      data: asset.data,
    })),
  ]

  downloadBlob(createZipBlob(entries), `${portablePackage.name || 'bucket-demo-data'}.zip`)
}

export async function readJsonFile(file: File) {
  const text = await file.text()
  const parsed = JSON.parse(text) as DataPackage | ProductCatalog

  if ('catalog' in parsed && 'layouts' in parsed) {
    return parsed
  }

  return createDataPackage(file.name.replace(/\.json$/i, ''), parsed, {})
}

function normalizePath(path: string) {
  return path.replace(/^\.?\//, '').replace(/^public\//, '').replace(/^src\//, '').replace(/^data\//, '')
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error)
    reader.onload = () => resolve(String(reader.result))
    reader.readAsDataURL(file)
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

export async function createDataPackageFromFolder(files: File[]) {
  const jsonFile = files.find((file) => {
    const relativePath = normalizePath(file.webkitRelativePath || file.name)
    return relativePath.endsWith('products.json') || relativePath.endsWith('data-package.json')
  })

  if (!jsonFile) {
    throw new Error('文件夹里没有找到 products.json 或 data-package.json')
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

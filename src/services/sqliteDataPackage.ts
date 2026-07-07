import initSqlJs, { type SqlDatabase, type SqlValue } from 'sql.js'
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url'
import type { DataPackage } from '../types/dataPackage'
import type { Bucket, CompatibilityRule, Excavator, ProductCatalog, ProductPart, Tooth } from '../types/product'
import { resolveAssetPath } from './assetPath'
import { sqliteSchema } from './sqliteSchema'

type ProductType = 'excavator' | 'bucket' | 'tooth'
type ProductGroup = 'excavators' | 'buckets' | 'teeth'

type SqliteExportOptions = {
  embedExternalImages?: boolean
}

type MetadataRow = {
  key: string
  value: string
}

type StageRow = {
  width: number
  height: number
  default_scale: number
}

type DefaultsRow = {
  excavator_id: string
  bucket_id: string
  tooth_id: string
}

type ProductRow = {
  id: string
  type: ProductType
  name: string
  series: string
  image: string
  anchor_x: number
  anchor_y: number
  hotspot_x: number
  hotspot_y: number
  hotspot_radius: number
  hotspot_label: string
  width: number
  height: number
  description: string
  notes: string
  tonnage: string | null
  capacity: string | null
  material: string | null
  mount_offset_x: number
  mount_offset_y: number
}

type AssetRow = {
  product_id: string
  file_name: string
  mime_type: string
  data: Uint8Array
}

type SellingPointRow = {
  product_id: string
  text: string
}

type ExcavatorBucketRow = {
  excavator_id: string
  bucket_id: string
}

type BucketToothRow = {
  bucket_id: string
  tooth_id: string
}

type FitmentRuleRow = {
  id: string
  excavator_id: string
  bucket_id: string
  fitment: string
  remark: string
}

type FitmentRuleToothRow = {
  rule_id: string
  tooth_id: string
}

type LayoutRow = {
  combination_key: string
  excavator_id: string
  bucket_id: string
  tooth_id: string
}

type AdjustmentRow = {
  combination_key: string
  part_type: ProductType
  offset_x: number
  offset_y: number
  scale: number
  rotate_z: number
}

let sqlPromise: ReturnType<typeof initSqlJs> | undefined

function getSql() {
  sqlPromise ??= initSqlJs({
    locateFile: () => wasmUrl,
  })

  return sqlPromise
}

function rows<T>(db: SqlDatabase, sql: string, params: SqlValue[] = []) {
  const statement = db.prepare(sql)
  const result: T[] = []

  try {
    if (params.length) {
      statement.bind(params)
    }

    while (statement.step()) {
      result.push(statement.getAsObject() as T)
    }
  } finally {
    statement.free()
  }

  return result
}

function row<T>(db: SqlDatabase, sql: string, params: SqlValue[] = []) {
  return rows<T>(db, sql, params)[0]
}

function insertMetadata(db: SqlDatabase, key: string, value: string | number) {
  db.run('INSERT INTO metadata (key, value) VALUES (?, ?)', [key, String(value)])
}

function createCombinationKey(excavatorId: string, bucketId: string, toothId: string) {
  return `${excavatorId}::${bucketId}::${toothId}`
}

function safeFileSegment(value: string) {
  return value
    .trim()
    .replace(/[^a-z0-9\u4e00-\u9fa5_-]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'product'
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
  return pathname.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase() ?? 'bin'
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

function dataUrlToAsset(dataUrl: string) {
  const [meta, payload] = dataUrl.split(',')
  if (!payload) throw new Error('图片 data URL 格式不正确')

  const mimeType = meta.match(/^data:([^;]+);base64$/)?.[1] ?? 'application/octet-stream'
  const binary = atob(payload)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return {
    bytes,
    mimeType,
    extension: extensionFromMime(mimeType),
  }
}

function bytesToBase64(bytes: Uint8Array) {
  const chunkSize = 0x8000
  let binary = ''

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize))
  }

  return btoa(binary)
}

function bytesToDataUrl(bytes: Uint8Array, mimeType: string) {
  return `data:${mimeType};base64,${bytesToBase64(bytes)}`
}

function uint8ArrayFromSqlValue(value: SqlValue) {
  if (value instanceof Uint8Array) return value
  if (Array.isArray(value)) return new Uint8Array(value)

  return new Uint8Array()
}

async function createImageAsset(group: ProductGroup, part: ProductPart, options: SqliteExportOptions) {
  const baseName = safeFileSegment(part.id || part.name)

  if (part.image.startsWith('data:')) {
    const asset = dataUrlToAsset(part.image)
    return {
      fileName: `assets/equipment/${group}/${baseName}.${asset.extension}`,
      mimeType: asset.mimeType,
      bytes: asset.bytes,
    }
  }

  if (!options.embedExternalImages || !part.image) return null

  const response = await fetch(resolveAssetPath(part.image))
  if (!response.ok) {
    throw new Error(`图片无法写入 SQLite：${part.image}`)
  }

  const blob = await response.blob()
  const extension = extensionFromPath(part.image) || extensionFromMime(blob.type)

  return {
    fileName: `assets/equipment/${group}/${baseName}.${extension}`,
    mimeType: blob.type || mimeFromPath(part.image),
    bytes: new Uint8Array(await blob.arrayBuffer()),
  }
}

function insertProductCategories(db: SqlDatabase) {
  const categories = [
    ['cat-excavators', 'excavator', '挖掘机', 10],
    ['cat-buckets', 'bucket', '挖斗', 20],
    ['cat-teeth', 'tooth', '斗齿', 30],
  ]

  for (const category of categories) {
    db.run(
      'INSERT INTO product_categories (id, type, name, sort_order) VALUES (?, ?, ?, ?)',
      category,
    )
  }
}

function partMountOffset(part: ProductPart) {
  if ('mountOffset' in part && part.mountOffset && typeof part.mountOffset === 'object') {
    return part.mountOffset as { x: number; y: number }
  }

  return { x: 0, y: 0 }
}

async function insertProduct(db: SqlDatabase, type: ProductType, group: ProductGroup, part: ProductPart, options: SqliteExportOptions) {
  const mountOffset = partMountOffset(part)
  const typedPart = part as Partial<Excavator & Bucket & Tooth>
  const imageAsset = await createImageAsset(group, part, options)
  const image = imageAsset?.fileName ?? part.image
  const categoryId = type === 'excavator' ? 'cat-excavators' : type === 'bucket' ? 'cat-buckets' : 'cat-teeth'

  db.run(
    `INSERT INTO products (
      id, type, category_id, name, series, image,
      anchor_x, anchor_y, hotspot_x, hotspot_y, hotspot_radius, hotspot_label,
      width, height, description, notes,
      tonnage, capacity, material, mount_offset_x, mount_offset_y
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      part.id,
      type,
      categoryId,
      part.name,
      part.series,
      image,
      part.anchor.x,
      part.anchor.y,
      part.hotspot.x,
      part.hotspot.y,
      part.hotspot.radius,
      part.hotspot.label,
      part.dimensions.width,
      part.dimensions.height,
      part.description,
      part.notes,
      typedPart.tonnage ?? null,
      typedPart.capacity ?? null,
      typedPart.material ?? null,
      mountOffset.x,
      mountOffset.y,
    ],
  )

  if (imageAsset) {
    db.run(
      'INSERT INTO product_assets (product_id, file_name, mime_type, data) VALUES (?, ?, ?, ?)',
      [part.id, imageAsset.fileName, imageAsset.mimeType, imageAsset.bytes],
    )
  }

  part.sellingPoints.forEach((point, index) => {
    db.run(
      'INSERT INTO selling_points (product_id, sort_order, text) VALUES (?, ?, ?)',
      [part.id, index, point],
    )
  })
}

function insertCompatibility(db: SqlDatabase, catalog: ProductCatalog) {
  for (const excavator of catalog.excavators) {
    for (const bucketId of excavator.compatibleBucketIds) {
      db.run(
        'INSERT OR IGNORE INTO excavator_bucket_compatibility (excavator_id, bucket_id) VALUES (?, ?)',
        [excavator.id, bucketId],
      )
    }
  }

  for (const bucket of catalog.buckets) {
    for (const excavatorId of bucket.compatibleExcavatorIds) {
      db.run(
        'INSERT OR IGNORE INTO excavator_bucket_compatibility (excavator_id, bucket_id) VALUES (?, ?)',
        [excavatorId, bucket.id],
      )
    }

    for (const toothId of bucket.compatibleToothIds) {
      db.run(
        'INSERT OR IGNORE INTO bucket_tooth_compatibility (bucket_id, tooth_id) VALUES (?, ?)',
        [bucket.id, toothId],
      )
    }
  }

  for (const tooth of catalog.teeth) {
    for (const bucketId of tooth.compatibleBucketIds) {
      db.run(
        'INSERT OR IGNORE INTO bucket_tooth_compatibility (bucket_id, tooth_id) VALUES (?, ?)',
        [bucketId, tooth.id],
      )
    }
  }

  for (const rule of catalog.compatibility) {
    db.run(
      'INSERT OR REPLACE INTO fitment_rules (id, excavator_id, bucket_id, fitment, remark) VALUES (?, ?, ?, ?, ?)',
      [rule.id, rule.excavatorId, rule.bucketId, rule.fitment, rule.remark],
    )

    rule.toothIds.forEach((toothId, index) => {
      db.run(
        'INSERT OR REPLACE INTO fitment_rule_teeth (rule_id, tooth_id, sort_order) VALUES (?, ?, ?)',
        [rule.id, toothId, index],
      )
    })
  }
}

function insertLayouts(db: SqlDatabase, dataPackage: DataPackage) {
  for (const [combinationKey, layout] of Object.entries(dataPackage.layouts)) {
    const [excavatorId, bucketId, toothId] = combinationKey.split('::')
    if (!excavatorId || !bucketId || !toothId) continue

    db.run(
      'INSERT OR REPLACE INTO combination_layouts (combination_key, excavator_id, bucket_id, tooth_id) VALUES (?, ?, ?, ?)',
      [combinationKey, excavatorId, bucketId, toothId],
    )

    for (const [partType, adjustment] of Object.entries(layout.layerAdjustments)) {
      db.run(
        `INSERT OR REPLACE INTO layer_adjustments
          (combination_key, part_type, offset_x, offset_y, scale, rotate_z)
          VALUES (?, ?, ?, ?, ?, ?)`,
        [
          combinationKey,
          partType,
          adjustment.offsetX,
          adjustment.offsetY,
          adjustment.scale,
          adjustment.rotateZ,
        ],
      )
    }
  }
}

export async function dataPackageToSqliteBytes(dataPackage: DataPackage, options: SqliteExportOptions = {}) {
  const SQL = await getSql()
  const db = new SQL.Database()

  try {
    db.run(sqliteSchema)
    db.run('BEGIN TRANSACTION')
    insertMetadata(db, 'schema_version', dataPackage.schemaVersion)
    insertMetadata(db, 'data_package_name', dataPackage.name)
    insertMetadata(db, 'updated_at', new Date().toISOString())
    db.run(
      'INSERT INTO stage (id, width, height, default_scale) VALUES (1, ?, ?, ?)',
      [dataPackage.catalog.stage.width, dataPackage.catalog.stage.height, dataPackage.catalog.stage.defaultScale],
    )
    db.run(
      'INSERT INTO defaults (id, excavator_id, bucket_id, tooth_id) VALUES (1, ?, ?, ?)',
      [
        dataPackage.catalog.defaults.excavatorId,
        dataPackage.catalog.defaults.bucketId,
        dataPackage.catalog.defaults.toothId,
      ],
    )
    insertProductCategories(db)

    for (const product of dataPackage.catalog.excavators) {
      await insertProduct(db, 'excavator', 'excavators', product, options)
    }

    for (const product of dataPackage.catalog.buckets) {
      await insertProduct(db, 'bucket', 'buckets', product, options)
    }

    for (const product of dataPackage.catalog.teeth) {
      await insertProduct(db, 'tooth', 'teeth', product, options)
    }

    insertCompatibility(db, dataPackage.catalog)
    insertLayouts(db, dataPackage)
    db.run('COMMIT')

    return db.export()
  } catch (error) {
    db.run('ROLLBACK')
    throw error
  } finally {
    db.close()
  }
}

function createMetadataMap(metadataRows: MetadataRow[]) {
  return new Map(metadataRows.map((item) => [item.key, item.value]))
}

function groupValues<T, K extends string>(items: T[], keyGetter: (item: T) => K, valueGetter: (item: T) => string) {
  const map = new Map<K, string[]>()

  for (const item of items) {
    const key = keyGetter(item)
    const values = map.get(key) ?? []
    values.push(valueGetter(item))
    map.set(key, values)
  }

  return map
}

function createAssetMap(assetRows: AssetRow[]) {
  const map = new Map<string, AssetRow>()

  for (const rowValue of assetRows) {
    map.set(rowValue.product_id, {
      ...rowValue,
      data: uint8ArrayFromSqlValue(rowValue.data),
    })
  }

  return map
}

function productImage(rowValue: ProductRow, assetMap: Map<string, AssetRow>) {
  const asset = assetMap.get(rowValue.id)
  return asset ? bytesToDataUrl(asset.data, asset.mime_type) : rowValue.image
}

function baseProduct(rowValue: ProductRow, assetMap: Map<string, AssetRow>, sellingPoints: Map<string, string[]>): ProductPart {
  return {
    id: rowValue.id,
    name: rowValue.name,
    series: rowValue.series,
    image: productImage(rowValue, assetMap),
    anchor: { x: Number(rowValue.anchor_x), y: Number(rowValue.anchor_y) },
    hotspot: {
      x: Number(rowValue.hotspot_x),
      y: Number(rowValue.hotspot_y),
      radius: Number(rowValue.hotspot_radius),
      label: rowValue.hotspot_label,
    },
    dimensions: { width: Number(rowValue.width), height: Number(rowValue.height) },
    description: rowValue.description,
    sellingPoints: sellingPoints.get(rowValue.id) ?? [],
    notes: rowValue.notes,
  }
}

function catalogFromDb(db: SqlDatabase): ProductCatalog {
  const stage = row<StageRow>(db, 'SELECT width, height, default_scale FROM stage WHERE id = 1')
  const defaults = row<DefaultsRow>(db, 'SELECT excavator_id, bucket_id, tooth_id FROM defaults WHERE id = 1')
  const productRows = rows<ProductRow>(
    db,
    `SELECT
      id, type, name, series, image,
      anchor_x, anchor_y, hotspot_x, hotspot_y, hotspot_radius, hotspot_label,
      width, height, description, notes,
      tonnage, capacity, material, mount_offset_x, mount_offset_y
    FROM products
    ORDER BY type, rowid`,
  )
  const sellingPoints = groupValues(
    rows<SellingPointRow>(db, 'SELECT product_id, text FROM selling_points ORDER BY product_id, sort_order'),
    (item) => item.product_id,
    (item) => item.text,
  )
  const assetMap = createAssetMap(rows<AssetRow>(db, 'SELECT product_id, file_name, mime_type, data FROM product_assets'))
  const excavatorBucketRows = rows<ExcavatorBucketRow>(db, 'SELECT excavator_id, bucket_id FROM excavator_bucket_compatibility ORDER BY excavator_id, bucket_id')
  const bucketToothRows = rows<BucketToothRow>(db, 'SELECT bucket_id, tooth_id FROM bucket_tooth_compatibility ORDER BY bucket_id, tooth_id')
  const bucketsByExcavator = groupValues(excavatorBucketRows, (item) => item.excavator_id, (item) => item.bucket_id)
  const excavatorsByBucket = groupValues(excavatorBucketRows, (item) => item.bucket_id, (item) => item.excavator_id)
  const teethByBucket = groupValues(bucketToothRows, (item) => item.bucket_id, (item) => item.tooth_id)
  const bucketsByTooth = groupValues(bucketToothRows, (item) => item.tooth_id, (item) => item.bucket_id)

  const excavators = productRows
    .filter((item) => item.type === 'excavator')
    .map((item): Excavator => ({
      ...baseProduct(item, assetMap, sellingPoints),
      tonnage: item.tonnage ?? '',
      compatibleBucketIds: bucketsByExcavator.get(item.id) ?? [],
    }))

  const buckets = productRows
    .filter((item) => item.type === 'bucket')
    .map((item): Bucket => ({
      ...baseProduct(item, assetMap, sellingPoints),
      capacity: item.capacity ?? '',
      compatibleExcavatorIds: excavatorsByBucket.get(item.id) ?? [],
      compatibleToothIds: teethByBucket.get(item.id) ?? [],
      mountOffset: { x: Number(item.mount_offset_x), y: Number(item.mount_offset_y) },
    }))

  const teeth = productRows
    .filter((item) => item.type === 'tooth')
    .map((item): Tooth => ({
      ...baseProduct(item, assetMap, sellingPoints),
      material: item.material ?? '',
      compatibleBucketIds: bucketsByTooth.get(item.id) ?? [],
      mountOffset: { x: Number(item.mount_offset_x), y: Number(item.mount_offset_y) },
    }))

  const fitmentRules = rows<FitmentRuleRow>(
    db,
    'SELECT id, excavator_id, bucket_id, fitment, remark FROM fitment_rules ORDER BY rowid',
  )
  const ruleTeeth = groupValues(
    rows<FitmentRuleToothRow>(db, 'SELECT rule_id, tooth_id FROM fitment_rule_teeth ORDER BY rule_id, sort_order'),
    (item) => item.rule_id,
    (item) => item.tooth_id,
  )
  const compatibility = fitmentRules.map((item): CompatibilityRule => ({
    id: item.id,
    excavatorId: item.excavator_id,
    bucketId: item.bucket_id,
    toothIds: ruleTeeth.get(item.id) ?? [],
    fitment: item.fitment,
    remark: item.remark,
  }))

  return {
    stage: {
      width: Number(stage?.width ?? 1280),
      height: Number(stage?.height ?? 720),
      defaultScale: Number(stage?.default_scale ?? 0.9),
    },
    defaults: {
      excavatorId: defaults?.excavator_id ?? excavators[0]?.id ?? '',
      bucketId: defaults?.bucket_id ?? buckets[0]?.id ?? '',
      toothId: defaults?.tooth_id ?? teeth[0]?.id ?? '',
    },
    excavators,
    buckets,
    teeth,
    compatibility,
  }
}

function layoutsFromDb(db: SqlDatabase): DataPackage['layouts'] {
  const layoutRows = rows<LayoutRow>(
    db,
    'SELECT combination_key, excavator_id, bucket_id, tooth_id FROM combination_layouts ORDER BY rowid',
  )
  const adjustmentRows = rows<AdjustmentRow>(
    db,
    `SELECT combination_key, part_type, offset_x, offset_y, scale, rotate_z
     FROM layer_adjustments
     ORDER BY combination_key, part_type`,
  )
  const layouts: DataPackage['layouts'] = {}

  for (const layout of layoutRows) {
    const combinationKey = layout.combination_key || createCombinationKey(layout.excavator_id, layout.bucket_id, layout.tooth_id)
    layouts[combinationKey] = {
      layerAdjustments: {
        excavator: { offsetX: 0, offsetY: 0, scale: 1, rotateZ: 0 },
        bucket: { offsetX: 0, offsetY: 0, scale: 1, rotateZ: 0 },
        tooth: { offsetX: 0, offsetY: 0, scale: 1, rotateZ: 0 },
      },
    }
  }

  for (const adjustment of adjustmentRows) {
    const layout = layouts[adjustment.combination_key]
    if (!layout) continue

    layout.layerAdjustments[adjustment.part_type] = {
      offsetX: Math.round(Number(adjustment.offset_x)),
      offsetY: Math.round(Number(adjustment.offset_y)),
      scale: Number(Number(adjustment.scale).toFixed(2)),
      rotateZ: Math.round(Number(adjustment.rotate_z)),
    }
  }

  return layouts
}

export async function sqliteBytesToDataPackage(bytes: Uint8Array, fallbackName = 'sqlite-products'): Promise<DataPackage> {
  const SQL = await getSql()
  const db = new SQL.Database(bytes)

  try {
    db.run('PRAGMA foreign_keys = ON')
    const metadata = createMetadataMap(rows<MetadataRow>(db, 'SELECT key, value FROM metadata'))

    return {
      schemaVersion: 1,
      name: metadata.get('data_package_name') ?? fallbackName,
      updatedAt: metadata.get('updated_at') ?? new Date().toISOString(),
      catalog: catalogFromDb(db),
      layouts: layoutsFromDb(db),
    }
  } finally {
    db.close()
  }
}

export async function sqliteFileToDataPackage(file: File) {
  return sqliteBytesToDataPackage(new Uint8Array(await file.arrayBuffer()), file.name.replace(/\.(sqlite|sqlite3|db)$/i, ''))
}

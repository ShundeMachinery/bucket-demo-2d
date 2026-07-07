import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import initSqlJs from 'sql.js'
import { sqliteSchema } from '../src/services/sqliteSchema.ts'

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)))
const catalogPath = `${rootDir}/src/data/products.json`
const outputPath = `${rootDir}/public/data/mock-products.sqlite`
const catalog = JSON.parse(await readFile(catalogPath, 'utf8'))
const SQL = await initSqlJs()
const db = new SQL.Database()

function insertMetadata(key, value) {
  db.run('INSERT INTO metadata (key, value) VALUES (?, ?)', [key, String(value)])
}

function insertProductCategories() {
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

function insertProduct(type, group, part) {
  const mountOffset = part.mountOffset ?? { x: 0, y: 0 }
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
      part.image,
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
      part.tonnage ?? null,
      part.capacity ?? null,
      part.material ?? null,
      mountOffset.x,
      mountOffset.y,
    ],
  )

  part.sellingPoints.forEach((point, index) => {
    db.run(
      'INSERT INTO selling_points (product_id, sort_order, text) VALUES (?, ?, ?)',
      [part.id, index, point],
    )
  })
}

function insertCompatibility() {
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

db.run(sqliteSchema)
db.run('BEGIN TRANSACTION')
insertMetadata('schema_version', 1)
insertMetadata('data_package_name', 'mock-products')
insertMetadata('updated_at', new Date().toISOString())
db.run('INSERT INTO stage (id, width, height, default_scale) VALUES (1, ?, ?, ?)', [
  catalog.stage.width,
  catalog.stage.height,
  catalog.stage.defaultScale,
])
db.run('INSERT INTO defaults (id, excavator_id, bucket_id, tooth_id) VALUES (1, ?, ?, ?)', [
  catalog.defaults.excavatorId,
  catalog.defaults.bucketId,
  catalog.defaults.toothId,
])
insertProductCategories()
catalog.excavators.forEach((part) => insertProduct('excavator', 'excavators', part))
catalog.buckets.forEach((part) => insertProduct('bucket', 'buckets', part))
catalog.teeth.forEach((part) => insertProduct('tooth', 'teeth', part))
insertCompatibility()
db.run('COMMIT')

await mkdir(dirname(outputPath), { recursive: true })
await writeFile(outputPath, db.export())
db.close()
console.log(`Wrote ${outputPath}`)

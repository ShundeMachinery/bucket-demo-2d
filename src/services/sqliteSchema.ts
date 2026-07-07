export const sqliteSchema = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS stage (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  width INTEGER NOT NULL CHECK (width > 0),
  height INTEGER NOT NULL CHECK (height > 0),
  default_scale REAL NOT NULL CHECK (default_scale > 0)
);

CREATE TABLE IF NOT EXISTS defaults (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  excavator_id TEXT NOT NULL,
  bucket_id TEXT NOT NULL,
  tooth_id TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS product_categories (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('excavator', 'bucket', 'tooth', 'general')),
  name TEXT NOT NULL,
  parent_id TEXT REFERENCES product_categories(id) ON DELETE SET NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('excavator', 'bucket', 'tooth')),
  category_id TEXT REFERENCES product_categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  series TEXT NOT NULL DEFAULT '',
  image TEXT NOT NULL DEFAULT '',
  anchor_x REAL NOT NULL,
  anchor_y REAL NOT NULL,
  hotspot_x REAL NOT NULL,
  hotspot_y REAL NOT NULL,
  hotspot_radius REAL NOT NULL CHECK (hotspot_radius >= 0),
  hotspot_label TEXT NOT NULL DEFAULT '',
  width REAL NOT NULL CHECK (width > 0),
  height REAL NOT NULL CHECK (height > 0),
  description TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  tonnage TEXT,
  capacity TEXT,
  material TEXT,
  mount_offset_x REAL NOT NULL DEFAULT 0,
  mount_offset_y REAL NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_products_type ON products(type);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);

CREATE TABLE IF NOT EXISTS product_assets (
  product_id TEXT PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  data BLOB NOT NULL
);

CREATE TABLE IF NOT EXISTS selling_points (
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL,
  text TEXT NOT NULL,
  PRIMARY KEY (product_id, sort_order)
);

CREATE TABLE IF NOT EXISTS excavator_bucket_compatibility (
  excavator_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  bucket_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  PRIMARY KEY (excavator_id, bucket_id)
);

CREATE TABLE IF NOT EXISTS bucket_tooth_compatibility (
  bucket_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  tooth_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  PRIMARY KEY (bucket_id, tooth_id)
);

CREATE TABLE IF NOT EXISTS fitment_rules (
  id TEXT PRIMARY KEY,
  excavator_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  bucket_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  fitment TEXT NOT NULL DEFAULT '',
  remark TEXT NOT NULL DEFAULT '',
  UNIQUE (excavator_id, bucket_id)
);

CREATE TABLE IF NOT EXISTS fitment_rule_teeth (
  rule_id TEXT NOT NULL REFERENCES fitment_rules(id) ON DELETE CASCADE,
  tooth_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (rule_id, tooth_id)
);

CREATE TABLE IF NOT EXISTS combination_layouts (
  combination_key TEXT PRIMARY KEY,
  excavator_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  bucket_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  tooth_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS layer_adjustments (
  combination_key TEXT NOT NULL REFERENCES combination_layouts(combination_key) ON DELETE CASCADE,
  part_type TEXT NOT NULL CHECK (part_type IN ('excavator', 'bucket', 'tooth')),
  offset_x REAL NOT NULL DEFAULT 0,
  offset_y REAL NOT NULL DEFAULT 0,
  scale REAL NOT NULL DEFAULT 1 CHECK (scale > 0),
  rotate_z REAL NOT NULL DEFAULT 0,
  PRIMARY KEY (combination_key, part_type)
);
`

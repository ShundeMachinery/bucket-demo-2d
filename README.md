# Bucket Demo 2D

Vue 3 + Vite + Pinia + Tailwind + Konva 的挖掘机斗齿 2D 装配展示 MVP。

## Run

```bash
bun install
bun run dev
```

## Build

```bash
bun run build
bun run preview
```

GitHub Pages 仓库页需要带仓库名前缀，手动验证线上路径时可运行：

```bash
bun run build:gh-pages
bun run preview
```

## Deploy To GitHub Pages

本项目已包含 GitHub Actions 自动部署配置：`.github/workflows/deploy.yml`。

1. 推送代码到 GitHub `main` 分支。
2. 打开仓库 `Settings` -> `Pages`。
3. 将 `Build and deployment` 的 `Source` 设置为 `GitHub Actions`。
4. 等待 `Actions` 中的 `Deploy GitHub Pages` 工作流完成。
5. 访问 `https://shundemachinery.github.io/bucket-demo-2d/`。

工作流会自动执行：

```bash
bun install --frozen-lockfile
bun run build
```

并把 `dist/` 发布到 GitHub Pages。为了支持 `/data` 页面刷新，部署时会复制 `dist/index.html` 为 `dist/404.html`。

## Structure

```text
src/
  views/
    ConfiguratorView.vue
    DataManagerView.vue
  components/
    ProductSelectorPanel.vue
    PreviewStage.vue
    CombinationSummary.vue
    DataManager.vue
    Toolbar.vue
  services/
    dataPackageDb.ts
    sqliteDataPackage.ts
    sqliteSchema.ts
    zip.ts
  stores/
    configurator.ts
  types/
    dataPackage.ts
    product.ts
  router.ts
public/
  data/
    mock-products.sqlite
  assets/
    equipment/
      excavator-*.svg
      bucket-*.svg
      tooth-*.svg
```

## Data Model

The app now uses SQLite as the data package format. The built-in demo database is:

```text
public/data/mock-products.sqlite
```

SQLite tables include:

- `products`: excavator, bucket, and tooth base information.
- `product_categories`: product classification for future filtering and grouping.
- `product_assets`: image BLOB storage for uploaded/exported product images.
- `selling_points`: ordered product selling points.
- `excavator_bucket_compatibility`: excavator-to-bucket constraints.
- `bucket_tooth_compatibility`: bucket-to-tooth constraints.
- `fitment_rules` and `fitment_rule_teeth`: explicit fitment text and allowed teeth for a host/bucket pair.
- `combination_layouts` and `layer_adjustments`: per-combination position, scale, and rotation calibration.
- `stage`, `defaults`, and `metadata`: canvas setup, default combination, and package metadata.

The schema is defined in `src/services/sqliteSchema.ts`. To regenerate the built-in mock SQLite database from the legacy seed data, run:

```bash
bun run db:seed
```

## Asset Replacement

The demo uses SVG placeholders under `public/assets/equipment`. In production, import products through `数据包管理` and upload transparent PNG or SVG files. Exported SQLite packages write images into `product_assets`, while `dimensions`, `anchor`, and `hotspot` keep product layers aligned to the 1280 x 720 stage.

## Preview Canvas

The preview stage uses `Konva + vue-konva` instead of DOM image layers. Product images are rendered as Canvas objects, selected parts use Konva Transformer controls for dragging, resizing, and rotating, and PNG export uses Konva `stage.toDataURL()`.

## Data Packages

The app can save and load one complete browser-local SQLite package through IndexedDB. Open `数据管理` in the app to:

- Import a `.sqlite`, `.sqlite3`, or `.db` database.
- Import a ZIP package containing `bucket-demo.sqlite`.
- Export a standalone `.sqlite` database for direct inspection or maintenance.
- Export a ZIP package containing `bucket-demo.sqlite` with product image BLOBs, compatibility rules, and per-combination layout calibration.
- Reset to the built-in mock package.

Exported ZIP shape:

```text
mock-products.zip
  bucket-demo.sqlite
  README.txt
```

Recommended folder shape:

```text
customer-demo/
  customer-products.sqlite
```

To reload an exported ZIP, open `数据包管理` and choose `导入 SQLite ZIP` directly. The app reads `bucket-demo.sqlite`, restores product images from `product_assets`, and stores the active package in browser-local IndexedDB as SQLite bytes for offline use. The older JSON/folder import flow remains under advanced operations only for migration.

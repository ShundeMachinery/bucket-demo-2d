# Bucket Demo 2D

Vue 3 + Vite + Pinia + Tailwind + Konva 的挖掘机斗齿 2D 装配展示 MVP。

## Run

```bash
bun install
bun run dev
```

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
    zip.ts
  data/
    products.json
  stores/
    configurator.ts
  types/
    dataPackage.ts
    product.ts
  router.ts
public/
  assets/
    equipment/
      excavator-*.svg
      bucket-*.svg
      tooth-*.svg
```

## Data Model

`src/data/products.json` contains:

- `excavators`: host machine data with `compatibleBucketIds`.
- `buckets`: bucket data with `compatibleExcavatorIds` and `compatibleToothIds`.
- `teeth`: tooth data with `compatibleBucketIds`.
- `compatibility`: explicit fitment rules for excavator + bucket + teeth.
- `anchor` and `hotspot`: unified stage coordinates for accurate layer alignment and selection highlights.

## Asset Replacement

The demo uses SVG placeholders under `public/assets/equipment`. Replace those paths with transparent PNG or production SVG files in `products.json`; keep `dimensions`, `anchor`, and `hotspot` aligned to the 1280 x 720 stage.

## Preview Canvas

The preview stage uses `Konva + vue-konva` instead of DOM image layers. Product images are rendered as Canvas objects, selected parts use Konva Transformer controls for dragging, resizing, and rotating, and PNG export uses Konva `stage.toDataURL()`.

## Data Packages

The app can save and load one complete browser-local data package through IndexedDB. Open `数据管理` in the app to:

- Import a complete `data-package.json`.
- Import a folder containing `products.json` or `data-package.json` plus image files.
- Export a ZIP package containing `data-package.json`, product image files, compatibility rules, and per-combination layout calibration.
- Reset to the built-in mock package.

Exported ZIP shape:

```text
mock-products.zip
  data-package.json
  README.txt
  assets/
    equipment/
      excavators/
      buckets/
      teeth/
```

Recommended folder shape:

```text
customer-demo/
  products.json
  assets/
    equipment/
      excavator-01.png
      bucket-01.png
      tooth-01.png
```

To reload an exported ZIP, open `数据包管理` and choose `导入 ZIP 数据包` directly. The app reads `data-package.json`, restores image files from `assets/equipment/`, and stores the active package in browser-local IndexedDB for offline use. The older JSON/folder import flow remains available under advanced operations for compatibility.

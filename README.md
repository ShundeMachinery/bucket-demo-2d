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

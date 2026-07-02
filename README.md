# Bucket Demo 2D

Vue 3 + Vite + Pinia + Tailwind 的挖掘机斗齿 2D 装配展示 MVP。

## Run

```bash
bun install
bun run dev
```

## Structure

```text
src/
  components/
    ProductSelectorPanel.vue
    PreviewStage.vue
    CombinationSummary.vue
    CompatibilityHint.vue
    Toolbar.vue
  data/
    products.json
  stores/
    configurator.ts
  types/
    product.ts
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

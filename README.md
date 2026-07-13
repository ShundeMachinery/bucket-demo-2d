# Bucket Demo 2D

Vue 3 + Vite + Pinia + Tailwind + Konva 的 Directus 产品适配组选配展示。前端不再读取本地 SQLite 或 JSON，业务数据直接来自 Directus REST API。

## Run

```bash
bun install
bun run dev
```

默认 Directus 地址：

```text
http://124.223.157.37:8055
```

可通过环境变量覆盖：

```bash
VITE_DIRECTUS_URL=http://your-directus:8055
VITE_DIRECTUS_TOKEN=optional-token
```

## Test And Build

```bash
bun test
bun run build
```

GitHub Pages 仓库页需要带仓库名前缀，手动验证线上路径时可运行：

```bash
bun run build:gh-pages
bun run preview
```

## Docker Deployment

生产镜像使用 Bun 构建前端，并由 Caddy 提供静态文件、SPA fallback 和 Directus 同源反向代理。浏览器只请求当前站点的 `/directus`，无需修改 Directus 的 CORS 或 HTTPS 配置。

构建并启动：

```bash
docker compose up -d --build
```

默认访问地址：

```text
http://localhost:8080
```

可通过环境变量覆盖宿主机端口、镜像名和 Directus 上游地址：

```bash
APP_PORT=8080 \
APP_IMAGE=ghcr.io/shundemachinery/bucket-demo-2d:latest \
DIRECTUS_UPSTREAM=http://124.223.157.37:8055 \
docker compose up -d --build
```

常用运维命令：

```bash
docker compose ps
docker compose logs -f web
docker compose restart web
docker compose down
```

推送到 `main`、推送 `v*` 版本标签或手动运行 `Build and Push Container Image` GitHub Actions 后，镜像会发布到：

```text
ghcr.io/shundemachinery/bucket-demo-2d
```

`main` 分支生成 `latest` 和 `sha-<完整提交哈希>` 标签，`v*` Git 标签额外生成同名版本镜像标签。服务器拉取并更新：

```bash
docker compose pull web
docker compose up -d --no-build
```

GHCR 包如果保持私有，需要先使用具备 `read:packages` 权限的 GitHub Token 执行 `docker login ghcr.io`；公开包无需登录即可拉取。

服务器如需对外提供 HTTPS，可继续在容器外层使用现有 Nginx、Caddy 或云负载均衡，将域名转发到 `127.0.0.1:8080`。

## Structure

```text
src/
  catalog/
    directusCatalog.ts
    fitmentBuilder.ts
  views/
    ConfiguratorView.vue
    DataManagerView.vue
  components/
    ProductSelectorPanel.vue
    FitmentCanvas.vue
    ProductCard.vue
    FitmentGroupCard.vue
    DataManager.vue
  services/
    directus.ts
  stores/
    configurator.ts
tests/
  directus.test.ts
```

## Directus Data Flow

前端读取这些集合：

- `products`: 产品主体，包含 SKU、原始名称、OEM、重量、分类和主图。
- `categories`: 产品分类。
- `product_fitment_groups`: 产品适配组。
- `product_fitment_group_items`: 适配组成员及产品角色。
- `product_fitment_roles`: 角色字典。
- `directus_files`: 图片资源，通过 `/assets/:id` 读取。

选配逻辑：

1. 左侧先分页读取 `products`，可按搜索词和分类筛选。
2. 选择第一件产品后，读取它所属的 `product_fitment_groups`。
3. 继续选择时，从共同适配组中推导下一步候选产品。
4. Konva 画布按已选产品顺序加载产品图，可拖动产品来组合位置；图片来自 `products.primary_image_id`，缺图或加载失败时使用默认 SVG。
5. 当前筛选和已选产品仅保存在 `localStorage`，刷新后恢复操作状态；业务数据始终来自 Directus。

## Frontend Scope

前端只做：

- 从 Directus API 读取产品、分类、适配组和图片。
- 按共同适配组进行“选配”式产品选择。
- 展示已选产品、共同适配组和下一步候选产品。
- 用 Konva 画布展示当前选配产品，支持拖动、缩放、旋转和重排；图片加载 Directus `primary_image_id` 并提供默认 SVG fallback。
- 展示 Directus 数据源连接和集合统计。

前端不再做：

- 导入 SQLite / JSON。
- 维护本地兼容关系表。
- 读取或缓存本地业务数据包。
- 使用旧的主机 / 挖斗 / 斗齿三段 2D 画布布局。

## Verify

测试覆盖 Directus 查询参数序列化、Directus 数据映射和适配候选算法：

```bash
bun test
```

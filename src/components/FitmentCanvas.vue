<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import type Konva from 'konva'
import placeholderImageUrl from '../assets/product-placeholder.svg?url'
import {
  persistCanvasLayoutState,
  persistCanvasViewport,
  readCanvasLayoutState,
  restoreCanvasLayout,
  type CanvasNodeLayout,
  type CanvasViewportLayout,
  type PersistedCanvasLayoutState,
} from '../services/canvasLayoutStorage'
import type { ProductSummary } from '../types/product'

type ProductNodeLayout = CanvasNodeLayout

type LoadedProductImage = {
  image: HTMLImageElement
  source: string
}

type ProductImageSize = {
  width: number
  height: number
}

type StageRect = {
  x: number
  y: number
  width: number
  height: number
}

type KonvaNodeRef<T> = {
  getNode: () => T
}

const props = defineProps<{
  products: ProductSummary[]
  selectionCode?: string
  fitmentGroupCount?: number
  fitmentSummary?: string
}>()

const emit = defineEmits<{
  (event: 'remove-products', productIds: string[]): void
}>()

const canvasRootRef = ref<HTMLElement | null>(null)
const stageShellRef = ref<HTMLElement | null>(null)
const stageRef = ref<KonvaNodeRef<Konva.Stage> | null>(null)
const transformerRef = ref<KonvaNodeRef<Konva.Transformer> | null>(null)
const stageWidth = ref(980)
const stageHeight = ref(560)
const hoveredProductId = ref('')
const selectedProductIds = ref<string[]>([])
const isSpacePressed = ref(false)
const isStageDragging = ref(false)
const isFullscreen = ref(false)
const isInfoPanelVisible = ref(true)
const loadedImages = reactive<Record<string, LoadedProductImage>>({})
const productLayouts = reactive<Record<string, ProductNodeLayout>>({})
const imageRefs = reactive<Partial<Record<string, KonvaNodeRef<Konva.Image>>>>({})
const dragStartLayouts = ref<Record<string, { x: number, y: number }>>({})
const panStart = ref({ x: 0, y: 0, panX: 0, panY: 0 })
const selectionStart = ref({ x: 0, y: 0 })
const isSelectionAdditive = ref(false)
const selectionRect = reactive({
  visible: false,
  x: 0,
  y: 0,
  width: 0,
  height: 0,
})
let persistedState: PersistedCanvasLayoutState = readCanvasLayoutState()

const viewportLayout = reactive<CanvasViewportLayout>({ ...persistedState.viewport })
const imageSources = computed(() => props.products.map((product) => product.imageUrl || placeholderImageUrl))
const selectedProductIdSet = computed(() => new Set(selectedProductIds.value))
const productIdSet = computed(() => new Set(props.products.map((product) => product.id)))
const transformerProductIds = computed(() => {
  if (selectedProductIds.value.length > 0) {
    return selectedProductIds.value
  }

  return hoveredProductId.value && productIdSet.value.has(hoveredProductId.value)
    ? [hoveredProductId.value]
    : []
})
const isHoverTransformer = computed(() => selectedProductIds.value.length === 0 && transformerProductIds.value.length > 0)
const selectedCanvasProducts = computed(() => (
  selectedProductIds.value
    .map((productId) => props.products.find((product) => product.id === productId))
    .filter((product): product is ProductSummary => Boolean(product))
))
const infoPanelProducts = computed(() => (
  selectedCanvasProducts.value.length > 0 ? selectedCanvasProducts.value : props.products
))
const selectedScalePercent = computed(() => {
  const ids = selectedProductIds.value.filter((productId) => productLayouts[productId])
  if (ids.length === 0) return 100

  const averageScale = ids.reduce((sum, productId) => {
    const layout = productLayouts[productId]
    return sum + ((Math.abs(layout.scaleX) + Math.abs(layout.scaleY)) / 2)
  }, 0) / ids.length

  return Math.round(averageScale * 100)
})
const selectedControlLabel = computed(() => {
  if (selectedCanvasProducts.value.length === 1) {
    return selectedCanvasProducts.value[0].sku || selectedCanvasProducts.value[0].name
  }

  return `已选 ${selectedCanvasProducts.value.length} 件`
})
const stageConfig = computed(() => ({
  width: stageWidth.value,
  height: stageHeight.value,
}))
const stageGroupConfig = computed(() => ({
  x: stageWidth.value / 2 + viewportLayout.panX,
  y: stageHeight.value / 2 + viewportLayout.panY,
  scaleX: viewportLayout.scale,
  scaleY: viewportLayout.scale,
  offsetX: stageWidth.value / 2,
  offsetY: stageHeight.value / 2,
}))
const transformerConfig = computed(() => ({
  rotateEnabled: true,
  resizeEnabled: !isHoverTransformer.value,
  keepRatio: false,
  enabledAnchors: isHoverTransformer.value
    ? []
    : [
        'top-left',
        'top-center',
        'top-right',
        'middle-left',
        'middle-right',
        'bottom-left',
        'bottom-center',
        'bottom-right',
      ],
  anchorSize: 10,
  anchorCornerRadius: 8,
  anchorFill: '#fffdf7',
  anchorStroke: '#c88905',
  anchorStrokeWidth: 1.4,
  borderStroke: isHoverTransformer.value ? 'rgba(217,154,7,0.42)' : 'rgba(217,154,7,0.9)',
  borderStrokeWidth: isHoverTransformer.value ? 1 : 1.35,
  rotateAnchorOffset: 38,
  rotateAnchorCursor: 'grab',
  padding: isHoverTransformer.value ? 6 : 10,
  shouldOverdrawWholeArea: false,
}))

let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  resizeObserver = new ResizeObserver((entries) => {
    const entry = entries[0]
    const width = Math.floor(entry.contentRect.width)
    const height = Math.floor(entry.contentRect.height)
    if (width <= 0) return

    stageWidth.value = Math.max(360, width)
    stageHeight.value = Math.max(320, Math.min(720, height > 0 ? height : Math.round(width * 0.54)))
    ensureLayouts()
    updateTransformer()
  })

  if (stageShellRef.value) {
    resizeObserver.observe(stageShellRef.value)
  }

  window.addEventListener('keydown', handleKeyDown)
  window.addEventListener('keyup', handleKeyUp)
  document.addEventListener('fullscreenchange', syncFullscreenState)

  void nextTick(() => {
    ensureLayouts()
    updateTransformer()
    void loadImages()
  })
})

onUnmounted(() => {
  resizeObserver?.disconnect()
  window.removeEventListener('keydown', handleKeyDown)
  window.removeEventListener('keyup', handleKeyUp)
  document.removeEventListener('fullscreenchange', syncFullscreenState)
})

watch(
  () => [props.products, imageSources.value],
  () => {
    ensureLayouts()
    updateTransformer()
    void loadImages()
  },
  { deep: true },
)

watch(
  () => `${selectedProductIds.value.join('|')}::${hoveredProductId.value}::${props.products.map((product) => product.id).join('|')}`,
  () => updateTransformer(),
)

watch(isSpacePressed, () => syncStageCursor())

function ensureLayouts(): void {
  const currentIds = productIdSet.value

  for (const id of Object.keys(productLayouts)) {
    if (!currentIds.has(id)) {
      delete productLayouts[id]
      delete imageRefs[id]
    }
  }

  selectedProductIds.value = selectedProductIds.value.filter((id) => currentIds.has(id))
  if (hoveredProductId.value && !currentIds.has(hoveredProductId.value)) {
    hoveredProductId.value = ''
  }

  props.products.forEach((product, index) => {
    if (productLayouts[product.id]) return

    productLayouts[product.id] = restoreCanvasLayout(
      persistedState.nodes,
      product.id,
      stageSize(),
    ) ?? defaultLayout(index, props.products.length)
  })
}

function defaultLayout(index: number, count: number): ProductNodeLayout {
  const bounds = imageBounds.value
  const columns = Math.max(1, Math.min(count, Math.floor(stageWidth.value / (bounds.width + 44)), 4))
  const rows = Math.max(1, Math.ceil(count / columns))
  const columnGap = Math.max(bounds.width + 36, Math.min(240, stageWidth.value / columns))
  const rowGap = Math.max(bounds.height * 0.6 + 28, 118)
  const row = Math.floor(index / columns)
  const column = index % columns
  const totalWidth = columnGap * (columns - 1)
  const totalHeight = rowGap * (rows - 1)
  const startX = stageWidth.value / 2 - totalWidth / 2
  const startY = Math.max(bounds.height / 2 + 40, stageHeight.value * 0.38 - totalHeight / 2)

  return {
    x: Math.round(startX + column * columnGap),
    y: Math.round(startY + row * rowGap + (column % 2) * 18),
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
  }
}

function stageSize() {
  return {
    width: stageWidth.value,
    height: stageHeight.value,
  }
}

function persistCurrentLayouts(): void {
  persistedState = persistCanvasLayoutState(
    productLayouts,
    props.products.map((product) => product.id),
    stageSize(),
    viewportLayout,
  )
}

function persistViewport(): void {
  persistedState = persistCanvasViewport(viewportLayout)
}

async function loadImages(): Promise<void> {
  await Promise.all(
    props.products.map(async (product) => {
      const source = product.imageUrl || placeholderImageUrl
      const loaded = loadedImages[product.id]
      if (loaded?.source === source) return

      loadedImages[product.id] = {
        source,
        image: await loadProductImage(source),
      }
    }),
  )
}

function loadProductImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => {
      const fallback = new Image()
      fallback.onload = () => resolve(fallback)
      fallback.src = placeholderImageUrl
    }
    image.src = source
  })
}

const imageBounds = computed<ProductImageSize>(() => {
  const count = Math.max(1, props.products.length)
  const width = Math.max(150, Math.min(260, (stageWidth.value - 112) / Math.min(count, 4) - 24))

  return {
    width: Math.round(width),
    height: Math.round(width * 0.74),
  }
})

function productImageConfig(product: ProductSummary, index: number) {
  const layout = productLayouts[product.id] ?? defaultLayout(index, props.products.length)
  const size = productImageSize(product)
  const isSelected = selectedProductIdSet.value.has(product.id)
  const isHovered = hoveredProductId.value === product.id

  return {
    id: product.id,
    name: 'product-image',
    x: layout.x,
    y: layout.y,
    width: size.width,
    height: size.height,
    offsetX: size.width / 2,
    offsetY: size.height / 2,
    scaleX: layout.scaleX,
    scaleY: layout.scaleY,
    rotation: layout.rotation,
    image: loadedImages[product.id]?.image,
    draggable: !isSpacePressed.value,
    opacity: isSelected || isHovered ? 1 : 0.96,
    shadowColor: isSelected ? 'rgba(17,19,23,0.28)' : isHovered ? 'rgba(17,19,23,0.14)' : 'transparent',
    shadowBlur: isSelected ? 18 : isHovered ? 10 : 0,
    shadowOffsetY: isSelected ? 10 : isHovered ? 6 : 0,
  }
}

function productImageSize(product: ProductSummary): ProductImageSize {
  const bounds = imageBounds.value
  const image = loadedImages[product.id]?.image
  const naturalWidth = image?.naturalWidth || image?.width || bounds.width
  const naturalHeight = image?.naturalHeight || image?.height || bounds.height
  const ratio = Math.min(bounds.width / naturalWidth, bounds.height / naturalHeight)

  return {
    width: Math.max(24, Math.round(naturalWidth * ratio)),
    height: Math.max(24, Math.round(naturalHeight * ratio)),
  }
}

function setImageRef(productId: string, node: KonvaNodeRef<Konva.Image> | null): void {
  if (node) {
    imageRefs[productId] = node
  } else {
    delete imageRefs[productId]
  }
  updateTransformer()
}

function bindImageRef(productId: string) {
  return (node: unknown) => setImageRef(productId, node as KonvaNodeRef<Konva.Image> | null)
}

function handleProductPointerEnter(productId: string): void {
  hoveredProductId.value = productId
  syncStageCursor()
}

function handleProductPointerLeave(productId: string): void {
  if (hoveredProductId.value === productId) {
    hoveredProductId.value = ''
  }
  syncStageCursor()
}

function syncStageCursor(): void {
  const stage = stageRef.value?.getNode()
  const container = stage?.container()
  if (!container) return

  if (isSpacePressed.value) {
    container.style.cursor = isStageDragging.value ? 'grabbing' : 'grab'
    return
  }

  container.style.cursor = hoveredProductId.value ? 'move' : 'crosshair'
}

function updateTransformer(): void {
  nextTick(() => {
    const transformer = transformerRef.value?.getNode()
    if (!transformer) return

    const nodes = transformerProductIds.value
      .map((productId) => imageRefs[productId]?.getNode())
      .filter((node): node is Konva.Image => Boolean(node))

    transformer.nodes(nodes)
    transformer.getLayer()?.batchDraw()
  })
}

function backgroundRectConfig() {
  return {
    width: stageWidth.value,
    height: stageHeight.value,
    name: 'stage-background',
    fillLinearGradientStartPoint: { x: 0, y: 0 },
    fillLinearGradientEndPoint: { x: 0, y: stageHeight.value },
    fillLinearGradientColorStops: [0, '#ffffff', 0.62, '#f5f7f9', 1, '#edf1f4'],
  }
}

function viewportGridLines() {
  const lines: Array<{ points: number[], name: string, stroke: string, strokeWidth: number }> = []
  for (let x = 0; x <= stageWidth.value; x += 32) {
    const isMajor = x % 160 === 0
    lines.push({
      points: [x, 0, x, stageHeight.value],
      name: 'stage-background',
      stroke: isMajor ? 'rgba(51,59,70,0.12)' : 'rgba(51,59,70,0.055)',
      strokeWidth: isMajor ? 1.1 : 1,
    })
  }
  for (let y = 0; y <= stageHeight.value; y += 32) {
    const isMajor = y % 160 === 0
    lines.push({
      points: [0, y, stageWidth.value, y],
      name: 'stage-background',
      stroke: isMajor ? 'rgba(51,59,70,0.12)' : 'rgba(51,59,70,0.055)',
      strokeWidth: isMajor ? 1.1 : 1,
    })
  }
  return lines
}

function emptyCardConfig() {
  return {
    x: Math.max(24, stageWidth.value / 2 - 260),
    y: Math.max(120, stageHeight.value / 2 - 90),
    width: Math.min(520, stageWidth.value - 48),
    height: 180,
    fill: '#ffffff',
    stroke: 'rgba(51,59,70,0.16)',
    strokeWidth: 1,
    cornerRadius: 14,
  }
}

function emptyTitleConfig() {
  const card = emptyCardConfig()
  return {
    x: card.x,
    y: card.y + 58,
    width: card.width,
    align: 'center',
    text: '选择产品后进入 Konva 画布',
    fontSize: 22,
    fontFamily: 'system-ui, sans-serif',
    fontStyle: '800',
    fill: '#111317',
  }
}

function emptyBodyConfig() {
  const card = emptyCardConfig()
  return {
    x: card.x + 32,
    y: card.y + 98,
    width: card.width - 64,
    align: 'center',
    text: '产品图片来自 Directus primary_image；缺图时使用默认 SVG。拖动产品图片来组合位置。',
    fontSize: 13,
    lineHeight: 1.5,
    fontFamily: 'system-ui, sans-serif',
    fontStyle: '700',
    fill: 'rgba(51,59,70,0.65)',
  }
}

function selectionRectConfig() {
  return {
    visible: selectionRect.visible,
    x: selectionRect.x,
    y: selectionRect.y,
    width: selectionRect.width,
    height: selectionRect.height,
    fill: 'rgba(217,154,7,0.12)',
    stroke: 'rgba(217,154,7,0.86)',
    strokeWidth: 1.25,
    dash: [6, 4],
    listening: false,
  }
}

function isBlankTarget(target: Konva.Node): boolean {
  return target === target.getStage() || target.name() === 'stage-background'
}

function selectProducts(productIds: string[]): void {
  selectedProductIds.value = [...new Set(productIds.filter((productId) => productIdSet.value.has(productId)))]
}

function toggleProductSelection(productId: string): void {
  if (selectedProductIdSet.value.has(productId)) {
    const nextIds = selectedProductIds.value.filter((id) => id !== productId)
    selectProducts(nextIds)
    return
  }

  selectProducts([...selectedProductIds.value, productId])
}

function startBoxSelection(pointer: { x: number, y: number }, additive: boolean): void {
  isSelectionAdditive.value = additive
  selectionStart.value = { x: pointer.x, y: pointer.y }
  selectionRect.visible = true
  selectionRect.x = pointer.x
  selectionRect.y = pointer.y
  selectionRect.width = 0
  selectionRect.height = 0

  if (!additive) {
    selectProducts([])
  }
}

function updateBoxSelection(pointer: { x: number, y: number }): void {
  selectionRect.x = Math.min(selectionStart.value.x, pointer.x)
  selectionRect.y = Math.min(selectionStart.value.y, pointer.y)
  selectionRect.width = Math.abs(pointer.x - selectionStart.value.x)
  selectionRect.height = Math.abs(pointer.y - selectionStart.value.y)
}

function finishBoxSelection(): void {
  const rect = normalizedSelectionRect()
  const selectedIds = rect.width < 6 || rect.height < 6
    ? []
    : props.products
        .filter((product) => {
          const node = imageRefs[product.id]?.getNode()
          return node ? rectsIntersect(rect, node.getClientRect()) : false
        })
        .map((product) => product.id)

  if (selectedIds.length > 0) {
    selectProducts(isSelectionAdditive.value ? [...selectedProductIds.value, ...selectedIds] : selectedIds)
  }

  selectionRect.visible = false
  selectionRect.width = 0
  selectionRect.height = 0
  isSelectionAdditive.value = false
  updateTransformer()
}

function normalizedSelectionRect(): StageRect {
  return {
    x: selectionRect.x,
    y: selectionRect.y,
    width: selectionRect.width,
    height: selectionRect.height,
  }
}

function rectsIntersect(left: StageRect, right: StageRect): boolean {
  return (
    left.x < right.x + right.width
    && left.x + left.width > right.x
    && left.y < right.y + right.height
    && left.y + left.height > right.y
  )
}

function handleStagePointerDown(event: Konva.KonvaEventObject<MouseEvent | TouchEvent>): void {
  const stage = event.target.getStage()
  const pointer = stage?.getPointerPosition()
  if (!pointer) return

  if (isSpacePressed.value) {
    selectionRect.visible = false
    isStageDragging.value = true
    syncStageCursor()
    panStart.value = {
      x: pointer.x,
      y: pointer.y,
      panX: viewportLayout.panX,
      panY: viewportLayout.panY,
    }
    return
  }

  if (isBlankTarget(event.target)) {
    const additive = 'shiftKey' in event.evt && event.evt.shiftKey
    hoveredProductId.value = ''
    startBoxSelection(pointer, additive)
  }
}

function handleStagePointerMove(event: Konva.KonvaEventObject<MouseEvent | TouchEvent>): void {
  const pointer = event.target.getStage()?.getPointerPosition()
  if (!pointer) return

  if (selectionRect.visible) {
    updateBoxSelection(pointer)
    return
  }

  if (!isStageDragging.value) return

  viewportLayout.panX = Math.round(panStart.value.panX + pointer.x - panStart.value.x)
  viewportLayout.panY = Math.round(panStart.value.panY + pointer.y - panStart.value.y)
}

function endStageDrag(): void {
  if (selectionRect.visible) {
    finishBoxSelection()
  }

  if (isStageDragging.value) {
    persistViewport()
  }
  isStageDragging.value = false
  syncStageCursor()
}

function handleProductPointerDown(event: Konva.KonvaEventObject<MouseEvent | TouchEvent>, productId: string): void {
  if (isSpacePressed.value) return

  if ('shiftKey' in event.evt && event.evt.shiftKey) {
    toggleProductSelection(productId)
    return
  }

  if (!selectedProductIdSet.value.has(productId)) {
    selectProducts([productId])
  }
}

function handleProductDragStart(productId: string): void {
  if (!selectedProductIdSet.value.has(productId)) {
    selectProducts([productId])
  }

  dragStartLayouts.value = Object.fromEntries(
    selectedProductIds.value.map((id) => {
      const node = imageRefs[id]?.getNode()
      const layout = productLayouts[id]
      return [id, { x: node?.x() ?? layout?.x ?? 0, y: node?.y() ?? layout?.y ?? 0 }]
    }),
  )
}

function handleProductDragMove(event: Konva.KonvaEventObject<DragEvent>, productId: string): void {
  if (selectedProductIds.value.length <= 1 || !selectedProductIdSet.value.has(productId)) return

  const draggedStart = dragStartLayouts.value[productId]
  if (!draggedStart) return

  const deltaX = event.target.x() - draggedStart.x
  const deltaY = event.target.y() - draggedStart.y

  for (const selectedId of selectedProductIds.value) {
    if (selectedId === productId) continue

    const node = imageRefs[selectedId]?.getNode()
    const start = dragStartLayouts.value[selectedId]
    if (!node || !start) continue

    node.position({
      x: start.x + deltaX,
      y: start.y + deltaY,
    })
  }

  transformerRef.value?.getNode().forceUpdate()
}

function handleProductDragEnd(productId: string): void {
  const ids = selectedProductIdSet.value.has(productId) ? selectedProductIds.value : [productId]
  syncLayoutsFromNodes(ids)
  persistCurrentLayouts()
  updateTransformer()
}

function handleTransformEnd(): void {
  const ids = transformerProductIds.value
  syncLayoutsFromNodes(ids)
  persistCurrentLayouts()
  updateTransformer()
}

function syncLayoutsFromNodes(productIds: string[]): void {
  for (const productId of productIds) {
    const node = imageRefs[productId]?.getNode()
    if (!node || !productLayouts[productId]) continue

    productLayouts[productId] = {
      ...productLayouts[productId],
      x: Math.round(node.x()),
      y: Math.round(node.y()),
      scaleX: Number(node.scaleX().toFixed(2)),
      scaleY: Number(node.scaleY().toFixed(2)),
      rotation: Math.round(node.rotation()),
    }
  }
}

function handleWheel(event: WheelEvent): void {
  event.preventDefault()
  const delta = event.deltaY > 0 ? -0.06 : 0.06
  viewportLayout.scale = clamp(Number((viewportLayout.scale + delta).toFixed(2)), 0.35, 2.5)
  persistViewport()
}

function handleKeyDown(event: KeyboardEvent): void {
  if (isRemoveSelectedProductsKey(event)) {
    removeSelectedProductsFromCanvas(event)
    return
  }

  if (event.code !== 'Space' || event.repeat) return
  const target = event.target as HTMLElement | null
  if (isEditableKeyboardTarget(target)) return

  event.preventDefault()
  selectionRect.visible = false
  isSpacePressed.value = true
  syncStageCursor()
}

function handleKeyUp(event: KeyboardEvent): void {
  if (event.code !== 'Space') return

  event.preventDefault()
  isSpacePressed.value = false
  endStageDrag()
  syncStageCursor()
}

function resetView(): void {
  viewportLayout.panX = 0
  viewportLayout.panY = 0
  viewportLayout.scale = 1
  persistViewport()
}

function applySelectedScale(event: Event): void {
  const targetScale = Number((event.target as HTMLInputElement).value) / 100
  const ids = selectedProductIds.value.filter((productId) => productLayouts[productId])
  if (ids.length === 0 || !Number.isFinite(targetScale)) return

  for (const productId of ids) {
    const layout = productLayouts[productId]
    const currentAverageScale = Math.max(0.1, (Math.abs(layout.scaleX) + Math.abs(layout.scaleY)) / 2)
    const ratio = targetScale / currentAverageScale
    const nextScaleX = clamp(Number((layout.scaleX * ratio).toFixed(2)), 0.1, 4)
    const nextScaleY = clamp(Number((layout.scaleY * ratio).toFixed(2)), 0.1, 4)
    const node = imageRefs[productId]?.getNode()

    productLayouts[productId] = {
      ...layout,
      scaleX: nextScaleX,
      scaleY: nextScaleY,
    }

    node?.scale({
      x: nextScaleX,
      y: nextScaleY,
    })
  }

  transformerRef.value?.getNode().forceUpdate()
  persistCurrentLayouts()
}

function resetSelectedTransforms(): void {
  const ids = selectedProductIds.value.filter((productId) => productLayouts[productId])
  if (ids.length === 0) return

  for (const productId of ids) {
    const layout = productLayouts[productId]
    const node = imageRefs[productId]?.getNode()

    productLayouts[productId] = {
      ...layout,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
    }

    node?.scale({ x: 1, y: 1 })
    node?.rotation(0)
  }

  transformerRef.value?.getNode().forceUpdate()
  persistCurrentLayouts()
}

function removeSelectedProductsFromCanvas(event: KeyboardEvent): void {
  const target = event.target as HTMLElement | null
  if (isEditableKeyboardTarget(target)) return

  const productIds = selectedProductIds.value.filter((productId) => productIdSet.value.has(productId))
  if (productIds.length === 0) return

  event.preventDefault()
  event.stopPropagation()
  emit('remove-products', productIds)
  selectProducts([])
  hoveredProductId.value = ''
  updateTransformer()
}

function isRemoveSelectedProductsKey(event: KeyboardEvent): boolean {
  return event.code === 'Delete' || event.code === 'Backspace'
}

function isEditableKeyboardTarget(target: HTMLElement | null): boolean {
  if (!target) return false
  if (target.isContentEditable) return true

  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

function resetLayout(): void {
  props.products.forEach((product, index) => {
    productLayouts[product.id] = defaultLayout(index, props.products.length)
  })
  selectProducts(props.products[0]?.id ? [props.products[0].id] : [])
  persistCurrentLayouts()
  updateTransformer()
}

async function toggleFullscreen(): Promise<void> {
  if (!canvasRootRef.value) return

  if (document.fullscreenElement) {
    await document.exitFullscreen()
    return
  }

  await canvasRootRef.value.requestFullscreen()
}

function syncFullscreenState(): void {
  isFullscreen.value = document.fullscreenElement === canvasRootRef.value
  if (isFullscreen.value) {
    isInfoPanelVisible.value = true
  }

  requestAnimationFrame(() => {
    if (!stageShellRef.value) return

    stageWidth.value = Math.max(360, Math.floor(stageShellRef.value.clientWidth))
    stageHeight.value = Math.max(320, Math.floor(stageShellRef.value.clientHeight))
    updateTransformer()
  })
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
</script>

<template>
  <section
    ref="canvasRootRef"
    class="relative flex h-full min-h-[420px] flex-col overflow-hidden border border-iron-700/10 bg-white p-4"
    :class="isFullscreen ? 'h-screen min-h-screen border-0 bg-iron-50 p-0' : ''"
  >
    <div
      class="flex shrink-0 flex-col gap-3 md:flex-row md:items-end md:justify-between"
      :class="isFullscreen ? 'pointer-events-auto absolute left-4 right-4 top-4 z-30 border border-iron-700/10 bg-white/90 px-4 py-3 shadow-panel backdrop-blur' : ''"
    >
      <div>
        <p class="text-[11px] font-extrabold uppercase tracking-[0.18em] text-safety-600">Konva Stage</p>
        <h2 class="mt-1 text-xl font-extrabold">选配拖拽画布</h2>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <button type="button" class="tool-button" :disabled="products.length === 0" @click="resetLayout">重排</button>
        <button type="button" class="tool-button" @click="resetView">重置视图</button>
        <button
          type="button"
          class="tool-button"
          :disabled="products.length === 0"
          @click="isInfoPanelVisible = !isInfoPanelVisible"
        >
          {{ isInfoPanelVisible ? '隐藏信息' : '显示信息' }}
        </button>
        <button type="button" class="tool-button bg-iron-950 text-white hover:bg-iron-800" @click="toggleFullscreen">
          {{ isFullscreen ? '退出全屏' : '全屏预览' }}
        </button>
      </div>
    </div>

    <div
      ref="stageShellRef"
      class="relative mt-3 min-h-[320px] flex-1 touch-none select-none overflow-hidden border border-iron-700/10 bg-iron-50"
      :class="[
        isFullscreen ? 'mt-0 min-h-0 border-0' : '',
        isSpacePressed ? isStageDragging ? 'cursor-grabbing' : 'cursor-grab' : 'cursor-crosshair',
      ]"
      @wheel="handleWheel"
    >
      <v-stage
        ref="stageRef"
        :config="stageConfig"
        @mousedown="handleStagePointerDown"
        @mousemove="handleStagePointerMove"
        @mouseup="endStageDrag"
        @mouseleave="endStageDrag"
        @touchstart="handleStagePointerDown"
        @touchmove="handleStagePointerMove"
        @touchend="endStageDrag"
      >
        <v-layer>
          <v-rect :config="backgroundRectConfig()" />
          <v-line
            v-for="(line, index) in viewportGridLines()"
            :key="`viewport-grid-${index}`"
            :config="line"
          />
        </v-layer>

        <v-layer>
          <v-group :config="stageGroupConfig">
            <template v-if="products.length > 0">
              <v-image
                v-for="(product, index) in products"
                :key="product.id"
                :ref="bindImageRef(product.id)"
                :config="productImageConfig(product, index)"
                @mouseenter="handleProductPointerEnter(product.id)"
                @mouseleave="handleProductPointerLeave(product.id)"
                @mousedown="handleProductPointerDown($event, product.id)"
                @touchstart="handleProductPointerDown($event, product.id)"
                @dragstart="handleProductDragStart(product.id)"
                @dragmove="handleProductDragMove($event, product.id)"
                @dragend="handleProductDragEnd(product.id)"
                @transformend="handleTransformEnd"
              />

              <v-transformer
                ref="transformerRef"
                :config="transformerConfig"
                @transformend="handleTransformEnd"
              />
            </template>
          </v-group>

          <v-rect :config="selectionRectConfig()" />

          <template v-if="products.length === 0">
            <v-rect :config="emptyCardConfig()" />
            <v-text :config="emptyTitleConfig()" />
            <v-text :config="emptyBodyConfig()" />
          </template>
        </v-layer>
      </v-stage>

      <div
        v-if="selectedCanvasProducts.length > 0"
        class="pointer-events-auto absolute bottom-4 left-4 z-20 flex w-[min(520px,calc(100%-2rem))] flex-col gap-3 border border-iron-700/10 bg-white/90 p-3 shadow-panel backdrop-blur md:flex-row md:items-center"
      >
        <div class="min-w-0 flex-1">
          <div class="flex items-center justify-between gap-3">
            <p class="truncate text-xs font-extrabold text-iron-900">{{ selectedControlLabel }}</p>
            <span class="shrink-0 text-xs font-extrabold text-safety-600">{{ selectedScalePercent }}%</span>
          </div>
          <input
            class="mt-2 h-2 w-full accent-safety-500"
            type="range"
            min="25"
            max="260"
            step="1"
            :value="selectedScalePercent"
            aria-label="选中产品尺寸"
            @input="applySelectedScale"
          >
        </div>
        <button type="button" class="tool-button h-9 text-xs" @click="resetSelectedTransforms">复位形变</button>
      </div>

      <aside
        v-if="products.length > 0 && isFullscreen && isInfoPanelVisible"
        class="pointer-events-auto absolute right-4 top-24 z-20 w-[min(380px,calc(100%-2rem))] border border-iron-950/10 bg-iron-950/88 p-4 text-white shadow-panel backdrop-blur"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="text-[11px] font-extrabold uppercase tracking-[0.18em] text-safety-500">Product Information</p>
            <h3 class="mt-1 truncate text-lg font-extrabold">{{ selectionCode || '当前选配' }}</h3>
          </div>
          <button
            type="button"
            class="shrink-0 border border-white/12 px-2 py-1 text-xs font-extrabold text-white/70 transition hover:border-safety-500 hover:text-safety-500"
            @click="isInfoPanelVisible = false"
          >
            收起
          </button>
        </div>

        <div class="mt-4 grid grid-cols-2 gap-2 text-xs">
          <div class="border border-white/10 bg-white/8 p-2">
            <p class="font-bold text-white/45">已选产品</p>
            <p class="mt-1 text-xl font-extrabold">{{ products.length }}</p>
          </div>
          <div class="border border-white/10 bg-white/8 p-2">
            <p class="font-bold text-white/45">适配组</p>
            <p class="mt-1 text-xl font-extrabold">{{ fitmentGroupCount ?? 0 }}</p>
          </div>
        </div>

        <p v-if="fitmentSummary" class="mt-3 line-clamp-3 text-sm font-semibold leading-6 text-white/68">
          {{ fitmentSummary }}
        </p>

        <div class="mt-4 space-y-2">
          <article
            v-for="product in infoPanelProducts.slice(0, 5)"
            :key="product.id"
            class="border border-white/10 bg-white/10 p-2"
          >
            <p class="truncate text-xs font-bold text-safety-500">{{ product.sku || product.categoryLabel || 'PRODUCT' }}</p>
            <p class="mt-1 line-clamp-2 text-sm font-extrabold leading-5">{{ product.name }}</p>
          </article>
          <p v-if="infoPanelProducts.length > 5" class="text-xs font-semibold text-white/45">
            另有 {{ infoPanelProducts.length - 5 }} 件产品
          </p>
        </div>
      </aside>
    </div>
  </section>
</template>

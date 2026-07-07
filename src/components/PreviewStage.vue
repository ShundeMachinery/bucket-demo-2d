<script setup lang="ts">
import Konva from 'konva'
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useConfiguratorStore, type HighlightPart } from '../stores/configurator'
import { resolveAssetPath } from '../services/assetPath'
import type { ProductPart } from '../types/product'

const store = useConfiguratorStore()
const viewportRef = ref<HTMLElement | null>(null)
const stageRef = ref<{ getNode: () => Konva.Stage } | null>(null)
const transformerRef = ref<{ getNode: () => Konva.Transformer } | null>(null)
const imageRefs = reactive<Partial<Record<HighlightPart, { getNode: () => Konva.Image }>>>({})
const imageCache = reactive<Record<string, HTMLImageElement | undefined>>({})
const viewportSize = reactive({ width: 900, height: 620 })
const isExporting = ref(false)
const isFullscreen = ref(false)
const isProductCardOpen = ref(true)
const isStageDragging = ref(false)
const isSpacePressed = ref(false)
const selectedParts = ref<HighlightPart[]>([store.highlightedPart])
const groupDragStart = ref<Record<HighlightPart, { x: number; y: number }>>({
  excavator: { x: 0, y: 0 },
  bucket: { x: 0, y: 0 },
  tooth: { x: 0, y: 0 },
})
const selectionRect = reactive({
  visible: false,
  x: 0,
  y: 0,
  width: 0,
  height: 0,
})
const panStart = ref({
  x: 0,
  y: 0,
  panX: 0,
  panY: 0,
})
const selectionStart = ref({ x: 0, y: 0 })

type Layer = {
  type: HighlightPart
  label: string
  part: ProductPart
  zIndex: number
}

const layers = computed<Layer[]>(() => [
  { type: 'excavator', label: '主机', part: store.selectedExcavator, zIndex: 10 },
  { type: 'bucket', label: '挖斗', part: store.selectedBucket, zIndex: 20 },
  { type: 'tooth', label: '斗齿', part: store.selectedTooth, zIndex: 30 },
])

const selectedLayer = computed(() => {
  return layers.value.find((layer) => layer.type === store.highlightedPart) ?? layers.value[0]
})

const selectedPartSet = computed(() => new Set(selectedParts.value))

const selectedLabel = computed(() => {
  if (selectedParts.value.length > 1) {
    return `已选 ${selectedParts.value.length} 个部件`
  }

  return `${selectedLayer.value.label}：${selectedLayer.value.part.name}`
})

const featuredSellingPoints = computed(() => {
  const source = selectedParts.value.length === 1
    ? selectedLayer.value.part.sellingPoints
    : [
        ...store.selectedBucket.sellingPoints,
        ...store.selectedTooth.sellingPoints,
        ...store.selectedExcavator.sellingPoints,
      ]

  return source.slice(0, 3)
})

const selectedPartMeta = computed(() => {
  if (store.highlightedPart === 'excavator') {
    return {
      label: '吨位',
      value: store.selectedExcavator.tonnage,
    }
  }

  if (store.highlightedPart === 'bucket') {
    return {
      label: '斗容',
      value: store.selectedBucket.capacity,
    }
  }

  return {
    label: '材质',
    value: store.selectedTooth.material,
  }
})

const productCardHint = computed(() => {
  if (!isProductCardOpen.value) {
    return `${selectedLayer.value.label} / ${selectedLayer.value.part.name}`
  }

  return store.isCanvasLocked
    ? '展示锁定中，可拖动画布与缩放视图。'
    : '点击底部部件标签可切换当前信息。'
})

const stageConfig = computed(() => ({
  width: viewportSize.width,
  height: viewportSize.height,
}))

const stageGroupConfig = computed(() => ({
  x: viewportSize.width / 2 + store.panX,
  y: viewportSize.height / 2 + store.panY,
  scaleX: store.scale,
  scaleY: store.scale,
  offsetX: store.catalog.stage.width / 2,
  offsetY: store.catalog.stage.height / 2,
}))

const transformerConfig = {
  rotateEnabled: true,
  resizeEnabled: true,
  keepRatio: true,
  enabledAnchors: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
  anchorSize: 14,
  anchorCornerRadius: 1,
  anchorFill: '#f5b51b',
  anchorStroke: '#111317',
  borderStroke: '#f5b51b',
  borderStrokeWidth: 2,
  rotateAnchorOffset: 46,
  padding: 8,
}

function loadImage(src: string) {
  if (!src) return
  if (imageCache[src]) return

  const image = new Image()
  image.onload = () => {
    imageCache[src] = image
  }
  image.crossOrigin = 'anonymous'
  image.src = resolveAssetPath(src)
}

function setImageRef(part: HighlightPart, node: { getNode: () => Konva.Image } | null) {
  if (node) {
    imageRefs[part] = node
  } else {
    delete imageRefs[part]
  }
}

function bindImageRef(part: HighlightPart) {
  return (node: unknown) => {
    setImageRef(part, node as { getNode: () => Konva.Image } | null)
  }
}

function layerConfig(layer: Layer) {
  const adjustment = store.layerAdjustments[layer.type]
  const isSelected = !store.isCanvasLocked && selectedPartSet.value.has(layer.type)

  return {
    id: layer.type,
    name: layer.type,
    image: imageCache[layer.part.image],
    x: layer.part.anchor.x + adjustment.offsetX,
    y: layer.part.anchor.y + adjustment.offsetY,
    width: layer.part.dimensions.width,
    height: layer.part.dimensions.height,
    offsetX: layer.part.dimensions.width / 2,
    offsetY: layer.part.dimensions.height / 2,
    scaleX: adjustment.scale,
    scaleY: adjustment.scale,
    rotation: adjustment.rotateZ,
    draggable: !store.isCanvasLocked && !isSpacePressed.value,
    opacity: isSelected ? 1 : 0.92,
    shadowColor: isSelected ? 'rgba(17,19,23,0.34)' : 'transparent',
    shadowBlur: isSelected ? 18 : 0,
    shadowOffsetY: isSelected ? 12 : 0,
  }
}

function updateTransformer() {
  nextTick(() => {
    const transformer = transformerRef.value?.getNode()
    const nodes = store.isCanvasLocked
      ? []
      : selectedParts.value
        .map((part) => imageRefs[part]?.getNode())
        .filter((node): node is Konva.Image => Boolean(node))

    if (!transformer) return

    transformer.nodes(nodes)
    transformer.getLayer()?.batchDraw()
  })
}

function isBlankTarget(target: Konva.Node) {
  return target === target.getStage() || target.name() === 'stage-background'
}

function handleStagePointerDown(event: Konva.KonvaEventObject<PointerEvent>) {
  const target = event.target
  const stage = target.getStage()
  const pointer = stage?.getPointerPosition()
  if (!pointer) return

  if (store.isCanvasLocked || isSpacePressed.value) {
    isStageDragging.value = true
    panStart.value = {
      x: pointer.x,
      y: pointer.y,
      panX: store.panX,
      panY: store.panY,
    }
    return
  }

  if (!isBlankTarget(target)) return

  if (!isSpacePressed.value) {
    selectionStart.value = { x: pointer.x, y: pointer.y }
    selectionRect.visible = true
    selectionRect.x = pointer.x
    selectionRect.y = pointer.y
    selectionRect.width = 0
    selectionRect.height = 0
    return
  }

}

function handleStagePointerMove(event: Konva.KonvaEventObject<PointerEvent>) {
  const pointer = event.target.getStage()?.getPointerPosition()
  if (!pointer) return

  if (selectionRect.visible) {
    selectionRect.x = Math.min(selectionStart.value.x, pointer.x)
    selectionRect.y = Math.min(selectionStart.value.y, pointer.y)
    selectionRect.width = Math.abs(pointer.x - selectionStart.value.x)
    selectionRect.height = Math.abs(pointer.y - selectionStart.value.y)
    return
  }

  if (!isStageDragging.value) return

  store.setPan(
    panStart.value.panX + pointer.x - panStart.value.x,
    panStart.value.panY + pointer.y - panStart.value.y,
  )
}

function endStageDrag() {
  if (selectionRect.visible) {
    selectLayerFromRect()
    selectionRect.visible = false
  }

  isStageDragging.value = false
}

function selectLayerFromRect() {
  if (selectionRect.width < 6 || selectionRect.height < 6) return

  const rect = {
    x: selectionRect.x,
    y: selectionRect.y,
    width: selectionRect.width,
    height: selectionRect.height,
  }
  const selected = layers.value.filter((layer) => {
    const node = imageRefs[layer.type]?.getNode()
    return node ? Konva.Util.haveIntersection(rect, node.getClientRect()) : false
  })

  if (selected.length) {
    selectParts(selected.map((layer) => layer.type))
  }
}

function selectParts(parts: HighlightPart[]) {
  selectedParts.value = Array.from(new Set(parts))
  store.setHighlightedPart(selectedParts.value.at(-1) ?? 'tooth')
  updateTransformer()
}

function togglePartSelection(part: HighlightPart) {
  if (selectedPartSet.value.has(part)) {
    const nextParts = selectedParts.value.filter((item) => item !== part)
    selectParts(nextParts.length ? nextParts : [part])
    return
  }

  selectParts([...selectedParts.value, part])
}

function selectLayer(part: HighlightPart, append = false) {
  if (append) {
    togglePartSelection(part)
    return
  }

  selectParts([part])
}

function handleLayerPointerDown(event: Konva.KonvaEventObject<PointerEvent>, layer: Layer) {
  if (store.isCanvasLocked) {
    handleStagePointerDown(event)
    return
  }

  if (isSpacePressed.value) return

  if (event.evt.shiftKey) {
    togglePartSelection(layer.type)
    return
  }

  if (!selectedPartSet.value.has(layer.type)) {
    selectLayer(layer.type)
  }
}

function handleLayerDragStart(layer: Layer) {
  if (store.isCanvasLocked) return

  if (!selectedPartSet.value.has(layer.type)) {
    selectLayer(layer.type)
  }

  groupDragStart.value = Object.fromEntries(
    layers.value.map((item) => {
      const node = imageRefs[item.type]?.getNode()
      return [item.type, { x: node?.x() ?? item.part.anchor.x, y: node?.y() ?? item.part.anchor.y }]
    }),
  ) as Record<HighlightPart, { x: number; y: number }>
}

function handleLayerDragMove(event: Konva.KonvaEventObject<DragEvent>, layer: Layer) {
  if (store.isCanvasLocked) return

  if (selectedParts.value.length <= 1 || !selectedPartSet.value.has(layer.type)) return

  const draggedStart = groupDragStart.value[layer.type]
  const deltaX = event.target.x() - draggedStart.x
  const deltaY = event.target.y() - draggedStart.y

  for (const part of selectedParts.value) {
    if (part === layer.type) continue

    const node = imageRefs[part]?.getNode()
    const start = groupDragStart.value[part]
    if (!node || !start) continue

    node.position({
      x: start.x + deltaX,
      y: start.y + deltaY,
    })
  }
}

function handleLayerDragEnd(event: Konva.KonvaEventObject<DragEvent>, layer: Layer) {
  if (store.isCanvasLocked) return

  if (selectedParts.value.length > 1 && selectedPartSet.value.has(layer.type)) {
    for (const part of selectedParts.value) {
      const selectedNode = imageRefs[part]?.getNode()
      const selectedLayerData = layers.value.find((item) => item.type === part)
      if (!selectedNode || !selectedLayerData) continue

      store.updateLayerAdjustment(part, {
        offsetX: Math.round(selectedNode.x() - selectedLayerData.part.anchor.x),
        offsetY: Math.round(selectedNode.y() - selectedLayerData.part.anchor.y),
      })
    }
    return
  }

  const node = event.target
  store.updateLayerAdjustment(layer.type, {
    offsetX: Math.round(node.x() - layer.part.anchor.x),
    offsetY: Math.round(node.y() - layer.part.anchor.y),
  })
}

function handleTransformEnd(event: Konva.KonvaEventObject<Event>, layer: Layer) {
  if (store.isCanvasLocked) return

  const node = event.target
  const nextScale = Math.max(0.25, (node.scaleX() + node.scaleY()) / 2)

  store.updateLayerAdjustment(layer.type, {
    offsetX: Math.round(node.x() - layer.part.anchor.x),
    offsetY: Math.round(node.y() - layer.part.anchor.y),
    scale: Number(nextScale.toFixed(2)),
    rotateZ: Math.round(node.rotation()),
  })
}

function handleWheel(event: WheelEvent) {
  event.preventDefault()
  const delta = event.deltaY > 0 ? -0.06 : 0.06
  store.setScale(store.scale + delta)
}

function handleKeyDown(event: KeyboardEvent) {
  if (event.code !== 'Space' || event.repeat) return
  const target = event.target as HTMLElement | null
  if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return

  event.preventDefault()
  isSpacePressed.value = true
  selectionRect.visible = false
}

function handleKeyUp(event: KeyboardEvent) {
  if (event.code !== 'Space') return

  event.preventDefault()
  isSpacePressed.value = false
  isStageDragging.value = false
}

function syncViewportSize() {
  if (!viewportRef.value) return

  viewportSize.width = Math.max(320, viewportRef.value.clientWidth)
  viewportSize.height = Math.max(320, viewportRef.value.clientHeight)
}

async function toggleFullscreen() {
  if (!viewportRef.value) return

  if (document.fullscreenElement) {
    await document.exitFullscreen()
    return
  }

  await viewportRef.value.requestFullscreen()
}

function syncFullscreenState() {
  isFullscreen.value = document.fullscreenElement === viewportRef.value
  requestAnimationFrame(syncViewportSize)
}

async function exportStage() {
  const stage = stageRef.value?.getNode()
  if (!stage || isExporting.value) return

  isExporting.value = true
  try {
    const dataUrl = stage.toDataURL({
      pixelRatio: 2,
      mimeType: 'image/png',
    })
    const link = document.createElement('a')
    link.download = `${store.combinationCode.replaceAll(' / ', '-')}.png`
    link.href = dataUrl
    link.click()
  } finally {
    isExporting.value = false
  }
}

watch(
  () => layers.value.map((layer) => layer.part.image),
  (images) => {
    images.forEach(loadImage)
  },
  { immediate: true },
)

watch(
  () => store.highlightedPart,
  (part) => {
    if (!selectedPartSet.value.has(part)) {
      selectedParts.value = [part]
    }
    updateTransformer()
  },
)
watch(() => store.combinationKey, () => {
  selectedParts.value = [store.highlightedPart]
  updateTransformer()
})

watch(() => store.isCanvasLocked, () => {
  selectionRect.visible = false
  isStageDragging.value = false
  updateTransformer()
})

onMounted(() => {
  syncViewportSize()
  updateTransformer()
  window.addEventListener('resize', syncViewportSize)
  window.addEventListener('keydown', handleKeyDown)
  window.addEventListener('keyup', handleKeyUp)
  window.addEventListener('export-preview', exportStage)
  document.addEventListener('fullscreenchange', syncFullscreenState)
})

onUnmounted(() => {
  window.removeEventListener('resize', syncViewportSize)
  window.removeEventListener('keydown', handleKeyDown)
  window.removeEventListener('keyup', handleKeyUp)
  window.removeEventListener('export-preview', exportStage)
  document.removeEventListener('fullscreenchange', syncFullscreenState)
})
</script>

<template>
  <div
    ref="viewportRef"
    class="relative flex flex-1 touch-none select-none overflow-hidden bg-[#f3f4f6]"
    :class="store.isCanvasLocked || isSpacePressed ? isStageDragging ? 'cursor-grabbing' : 'cursor-grab' : 'cursor-crosshair'"
    @wheel="handleWheel"
  >
    <div class="absolute inset-0 bg-[linear-gradient(180deg,#ffffff_0%,#edf0f2_58%,#d9dee3_100%)]" />
    <div class="absolute inset-x-0 bottom-0 h-48 bg-[linear-gradient(180deg,transparent_0%,rgba(17,19,23,0.16)_100%)]" />
    <div class="absolute bottom-[18%] left-[8%] right-[8%] h-px bg-iron-700/20" />

    <v-stage
      ref="stageRef"
      class="relative z-10"
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
        <v-rect
          :config="{
            x: 0,
            y: 0,
            width: viewportSize.width,
            height: viewportSize.height,
            name: 'stage-background',
            fillLinearGradientStartPoint: { x: 0, y: 0 },
            fillLinearGradientEndPoint: { x: 0, y: viewportSize.height },
            fillLinearGradientColorStops: [0, '#ffffff', 0.58, '#edf0f2', 1, '#d9dee3'],
          }"
        />
        <v-rect
          :config="{
            x: 0,
            y: viewportSize.height - 192,
            width: viewportSize.width,
            height: 192,
            name: 'stage-background',
            fillLinearGradientStartPoint: { x: 0, y: viewportSize.height - 192 },
            fillLinearGradientEndPoint: { x: 0, y: viewportSize.height },
            fillLinearGradientColorStops: [0, 'rgba(17,19,23,0)', 1, 'rgba(17,19,23,0.16)'],
          }"
        />
        <v-line
          :config="{
            points: [viewportSize.width * 0.08, viewportSize.height * 0.82, viewportSize.width * 0.92, viewportSize.height * 0.82],
            name: 'stage-background',
            stroke: 'rgba(17,19,23,0.2)',
            strokeWidth: 1,
          }"
        />
      </v-layer>

      <v-layer>
        <v-group :config="stageGroupConfig">
          <v-line
            :config="{
              points: [112, store.catalog.stage.height - 112, store.catalog.stage.width - 112, store.catalog.stage.height - 112],
              stroke: 'rgba(17,19,23,0.22)',
              strokeWidth: 1,
            }"
          />

          <v-image
            v-for="layer in layers"
            :key="layer.type"
            :ref="bindImageRef(layer.type)"
            :config="layerConfig(layer)"
            @mousedown="handleLayerPointerDown($event, layer)"
            @touchstart="handleLayerPointerDown($event, layer)"
            @dragstart="handleLayerDragStart(layer)"
            @dragmove="handleLayerDragMove($event, layer)"
            @dragend="handleLayerDragEnd($event, layer)"
            @transformend="handleTransformEnd($event, layer)"
          />

          <v-transformer ref="transformerRef" :config="transformerConfig" />
        </v-group>
        <v-rect
          :config="{
            visible: selectionRect.visible,
            x: selectionRect.x,
            y: selectionRect.y,
            width: selectionRect.width,
            height: selectionRect.height,
            fill: 'rgba(245,181,27,0.12)',
            stroke: '#f5b51b',
            strokeWidth: 1,
            dash: [6, 4],
            listening: false,
          }"
        />
      </v-layer>
    </v-stage>

    <div class="pointer-events-none absolute left-5 top-5 z-20 w-[min(420px,calc(100%-2.5rem))] border-l-4 border-safety-500 bg-white/86 px-4 py-3 shadow-lg backdrop-blur">
      <p class="text-[11px] font-extrabold uppercase tracking-[0.16em] text-iron-700/60">Konva Canvas</p>
      <h2 class="mt-1 text-xl font-extrabold text-iron-950">{{ store.combinationCode }}</h2>
      <p class="mt-1 text-sm font-semibold text-iron-700">{{ store.isCanvasLocked ? '画布已锁定：拖动画布和滚轮缩放仍可用' : selectedLabel }}</p>
    </div>

    <div class="absolute bottom-5 left-5 z-20 flex flex-wrap gap-2">
      <button
        v-for="layer in layers"
        :key="layer.type"
        type="button"
        class="h-11 min-w-20 border px-4 text-sm font-extrabold transition duration-200"
        :class="!store.isCanvasLocked && selectedPartSet.has(layer.type) ? 'border-safety-500 bg-safety-500 text-iron-950' : 'border-black/10 bg-white/86 text-iron-800 hover:border-safety-500 disabled:cursor-not-allowed disabled:opacity-55'"
        :disabled="store.isCanvasLocked"
        @click="selectLayer(layer.type)"
      >
        {{ layer.label }}
      </button>
    </div>

    <div class="absolute right-5 top-5 z-20 w-[min(360px,calc(100%-2.5rem))] overflow-hidden bg-iron-950/90 text-white shadow-xl backdrop-blur">
      <div class="flex items-start justify-between gap-3 border-b border-white/10">
        <button
          type="button"
          class="flex-1 p-4 text-left transition hover:bg-white/5"
          :aria-expanded="isProductCardOpen"
          @click="isProductCardOpen = !isProductCardOpen"
        >
          <p class="text-[11px] font-extrabold uppercase tracking-[0.16em] text-safety-500">Product Information</p>
          <p class="mt-1 text-lg font-extrabold leading-tight">{{ store.combinationCode }}</p>
          <p class="mt-2 text-xs font-semibold leading-5 text-white/58">{{ productCardHint }}</p>
        </button>
        <button
          type="button"
          class="m-3 shrink-0 border border-white/10 px-3 py-2 text-xs font-extrabold text-white/70 transition hover:border-safety-500 hover:bg-safety-500 hover:text-iron-950"
          :aria-expanded="isProductCardOpen"
          @click="isProductCardOpen = !isProductCardOpen"
        >
          {{ isProductCardOpen ? '收起' : '展开' }}
        </button>
      </div>

      <div v-if="isProductCardOpen" class="space-y-4 p-4">
        <div class="grid grid-cols-3 gap-2 text-xs">
          <div class="border border-white/10 bg-white/6 p-2">
            <p class="font-bold text-white/42">主机</p>
            <p class="mt-1 truncate font-extrabold text-white">{{ store.selectedExcavator.name }}</p>
            <p class="mt-1 font-semibold text-safety-500">{{ store.selectedExcavator.tonnage }}</p>
          </div>
          <div class="border border-white/10 bg-white/6 p-2">
            <p class="font-bold text-white/42">挖斗</p>
            <p class="mt-1 truncate font-extrabold text-white">{{ store.selectedBucket.name }}</p>
            <p class="mt-1 font-semibold text-safety-500">{{ store.selectedBucket.capacity }}</p>
          </div>
          <div class="border border-white/10 bg-white/6 p-2">
            <p class="font-bold text-white/42">斗齿</p>
            <p class="mt-1 truncate font-extrabold text-white">{{ store.selectedTooth.name }}</p>
            <p class="mt-1 font-semibold text-safety-500">{{ store.selectedTooth.material }}</p>
          </div>
        </div>

        <div class="border-l-4 border-safety-500 bg-white/8 p-3">
          <p class="text-xs font-extrabold text-white/50">当前关注</p>
          <p class="mt-1 text-base font-extrabold">{{ selectedLayer.label }} / {{ selectedLayer.part.name }}</p>
          <p class="mt-1 text-xs font-semibold text-white/62">{{ selectedPartMeta.label }}：{{ selectedPartMeta.value }}</p>
        </div>

        <div>
          <p class="text-xs font-extrabold text-white/50">适配说明</p>
          <p class="mt-2 line-clamp-3 text-sm font-semibold leading-6 text-white/72">{{ store.fitmentSummary }}</p>
        </div>

        <div v-if="featuredSellingPoints.length">
          <p class="text-xs font-extrabold text-white/50">核心卖点</p>
          <div class="mt-2 space-y-2">
            <p
              v-for="point in featuredSellingPoints"
              :key="point"
              class="bg-safety-500/12 px-3 py-2 text-xs font-semibold leading-5 text-white/82"
            >
              {{ point }}
            </p>
          </div>
        </div>

        <div class="border-t border-white/10 pt-3 text-xs font-semibold leading-5 text-white/48">
          备注：{{ store.remarkSummary }}
        </div>
      </div>
    </div>

    <div class="absolute bottom-5 right-5 z-20 flex gap-2">
      <button
        type="button"
        class="bg-iron-950/86 px-4 py-3 text-xs font-extrabold text-white/85 backdrop-blur transition hover:bg-safety-500 hover:text-iron-950"
        @click="toggleFullscreen"
      >
        {{ isFullscreen ? '退出全屏' : '全屏展示' }}
      </button>
      <div class="hidden bg-iron-950/86 px-4 py-3 text-xs font-semibold text-white/80 backdrop-blur md:block">
        {{ store.isCanvasLocked ? '锁定模式：左键拖动画布，滚轮缩放视图' : '左键选择/框选，多选可一起移动，Shift 增减选择，按住空格拖动画布' }}
      </div>
    </div>

    <div
      v-if="isExporting"
      class="absolute inset-0 z-40 flex items-center justify-center bg-white/70 text-sm font-extrabold text-iron-950 backdrop-blur"
    >
      正在生成 PNG...
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { toPng } from 'html-to-image'
import { useConfiguratorStore, type HighlightPart } from '../stores/configurator'
import type { ProductPart } from '../types/product'
import type { CSSProperties } from 'vue'

const store = useConfiguratorStore()
const stageRef = ref<HTMLElement | null>(null)
const viewportRef = ref<HTMLElement | null>(null)
const dragMode = ref<'none' | 'stage' | 'layer' | 'scale' | 'rotate' | 'tilt-x' | 'tilt-y'>('none')
const isExporting = ref(false)
const isAdjustPanelOpen = ref(false)
const isFullscreen = ref(false)
const dragStart = ref({
  x: 0,
  y: 0,
  panX: 0,
  panY: 0,
  layerOffsetX: 0,
  layerOffsetY: 0,
  layerScale: 1,
  rotateX: 0,
  rotateY: 0,
  rotateZ: 0,
  part: 'excavator' as HighlightPart,
})

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

const selectedFrameStyle = computed<CSSProperties>(() => {
  return {
    ...layerStyle(selectedLayer.value),
    zIndex: 80,
    pointerEvents: 'none',
  }
})

function layerStyle(layer: Layer): CSSProperties {
  const adjustment = store.layerAdjustments[layer.type]

  return {
    left: `${layer.part.anchor.x + adjustment.offsetX}px`,
    top: `${layer.part.anchor.y + adjustment.offsetY}px`,
    width: `${layer.part.dimensions.width}px`,
    height: `${layer.part.dimensions.height}px`,
    zIndex: layer.zIndex,
    transform: `translate(-50%, -50%) perspective(1000px) rotateX(${adjustment.rotateX}deg) rotateY(${adjustment.rotateY}deg) rotateZ(${adjustment.rotateZ}deg) scale(${adjustment.scale})`,
    transformStyle: 'preserve-3d',
  }
}

function beginDrag(event: PointerEvent) {
  if ((event.target as HTMLElement).closest('[data-layer-control="true"]')) return

  dragMode.value = 'stage'
  dragStart.value = {
    x: event.clientX,
    y: event.clientY,
    panX: store.panX,
    panY: store.panY,
    layerOffsetX: 0,
    layerOffsetY: 0,
    layerScale: 1,
    rotateX: 0,
    rotateY: 0,
    rotateZ: 0,
    part: store.highlightedPart,
  }
  viewportRef.value?.setPointerCapture(event.pointerId)
}

function beginLayerDrag(event: PointerEvent, part: HighlightPart) {
  event.stopPropagation()
  store.setHighlightedPart(part)

  const adjustment = store.layerAdjustments[part]
  dragMode.value = 'layer'
  dragStart.value = {
    x: event.clientX,
    y: event.clientY,
    panX: store.panX,
    panY: store.panY,
    layerOffsetX: adjustment.offsetX,
    layerOffsetY: adjustment.offsetY,
    layerScale: adjustment.scale,
    rotateX: adjustment.rotateX,
    rotateY: adjustment.rotateY,
    rotateZ: adjustment.rotateZ,
    part,
  }
  viewportRef.value?.setPointerCapture(event.pointerId)
}

function beginTransformDrag(event: PointerEvent, mode: 'scale' | 'rotate' | 'tilt-x' | 'tilt-y') {
  event.stopPropagation()
  const adjustment = store.selectedLayerAdjustment

  dragMode.value = mode
  dragStart.value = {
    x: event.clientX,
    y: event.clientY,
    panX: store.panX,
    panY: store.panY,
    layerOffsetX: adjustment.offsetX,
    layerOffsetY: adjustment.offsetY,
    layerScale: adjustment.scale,
    rotateX: adjustment.rotateX,
    rotateY: adjustment.rotateY,
    rotateZ: adjustment.rotateZ,
    part: store.highlightedPart,
  }
  viewportRef.value?.setPointerCapture(event.pointerId)
}

function moveDrag(event: PointerEvent) {
  if (dragMode.value === 'stage') {
    store.setPan(
      dragStart.value.panX + event.clientX - dragStart.value.x,
      dragStart.value.panY + event.clientY - dragStart.value.y,
    )
  }

  if (dragMode.value === 'layer') {
    const deltaX = (event.clientX - dragStart.value.x) / store.scale
    const deltaY = (event.clientY - dragStart.value.y) / store.scale
    store.updateLayerAdjustment(dragStart.value.part, {
      offsetX: Math.round(dragStart.value.layerOffsetX + deltaX),
      offsetY: Math.round(dragStart.value.layerOffsetY + deltaY),
    })
  }

  if (dragMode.value === 'scale') {
    const delta = ((event.clientX - dragStart.value.x) + (event.clientY - dragStart.value.y)) / 260
    store.setLayerScale(dragStart.value.part, dragStart.value.layerScale + delta)
  }

  if (dragMode.value === 'rotate') {
    const delta = (event.clientX - dragStart.value.x) / 2
    store.setLayerRotation(dragStart.value.part, dragStart.value.rotateZ + delta)
  }

  if (dragMode.value === 'tilt-y') {
    const delta = (event.clientX - dragStart.value.x) / 5
    store.setLayerTilt(dragStart.value.part, dragStart.value.rotateX, dragStart.value.rotateY + delta)
  }

  if (dragMode.value === 'tilt-x') {
    const delta = (event.clientY - dragStart.value.y) / -5
    store.setLayerTilt(dragStart.value.part, dragStart.value.rotateX + delta, dragStart.value.rotateY)
  }
}

function endDrag(event: PointerEvent) {
  dragMode.value = 'none'
  viewportRef.value?.releasePointerCapture(event.pointerId)
}

function handleWheel(event: WheelEvent) {
  event.preventDefault()
  const delta = event.deltaY > 0 ? -0.06 : 0.06
  store.setScale(store.scale + delta)
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
}

async function exportStage() {
  if (!stageRef.value || isExporting.value) return

  isExporting.value = true
  try {
    const dataUrl = await toPng(stageRef.value, {
      cacheBust: true,
      pixelRatio: 2,
      backgroundColor: '#f3f4f6',
    })
    const link = document.createElement('a')
    link.download = `${store.combinationCode.replaceAll(' / ', '-')}.png`
    link.href = dataUrl
    link.click()
  } finally {
    isExporting.value = false
  }
}

onMounted(() => {
  window.addEventListener('export-preview', exportStage)
  document.addEventListener('fullscreenchange', syncFullscreenState)
})

onUnmounted(() => {
  window.removeEventListener('export-preview', exportStage)
  document.removeEventListener('fullscreenchange', syncFullscreenState)
})
</script>

<template>
  <div
    ref="viewportRef"
    class="relative flex flex-1 touch-none select-none overflow-hidden bg-[#f3f4f6]"
    :class="dragMode !== 'none' ? 'cursor-grabbing' : 'cursor-grab'"
    @pointerdown="beginDrag"
    @pointermove="moveDrag"
    @pointerup="endDrag"
    @pointercancel="endDrag"
    @wheel="handleWheel"
  >
    <div class="absolute inset-0 bg-[linear-gradient(180deg,#ffffff_0%,#edf0f2_58%,#d9dee3_100%)]" />
    <div class="absolute inset-x-0 bottom-0 h-48 bg-[linear-gradient(180deg,transparent_0%,rgba(17,19,23,0.16)_100%)]" />
    <div class="absolute bottom-[18%] left-[8%] right-[8%] h-px bg-iron-700/20" />

    <div
      ref="stageRef"
      class="absolute left-1/2 top-1/2"
      :style="{
        width: `${store.catalog.stage.width}px`,
        height: `${store.catalog.stage.height}px`,
        transform: `translate(calc(-50% + ${store.panX}px), calc(-50% + ${store.panY}px)) scale(${store.scale}) ${store.showcaseView ? `perspective(1400px) rotateX(${store.combinationPerspective.rotateX}deg) rotateY(${store.combinationPerspective.rotateY}deg)` : ''}`,
        transformOrigin: 'center center',
        transformStyle: 'preserve-3d',
      }"
    >
      <div class="absolute bottom-[112px] left-28 right-28 h-px bg-iron-700/25" />

      <button
        v-for="layer in layers"
        :key="layer.type"
        type="button"
        data-layer-control="true"
        class="absolute transition duration-200"
        :class="store.highlightedPart === layer.type ? 'drop-shadow-[0_18px_24px_rgba(17,19,23,0.28)]' : 'opacity-95'"
        :style="layerStyle(layer)"
        @click.stop="store.setHighlightedPart(layer.type)"
        @pointerdown="beginLayerDrag($event, layer.type)"
      >
        <span
          class="absolute inset-0 transition duration-200"
          :class="store.highlightedPart === layer.type ? 'outline outline-[5px] outline-offset-[10px] outline-safety-500/80' : ''"
        />
        <img :src="layer.part.image" :alt="layer.part.name" class="h-full w-full object-contain" draggable="false" />
      </button>

      <div class="absolute" data-layer-control="true" :style="selectedFrameStyle">
        <div class="absolute inset-0 border-2 border-safety-500/95 bg-safety-500/5 shadow-[0_0_0_1px_rgba(17,19,23,0.16)]" />
        <button
          type="button"
          class="pointer-events-auto absolute -left-3 -top-3 h-6 w-6 cursor-nwse-resize border-2 border-iron-950 bg-safety-500 shadow-lg"
          title="拖拽缩放"
          @pointerdown="beginTransformDrag($event, 'scale')"
        />
        <button
          type="button"
          class="pointer-events-auto absolute -right-3 -top-3 h-6 w-6 cursor-nesw-resize border-2 border-iron-950 bg-safety-500 shadow-lg"
          title="拖拽缩放"
          @pointerdown="beginTransformDrag($event, 'scale')"
        />
        <button
          type="button"
          class="pointer-events-auto absolute -bottom-3 -left-3 h-6 w-6 cursor-nesw-resize border-2 border-iron-950 bg-safety-500 shadow-lg"
          title="拖拽缩放"
          @pointerdown="beginTransformDrag($event, 'scale')"
        />
        <button
          type="button"
          class="pointer-events-auto absolute -bottom-3 -right-3 h-6 w-6 cursor-nwse-resize border-2 border-iron-950 bg-safety-500 shadow-lg"
          title="拖拽缩放"
          @pointerdown="beginTransformDrag($event, 'scale')"
        />
        <button
          type="button"
          class="pointer-events-auto absolute -top-16 left-1/2 h-7 w-7 -translate-x-1/2 cursor-grab rounded-full border-2 border-iron-950 bg-white shadow-lg"
          title="拖拽旋转"
          @pointerdown="beginTransformDrag($event, 'rotate')"
        />
        <span class="absolute -top-10 left-1/2 h-10 w-px -translate-x-1/2 bg-safety-500/90" />
        <button
          type="button"
          class="pointer-events-auto absolute -right-4 top-1/2 h-10 w-8 -translate-y-1/2 cursor-ew-resize border-2 border-iron-950 bg-white text-[10px] font-extrabold text-iron-950 shadow-lg"
          title="拖拽左右透视"
          @pointerdown="beginTransformDrag($event, 'tilt-y')"
        >
          Y
        </button>
        <button
          type="button"
          class="pointer-events-auto absolute bottom-[-18px] left-1/2 h-8 w-10 -translate-x-1/2 cursor-ns-resize border-2 border-iron-950 bg-white text-[10px] font-extrabold text-iron-950 shadow-lg"
          title="拖拽上下透视"
          @pointerdown="beginTransformDrag($event, 'tilt-x')"
        >
          X
        </button>
      </div>
    </div>

    <div class="absolute left-5 top-5 w-[min(420px,calc(100%-2.5rem))] border-l-4 border-safety-500 bg-white/86 px-4 py-3 shadow-lg backdrop-blur">
      <p class="text-[11px] font-extrabold uppercase tracking-[0.16em] text-iron-700/60">Live Assembly</p>
      <h2 class="mt-1 text-xl font-extrabold text-iron-950">{{ store.combinationCode }}</h2>
      <p class="mt-1 text-sm font-semibold text-iron-700">{{ selectedLayer.label }}：{{ selectedLayer.part.name }}</p>
    </div>

    <div class="absolute bottom-5 left-5 flex flex-wrap gap-2" data-layer-control="true">
      <button
        v-for="layer in layers"
        :key="layer.type"
        type="button"
        class="h-11 min-w-20 border px-4 text-sm font-extrabold transition duration-200"
        :class="store.highlightedPart === layer.type ? 'border-safety-500 bg-safety-500 text-iron-950' : 'border-black/10 bg-white/86 text-iron-800 hover:border-safety-500'"
        @click="store.setHighlightedPart(layer.type)"
      >
        {{ layer.label }}
      </button>
    </div>

    <div class="absolute right-5 top-5 w-[min(320px,calc(100%-2.5rem))] bg-iron-950/88 text-white shadow-xl backdrop-blur" data-layer-control="true">
      <div class="flex items-start justify-between gap-3">
        <button type="button" class="flex-1 p-4 text-left" @click="isAdjustPanelOpen = !isAdjustPanelOpen">
          <p class="text-[11px] font-extrabold uppercase tracking-[0.16em] text-safety-500">Layout Adjust</p>
          <p class="mt-1 text-base font-extrabold">{{ selectedLayer.label }} / 当前组合</p>
        </button>
        <button
          type="button"
          class="m-4 border border-white/15 px-2 py-1 text-xs font-extrabold text-white/75 transition hover:border-safety-500 hover:text-safety-500"
          @click="isAdjustPanelOpen = !isAdjustPanelOpen"
        >
          {{ isAdjustPanelOpen ? '收起' : '展开' }}
        </button>
      </div>

      <div v-if="isAdjustPanelOpen" class="space-y-4 border-t border-white/10 p-4 pt-4">
        <div class="flex gap-2">
          <button
            type="button"
            class="flex-1 border border-white/15 px-2 py-2 text-xs font-extrabold text-white/75 transition hover:border-safety-500 hover:text-safety-500"
            @click="store.resetCurrentCombinationLayout"
          >
            重置组合
          </button>
          <button
            type="button"
            class="flex-1 border border-white/15 px-2 py-2 text-xs font-extrabold text-white/75 transition hover:border-safety-500 hover:text-safety-500"
            @click="store.resetLayerAdjustment(store.highlightedPart)"
          >
            重置单层
          </button>
        </div>

        <div class="border-b border-white/10 pb-4">
          <p class="text-xs font-extrabold text-white/80">画布控制点</p>
          <div class="mt-3 space-y-2 text-xs font-semibold leading-5 text-white/62">
            <p>拖动选中部件：移动位置。</p>
            <p>拖动四个黄色角点：缩放大小。</p>
            <p>拖动顶部白色圆点：平面旋转。</p>
            <p>拖动右侧 Y / 底部 X 控制点：调整左右和上下透视。</p>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2 text-xs">
          <button type="button" class="border border-white/15 px-2 py-2 font-extrabold text-white/75 transition hover:border-safety-500 hover:text-safety-500" @click="store.resetLayerScale(store.highlightedPart)">重置大小</button>
          <button type="button" class="border border-white/15 px-2 py-2 font-extrabold text-white/75 transition hover:border-safety-500 hover:text-safety-500" @click="store.resetLayerRotation(store.highlightedPart)">重置旋转</button>
          <button type="button" class="border border-white/15 px-2 py-2 font-extrabold text-white/75 transition hover:border-safety-500 hover:text-safety-500" @click="store.resetLayerTiltX(store.highlightedPart)">重置上下透视</button>
          <button type="button" class="border border-white/15 px-2 py-2 font-extrabold text-white/75 transition hover:border-safety-500 hover:text-safety-500" @click="store.resetLayerTiltY(store.highlightedPart)">重置左右透视</button>
        </div>

        <div class="border-t border-white/10 pt-3 text-xs font-semibold leading-5 text-white/55">
          当前：大小 {{ Math.round(store.selectedLayerAdjustment.scale * 100) }}%，旋转 {{ store.selectedLayerAdjustment.rotateZ }} deg，X {{ store.selectedLayerAdjustment.rotateX }} deg，Y {{ store.selectedLayerAdjustment.rotateY }} deg。
        </div>
      </div>
    </div>

    <div class="absolute bottom-5 right-5 flex gap-2" data-layer-control="true">
      <button
        type="button"
        class="bg-iron-950/86 px-4 py-3 text-xs font-extrabold text-white/85 backdrop-blur transition hover:bg-safety-500 hover:text-iron-950"
        @click="toggleFullscreen"
      >
        {{ isFullscreen ? '退出全屏' : '全屏展示' }}
      </button>
      <div class="hidden bg-iron-950/86 px-4 py-3 text-xs font-semibold text-white/80 backdrop-blur md:block">
        拖动部件移动，拖角点缩放，拖白色圆点旋转，拖空白移动画面
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

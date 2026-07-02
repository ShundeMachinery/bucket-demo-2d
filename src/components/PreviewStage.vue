<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { toPng } from 'html-to-image'
import { useConfiguratorStore, type HighlightPart } from '../stores/configurator'
import type { ProductPart } from '../types/product'

const store = useConfiguratorStore()
const stageRef = ref<HTMLElement | null>(null)
const viewportRef = ref<HTMLElement | null>(null)
const isDragging = ref(false)
const isExporting = ref(false)
const dragStart = ref({ x: 0, y: 0, panX: 0, panY: 0 })

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

function layerStyle(layer: Layer) {
  return {
    left: `${layer.part.anchor.x}px`,
    top: `${layer.part.anchor.y}px`,
    width: `${layer.part.dimensions.width}px`,
    height: `${layer.part.dimensions.height}px`,
    zIndex: layer.zIndex,
    transform: 'translate(-50%, -50%)',
  }
}

function beginDrag(event: PointerEvent) {
  if ((event.target as HTMLElement).closest('[data-layer-control="true"]')) return

  isDragging.value = true
  dragStart.value = {
    x: event.clientX,
    y: event.clientY,
    panX: store.panX,
    panY: store.panY,
  }
  viewportRef.value?.setPointerCapture(event.pointerId)
}

function moveDrag(event: PointerEvent) {
  if (!isDragging.value) return
  store.setPan(
    dragStart.value.panX + event.clientX - dragStart.value.x,
    dragStart.value.panY + event.clientY - dragStart.value.y,
  )
}

function endDrag(event: PointerEvent) {
  isDragging.value = false
  viewportRef.value?.releasePointerCapture(event.pointerId)
}

function handleWheel(event: WheelEvent) {
  event.preventDefault()
  const delta = event.deltaY > 0 ? -0.06 : 0.06
  store.setScale(store.scale + delta)
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
})

onUnmounted(() => {
  window.removeEventListener('export-preview', exportStage)
})
</script>

<template>
  <div
    ref="viewportRef"
    class="relative flex flex-1 touch-none select-none overflow-hidden bg-[#f3f4f6]"
    :class="isDragging ? 'cursor-grabbing' : 'cursor-grab'"
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
        transform: `translate(calc(-50% + ${store.panX}px), calc(-50% + ${store.panY}px)) scale(${store.scale})`,
        transformOrigin: 'center center',
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
      >
        <span
          class="absolute inset-0 transition duration-200"
          :class="store.highlightedPart === layer.type ? 'outline outline-[5px] outline-offset-[10px] outline-safety-500/80' : ''"
        />
        <img :src="layer.part.image" :alt="layer.part.name" class="h-full w-full object-contain" draggable="false" />
      </button>
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

    <div class="absolute bottom-5 right-5 hidden bg-iron-950/86 px-4 py-3 text-xs font-semibold text-white/80 backdrop-blur md:block">
      拖动画面查看细节，滚轮缩放
    </div>

    <div
      v-if="isExporting"
      class="absolute inset-0 z-40 flex items-center justify-center bg-white/70 text-sm font-extrabold text-iron-950 backdrop-blur"
    >
      正在生成 PNG...
    </div>
  </div>
</template>

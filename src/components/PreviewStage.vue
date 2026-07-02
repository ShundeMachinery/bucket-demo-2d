<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { toPng } from 'html-to-image'
import { useConfiguratorStore, type HighlightPart } from '../stores/configurator'
import type { ProductPart } from '../types/product'
import type { CSSProperties } from 'vue'

const store = useConfiguratorStore()
const stageRef = ref<HTMLElement | null>(null)
const viewportRef = ref<HTMLElement | null>(null)
const dragMode = ref<'none' | 'stage' | 'layer'>('none')
const isExporting = ref(false)
const dragStart = ref({
  x: 0,
  y: 0,
  panX: 0,
  panY: 0,
  layerOffsetX: 0,
  layerOffsetY: 0,
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

function layerStyle(layer: Layer): CSSProperties {
  const adjustment = store.layerAdjustments[layer.type]
  return {
    left: `${layer.part.anchor.x + adjustment.offsetX}px`,
    top: `${layer.part.anchor.y + adjustment.offsetY}px`,
    width: `${layer.part.dimensions.width}px`,
    height: `${layer.part.dimensions.height}px`,
    zIndex: layer.zIndex,
    transform: `translate(-50%, -50%) perspective(1000px) rotateX(${adjustment.rotateX}deg) rotateY(${adjustment.rotateY}deg) scale(${adjustment.scale})`,
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
    part,
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

    <div class="absolute right-5 top-5 w-[min(300px,calc(100%-2.5rem))] bg-iron-950/88 p-4 text-white shadow-xl backdrop-blur" data-layer-control="true">
      <div class="flex items-start justify-between gap-3">
        <div>
          <p class="text-[11px] font-extrabold uppercase tracking-[0.16em] text-safety-500">Layout Adjust</p>
          <p class="mt-1 text-base font-extrabold">{{ selectedLayer.label }} / 当前组合</p>
        </div>
        <button
          type="button"
          class="border border-white/15 px-2 py-1 text-xs font-extrabold text-white/75 transition hover:border-safety-500 hover:text-safety-500"
          @click="store.resetCurrentCombinationLayout"
        >
          重置组合
        </button>
      </div>

      <div class="mt-4 space-y-4">
        <div class="border-b border-white/10 pb-4">
          <p class="text-xs font-extrabold text-white/80">组合整体透视</p>
          <label class="mt-3 block">
            <span class="flex items-center justify-between text-xs font-bold text-white/60">
              <span>整体上下</span>
              <span>{{ store.combinationPerspective.rotateX }} deg</span>
            </span>
            <input
              class="mt-2 h-2 w-full accent-safety-500"
              type="range"
              min="-18"
              max="18"
              :value="store.combinationPerspective.rotateX"
              @input="store.setCombinationPerspective(Number(($event.target as HTMLInputElement).value), store.combinationPerspective.rotateY)"
            />
          </label>

          <label class="mt-3 block">
            <span class="flex items-center justify-between text-xs font-bold text-white/60">
              <span>整体左右</span>
              <span>{{ store.combinationPerspective.rotateY }} deg</span>
            </span>
            <input
              class="mt-2 h-2 w-full accent-safety-500"
              type="range"
              min="-24"
              max="24"
              :value="store.combinationPerspective.rotateY"
              @input="store.setCombinationPerspective(store.combinationPerspective.rotateX, Number(($event.target as HTMLInputElement).value))"
            />
          </label>
        </div>

        <p class="text-xs font-extrabold text-white/80">单个部件校准</p>
        <label class="block">
          <span class="flex items-center justify-between text-xs font-bold text-white/60">
            <span>单层大小</span>
            <span>{{ Math.round(store.selectedLayerAdjustment.scale * 100) }}%</span>
          </span>
          <input
            class="mt-2 h-2 w-full accent-safety-500"
            type="range"
            min="55"
            max="160"
            :value="Math.round(store.selectedLayerAdjustment.scale * 100)"
            @input="store.setLayerScale(store.highlightedPart, Number(($event.target as HTMLInputElement).value) / 100)"
          />
        </label>

        <label class="block">
          <span class="flex items-center justify-between text-xs font-bold text-white/60">
            <span>左右透视</span>
            <span>{{ store.selectedLayerAdjustment.rotateY }} deg</span>
          </span>
          <input
            class="mt-2 h-2 w-full accent-safety-500"
            type="range"
            min="-24"
            max="24"
            :value="store.selectedLayerAdjustment.rotateY"
            @input="store.setLayerTilt(store.highlightedPart, store.selectedLayerAdjustment.rotateX, Number(($event.target as HTMLInputElement).value))"
          />
        </label>

        <label class="block">
          <span class="flex items-center justify-between text-xs font-bold text-white/60">
            <span>上下透视</span>
            <span>{{ store.selectedLayerAdjustment.rotateX }} deg</span>
          </span>
          <input
            class="mt-2 h-2 w-full accent-safety-500"
            type="range"
            min="-18"
            max="18"
            :value="store.selectedLayerAdjustment.rotateX"
            @input="store.setLayerTilt(store.highlightedPart, Number(($event.target as HTMLInputElement).value), store.selectedLayerAdjustment.rotateY)"
          />
        </label>
      </div>
    </div>

    <div class="absolute bottom-5 right-5 hidden bg-iron-950/86 px-4 py-3 text-xs font-semibold text-white/80 backdrop-blur md:block">
      拖动部件校准位置，拖动空白移动画面，滚轮缩放
    </div>

    <div
      v-if="isExporting"
      class="absolute inset-0 z-40 flex items-center justify-center bg-white/70 text-sm font-extrabold text-iron-950 backdrop-blur"
    >
      正在生成 PNG...
    </div>
  </div>
</template>

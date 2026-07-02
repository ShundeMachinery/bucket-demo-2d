<script setup lang="ts">
import { useConfiguratorStore } from '../stores/configurator'

const store = useConfiguratorStore()

function exportPreview() {
  window.dispatchEvent(new CustomEvent('export-preview'))
}
</script>

<template>
  <div class="flex flex-wrap items-center justify-between gap-3 border-b border-iron-700/10 bg-white px-4 py-3">
    <div class="flex items-center gap-2">
      <button type="button" class="tool-button" title="缩小" @click="store.zoomOut">-</button>
      <input
        class="h-2 w-32 accent-safety-500"
        type="range"
        min="48"
        max="180"
        :value="Math.round(store.scale * 100)"
        aria-label="缩放"
        @input="store.setScale(Number(($event.target as HTMLInputElement).value) / 100)"
      />
      <button type="button" class="tool-button" title="放大" @click="store.zoomIn">+</button>
      <span class="w-14 text-center text-xs font-extrabold text-iron-700">{{ Math.round(store.scale * 100) }}%</span>
    </div>

    <div class="flex flex-wrap items-center gap-2">
      <button
        type="button"
        class="tool-button"
        :class="store.showcaseView ? 'border-safety-500 bg-safety-100' : ''"
        title="切换伪 3D 展台视角"
        @click="store.toggleShowcaseView"
      >
        展台视角
      </button>
      <button type="button" class="tool-button" title="重置视图" @click="store.resetView">复位视图</button>
      <button type="button" class="tool-button" title="重置三层位置和大小" @click="store.resetAllLayerAdjustments">重置部件</button>
      <button type="button" class="tool-button" title="恢复默认组合" @click="store.restoreDefaultCombination">推荐组合</button>
      <button type="button" class="tool-button bg-iron-950 text-white hover:bg-iron-800" title="导出当前预览为 PNG" @click="exportPreview">导出 PNG</button>
    </div>
  </div>
</template>

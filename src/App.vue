<script setup lang="ts">
import { ref } from 'vue'
import CombinationSummary from './components/CombinationSummary.vue'
import DataManager from './components/DataManager.vue'
import PreviewStage from './components/PreviewStage.vue'
import ProductSelectorPanel from './components/ProductSelectorPanel.vue'
import Toolbar from './components/Toolbar.vue'

const activePage = ref<'demo' | 'data'>('demo')
</script>

<template>
  <main v-if="activePage === 'demo'" class="min-h-screen bg-iron-950 text-iron-950">
    <section class="grid min-h-screen lg:grid-cols-[320px_minmax(640px,1fr)_320px]">
      <ProductSelectorPanel />

      <section class="flex min-h-screen flex-col bg-white">
        <header class="flex flex-wrap items-center justify-between gap-3 border-b border-iron-700/10 bg-white px-5 py-4">
          <div>
            <p class="text-[11px] font-extrabold uppercase tracking-[0.22em] text-safety-600">Exhibition Demo</p>
            <h1 class="mt-1 text-2xl font-extrabold text-iron-950">斗齿装配展示台</h1>
          </div>
          <div class="flex flex-wrap items-center gap-3">
            <p class="max-w-md text-sm font-semibold leading-6 text-iron-700">
              选择主机、挖斗和斗齿，现场查看装配比例和适配信息。
            </p>
            <button type="button" class="tool-button bg-iron-950 text-white hover:bg-iron-800" @click="activePage = 'data'">数据管理</button>
          </div>
        </header>

        <Toolbar />
        <PreviewStage />
      </section>

      <CombinationSummary />
    </section>
  </main>

  <main v-else class="min-h-screen bg-iron-950">
    <div class="border-b border-white/10 bg-iron-950 px-6 py-4">
      <button type="button" class="tool-button" @click="activePage = 'demo'">返回展示台</button>
    </div>
    <DataManager />
  </main>
</template>

<script setup lang="ts">
import CombinationSummary from '../components/CombinationSummary.vue'
import PreviewStage from '../components/PreviewStage.vue'
import ProductSelectorPanel from '../components/ProductSelectorPanel.vue'
import Toolbar from '../components/Toolbar.vue'
import { navigateTo } from '../router'
</script>

<template>
  <main class="min-h-screen bg-iron-950 text-iron-950">
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
            <button type="button" class="tool-button bg-iron-950 text-white hover:bg-iron-800" @click="navigateTo('data')">数据管理</button>
          </div>
        </header>

        <Toolbar />
        <PreviewStage />
      </section>

      <CombinationSummary />
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useConfiguratorStore } from '../stores/configurator'

const store = useConfiguratorStore()

const topSellingPoints = computed(() => {
  return [
    ...store.selectedBucket.sellingPoints,
    ...store.selectedTooth.sellingPoints,
    ...store.selectedExcavator.sellingPoints,
  ].slice(0, 5)
})
</script>

<template>
  <aside class="flex max-h-screen flex-col border-l border-black/10 bg-white">
    <div class="border-b border-iron-700/10 px-5 py-5">
      <p class="text-[11px] font-extrabold uppercase tracking-[0.22em] text-safety-600">Specification</p>
      <h2 class="mt-1 text-2xl font-extrabold text-iron-950">当前方案</h2>
    </div>

    <div class="flex-1 overflow-y-auto px-5 py-5">
      <section class="border-b border-iron-700/10 pb-5">
        <p class="text-xs font-extrabold uppercase tracking-[0.16em] text-iron-700/45">Assembly Code</p>
        <p class="mt-2 text-xl font-extrabold leading-tight text-iron-950">{{ store.combinationCode }}</p>
      </section>

      <section class="space-y-3 border-b border-iron-700/10 py-5">
        <div>
          <p class="text-xs font-bold text-iron-700/55">主机</p>
          <p class="mt-1 text-sm font-extrabold text-iron-950">{{ store.selectedExcavator.name }}</p>
          <p class="text-xs font-semibold text-iron-700">{{ store.selectedExcavator.tonnage }}</p>
        </div>
        <div>
          <p class="text-xs font-bold text-iron-700/55">挖斗</p>
          <p class="mt-1 text-sm font-extrabold text-iron-950">{{ store.selectedBucket.name }}</p>
          <p class="text-xs font-semibold text-iron-700">{{ store.selectedBucket.capacity }}</p>
        </div>
        <div>
          <p class="text-xs font-bold text-iron-700/55">斗齿</p>
          <p class="mt-1 text-sm font-extrabold text-iron-950">{{ store.selectedTooth.name }}</p>
          <p class="text-xs font-semibold text-iron-700">{{ store.selectedTooth.material }}</p>
        </div>
      </section>

      <section class="border-b border-iron-700/10 py-5">
        <h3 class="text-sm font-extrabold text-iron-950">适配结论</h3>
        <p class="mt-2 text-sm font-semibold leading-6 text-iron-700">{{ store.fitmentSummary }}</p>
      </section>

      <section class="border-b border-iron-700/10 py-5">
        <h3 class="text-sm font-extrabold text-iron-950">推荐卖点</h3>
        <div class="mt-3 space-y-2">
          <p
            v-for="point in topSellingPoints"
            :key="point"
            class="border-l-2 border-safety-500 bg-iron-50 px-3 py-2 text-sm font-semibold text-iron-800"
          >
            {{ point }}
          </p>
        </div>
      </section>

      <section class="py-5">
        <h3 class="text-sm font-extrabold text-iron-950">备注</h3>
        <p class="mt-2 text-sm font-semibold leading-6 text-iron-700">{{ store.remarkSummary }}</p>
      </section>
    </div>
  </aside>
</template>

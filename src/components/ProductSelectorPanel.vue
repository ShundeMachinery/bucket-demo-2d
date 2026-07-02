<script setup lang="ts">
import { useConfiguratorStore } from '../stores/configurator'
import type { Bucket, Excavator, Tooth } from '../types/product'

const store = useConfiguratorStore()

type ProductOption = Excavator | Bucket | Tooth

function optionMeta(item: ProductOption) {
  if ('tonnage' in item) return item.tonnage
  if ('capacity' in item) return item.capacity
  return item.material
}
</script>

<template>
  <aside class="flex max-h-screen flex-col bg-iron-950 text-white">
    <div class="border-b border-white/10 px-5 py-5">
      <p class="text-[11px] font-extrabold uppercase tracking-[0.22em] text-safety-500">Configure</p>
      <h2 class="mt-1 text-2xl font-extrabold">产品组合</h2>
    </div>

    <div class="flex-1 space-y-5 overflow-y-auto px-4 py-5">
      <section class="space-y-2">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-extrabold text-white">1. 主机</h3>
          <span class="text-xs font-bold text-white/45">{{ store.excavators.length }} 款</span>
        </div>
        <button
          v-for="item in store.excavators"
          :key="item.id"
          type="button"
          class="w-full border px-3 py-3 text-left transition duration-200"
          :class="item.id === store.selectedExcavatorId ? 'border-safety-500 bg-safety-500 text-iron-950' : 'border-white/10 bg-white/6 text-white hover:border-safety-500'"
          @click="store.selectExcavator(item.id)"
        >
          <div class="flex items-center justify-between gap-3">
            <p class="text-sm font-extrabold">{{ item.name }}</p>
            <span class="shrink-0 text-xs font-extrabold">{{ optionMeta(item) }}</span>
          </div>
        </button>
      </section>

      <section class="space-y-2">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-extrabold text-white">2. 挖斗</h3>
          <span class="text-xs font-bold text-white/45">匹配 {{ store.compatibleBuckets.length }} 款</span>
        </div>
        <button
          v-for="item in store.compatibleBuckets"
          :key="item.id"
          type="button"
          class="w-full border px-3 py-3 text-left transition duration-200"
          :class="item.id === store.selectedBucketId ? 'border-safety-500 bg-safety-500 text-iron-950' : 'border-white/10 bg-white/6 text-white hover:border-safety-500'"
          @click="store.selectBucket(item.id)"
        >
          <div class="flex items-center justify-between gap-3">
            <p class="text-sm font-extrabold">{{ item.name }}</p>
            <span class="shrink-0 text-xs font-extrabold">{{ optionMeta(item) }}</span>
          </div>
        </button>
      </section>

      <section class="space-y-2">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-extrabold text-white">3. 斗齿</h3>
          <span class="text-xs font-bold text-white/45">匹配 {{ store.compatibleTeeth.length }} 款</span>
        </div>
        <button
          v-for="item in store.compatibleTeeth"
          :key="item.id"
          type="button"
          class="w-full border px-3 py-3 text-left transition duration-200"
          :class="item.id === store.selectedToothId ? 'border-safety-500 bg-safety-500 text-iron-950' : 'border-white/10 bg-white/6 text-white hover:border-safety-500'"
          @click="store.selectTooth(item.id)"
        >
          <div class="flex items-center justify-between gap-3">
            <p class="text-sm font-extrabold">{{ item.name }}</p>
            <span class="shrink-0 text-[11px] font-extrabold">{{ optionMeta(item) }}</span>
          </div>
        </button>
      </section>
    </div>
  </aside>
</template>

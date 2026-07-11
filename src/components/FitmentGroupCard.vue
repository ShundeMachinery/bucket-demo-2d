<script setup lang="ts">
import { computed } from 'vue'
import type { FitmentGroup } from '../types/product'

const props = defineProps<{
  group: FitmentGroup
}>()

const categoryLabels = computed(() => {
  return [...new Set(props.group.items.map((item) => item.categoryLabel))]
})
</script>

<template>
  <article class="border border-iron-700/12 bg-white p-4 transition duration-200 hover:border-safety-500 hover:shadow-sm">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div class="min-w-0">
        <div class="flex flex-wrap items-center gap-2">
          <span class="bg-safety-100 px-2 py-1 text-xs font-extrabold text-safety-600">{{ group.code }}</span>
          <span class="bg-iron-50 px-2 py-1 text-xs font-bold text-iron-700">{{ group.items.length }} 个产品</span>
        </div>
        <h3 class="mt-3 line-clamp-2 text-base font-extrabold leading-6 text-iron-950">
          {{ group.name }}
        </h3>
        <p v-if="group.description" class="mt-2 line-clamp-2 text-sm font-semibold leading-6 text-iron-700/70">
          {{ group.description }}
        </p>
      </div>
      <div class="flex shrink-0 flex-wrap gap-1 sm:max-w-[180px] sm:justify-end">
        <span
          v-for="category in categoryLabels"
          :key="category"
          class="border border-iron-700/12 bg-white px-2 py-1 text-[11px] font-bold text-iron-700/70"
        >
          {{ category }}
        </span>
      </div>
    </div>

    <div v-if="group.items.length > 0" class="mt-4 grid gap-2 md:grid-cols-2">
      <div
        v-for="item in group.items.slice(0, 4)"
        :key="item.id"
        class="min-w-0 border border-iron-700/10 bg-iron-50 p-3"
      >
        <div class="flex min-w-0 items-center gap-2">
          <span class="shrink-0 text-xs font-extrabold text-safety-600">{{ item.categoryLabel }}</span>
          <span class="truncate text-xs font-semibold text-iron-700/60">{{ item.product.sku }}</span>
        </div>
        <p class="mt-1 line-clamp-2 text-xs font-bold leading-5 text-iron-950">
          {{ item.product.name }}
        </p>
      </div>
    </div>

    <p v-if="group.items.length > 4" class="mt-3 text-xs font-semibold text-iron-700/60">
      还有 {{ group.items.length - 4 }} 个产品未展开
    </p>
  </article>
</template>

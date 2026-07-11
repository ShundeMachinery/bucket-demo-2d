<script setup lang="ts">
import { computed } from 'vue'
import type { ProductSummary } from '../types/product'

const props = withDefaults(defineProps<{
  product: ProductSummary
  tag?: string
  actionLabel?: string
  selected?: boolean
  compact?: boolean
}>(), {
  tag: '',
  actionLabel: '',
  selected: false,
  compact: false,
})

const emit = defineEmits<{
  select: [productId: string]
}>()

const placeholderText = computed(() => {
  const value = props.product.sku || props.product.name
  return value.slice(0, 2).toUpperCase()
})
</script>

<template>
  <article
    class="grid min-w-0 gap-3 border bg-white text-left transition duration-200"
    :class="[
      compact ? 'grid-cols-[64px_1fr] p-2' : 'grid-cols-[88px_1fr] p-3',
      selected ? 'border-safety-500 ring-2 ring-safety-500/30' : 'border-iron-700/12 hover:border-safety-500 hover:shadow-sm',
    ]"
  >
    <img
      v-if="product.imageUrl"
      :src="product.imageUrl"
      :alt="product.name"
      class="border border-iron-700/10 object-cover"
      :class="compact ? 'h-16 w-16' : 'h-[88px] w-[88px]'"
      loading="lazy"
    >
    <div
      v-else
      class="grid place-items-center border border-iron-700/10 bg-iron-50 font-extrabold text-iron-700"
      :class="compact ? 'h-16 w-16 text-sm' : 'h-[88px] w-[88px] text-base'"
      aria-hidden="true"
    >
      {{ placeholderText }}
    </div>

    <div class="min-w-0">
      <div class="flex min-w-0 flex-wrap items-center gap-2">
        <span v-if="tag" class="bg-safety-100 px-2 py-1 text-[11px] font-extrabold text-safety-600">{{ tag }}</span>
        <span class="truncate text-xs font-bold text-iron-700/60">{{ product.sku }}</span>
      </div>
      <h3 class="mt-1 line-clamp-2 text-sm font-extrabold leading-5 text-iron-950">
        {{ product.name }}
      </h3>
      <div class="mt-2 flex flex-wrap items-center gap-2 text-xs font-semibold text-iron-700/65">
        <span>{{ product.categoryLabel ?? '未分类' }}</span>
        <span v-if="product.externalWeightKg">{{ product.externalWeightKg }} kg</span>
        <span v-if="product.oemNumber">OEM {{ product.oemNumber }}</span>
      </div>
      <button
        v-if="actionLabel"
        type="button"
        class="mt-3 h-8 border border-iron-700/20 px-3 text-xs font-extrabold text-iron-900 transition hover:border-safety-500 hover:bg-safety-100"
        @click="emit('select', product.id)"
      >
        {{ actionLabel }}
      </button>
    </div>
  </article>
</template>

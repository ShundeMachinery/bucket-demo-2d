<script setup lang="ts">
import { computed } from 'vue'
import { useConfiguratorStore } from '../stores/configurator'
import type { ProductSummary } from '../types/product'

const store = useConfiguratorStore()

const listTitle = computed(() => (
  store.hasSelection ? `第 ${store.selectedProductIds.length + 1} 步：继续选择` : '第 1 步：选择产品'
))

function productInitials(product: ProductSummary): string {
  return (product.sku || product.name).slice(0, 2).toUpperCase()
}

function updateSearch(event: Event): void {
  store.setSearch((event.target as HTMLInputElement).value)
}

function updateCategory(event: Event): void {
  const value = (event.target as HTMLSelectElement).value
  store.setCategory(value || null)
}
</script>

<template>
  <aside class="flex max-h-screen min-h-screen flex-col bg-iron-950 text-white">
    <div class="border-b border-white/10 px-5 py-5">
      <p class="text-[11px] font-extrabold uppercase tracking-[0.22em] text-safety-500">Directus Fitment</p>
      <h2 class="mt-1 text-2xl font-extrabold">产品选配</h2>
      <p class="mt-2 text-sm font-semibold leading-6 text-white/55">
        从 Directus 适配组中筛选可共同组合的产品。
      </p>
    </div>

    <div class="border-b border-white/10 px-4 py-4">
      <label class="block text-xs font-extrabold uppercase tracking-[0.16em] text-white/45" for="product-search">搜索</label>
      <input
        id="product-search"
        class="mt-2 h-10 w-full border border-white/12 bg-white/8 px-3 text-sm font-semibold text-white outline-none transition placeholder:text-white/35 focus:border-safety-500"
        type="search"
        placeholder="SKU、名称、OEM、适配组"
        :value="store.search"
        @input="updateSearch"
      >

      <label class="mt-4 block text-xs font-extrabold uppercase tracking-[0.16em] text-white/45" for="category-filter">分类</label>
      <select
        id="category-filter"
        class="mt-2 h-10 w-full border border-white/12 bg-iron-900 px-3 text-sm font-semibold text-white outline-none transition focus:border-safety-500"
        :value="store.selectedCategoryId ?? ''"
        @change="updateCategory"
      >
        <option value="">全部分类</option>
        <option v-for="category in store.categories" :key="category.id" :value="category.id">
          {{ category.label }}
        </option>
      </select>
    </div>

    <section v-if="store.selectedProducts.length > 0" class="border-b border-white/10 px-4 py-4">
      <div class="flex items-center justify-between gap-3">
        <h3 class="text-sm font-extrabold">已选产品</h3>
        <button
          type="button"
          class="border border-white/12 px-2 py-1 text-xs font-extrabold text-white/70 transition hover:border-safety-500 hover:text-safety-500"
          @click="store.resetSelection"
        >
          重新选择
        </button>
      </div>

      <div class="mt-3 space-y-2">
        <article
          v-for="(product, index) in store.selectedProducts"
          :key="product.id"
          class="grid grid-cols-[1fr_auto] gap-3 border border-white/10 bg-white/6 p-3"
        >
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <span class="shrink-0 bg-safety-500 px-2 py-0.5 text-[11px] font-extrabold text-iron-950">第 {{ index + 1 }} 件</span>
              <span class="truncate text-xs font-bold text-white/45">{{ product.sku }}</span>
            </div>
            <p class="mt-1 line-clamp-2 text-sm font-extrabold leading-5">{{ product.name }}</p>
          </div>
          <button
            type="button"
            class="h-8 self-center border border-white/12 px-2 text-xs font-extrabold text-white/65 transition hover:border-safety-500 hover:text-safety-500"
            @click="store.removeSelectedProduct(product.id)"
          >
            移除
          </button>
        </article>
      </div>
    </section>

    <div class="flex-1 overflow-y-auto px-4 py-4">
      <div class="mb-3 flex items-center justify-between gap-3">
        <h3 class="text-sm font-extrabold">{{ listTitle }}</h3>
        <span class="text-xs font-bold text-white/45">{{ store.activeResultCount }} 个结果</span>
      </div>

      <div v-if="store.productError || store.fitmentError" class="mb-3 border border-red-300/40 bg-red-500/10 p-3 text-sm font-semibold leading-6 text-red-100">
        {{ store.productError ?? store.fitmentError }}
      </div>

      <div v-if="store.isProductLoading || store.isFitmentLoading" class="space-y-2">
        <div v-for="index in 8" :key="index" class="h-[92px] animate-pulse border border-white/10 bg-white/8" />
      </div>

      <div v-else-if="!store.hasSelection" class="space-y-2">
        <button
          v-for="product in store.products"
          :key="product.id"
          type="button"
          class="grid w-full grid-cols-[58px_1fr] gap-3 border border-white/10 bg-white/6 p-2 text-left transition duration-200 hover:border-safety-500 hover:bg-white/10"
          @click="store.selectProduct(product.id)"
        >
          <img
            v-if="product.imageUrl"
            :src="product.imageUrl"
            :alt="product.name"
            class="h-[58px] w-[58px] border border-white/10 object-cover"
            loading="lazy"
          >
          <span v-else class="grid h-[58px] w-[58px] place-items-center border border-white/10 bg-white/8 text-xs font-extrabold text-white/75">
            {{ productInitials(product) }}
          </span>
          <span class="min-w-0">
            <span class="flex min-w-0 items-center gap-2">
              <span class="truncate text-xs font-bold text-safety-500">{{ product.sku }}</span>
              <span class="shrink-0 text-[11px] font-semibold text-white/40">{{ product.categoryLabel ?? '未分类' }}</span>
            </span>
            <span class="mt-1 line-clamp-2 block text-sm font-extrabold leading-5">{{ product.name }}</span>
            <span v-if="product.externalWeightKg" class="mt-1 block text-xs font-semibold text-white/45">{{ product.externalWeightKg }} kg</span>
          </span>
        </button>
      </div>

      <div v-else-if="store.candidateProducts.length > 0" class="space-y-2">
        <button
          v-for="candidate in store.candidateProducts"
          :key="candidate.product.id"
          type="button"
          class="grid w-full grid-cols-[58px_1fr] gap-3 border border-white/10 bg-white/6 p-2 text-left transition duration-200 hover:border-safety-500 hover:bg-white/10"
          @click="store.selectProduct(candidate.product.id)"
        >
          <img
            v-if="candidate.product.imageUrl"
            :src="candidate.product.imageUrl"
            :alt="candidate.product.name"
            class="h-[58px] w-[58px] border border-white/10 object-cover"
            loading="lazy"
          >
          <span v-else class="grid h-[58px] w-[58px] place-items-center border border-white/10 bg-white/8 text-xs font-extrabold text-white/75">
            {{ productInitials(candidate.product) }}
          </span>
          <span class="min-w-0">
            <span class="flex min-w-0 flex-wrap items-center gap-2">
              <span class="text-xs font-bold text-safety-500">{{ candidate.categoryLabels.join(' / ') }}</span>
              <span class="truncate text-[11px] font-semibold text-white/40">{{ candidate.product.sku }}</span>
            </span>
            <span class="mt-1 line-clamp-2 block text-sm font-extrabold leading-5">{{ candidate.product.name }}</span>
            <span class="mt-1 line-clamp-1 block text-xs font-semibold text-white/45">{{ candidate.groupCodes.join('、') }}</span>
          </span>
        </button>
      </div>

      <div v-else class="border border-white/10 bg-white/6 p-5 text-center text-sm font-semibold leading-6 text-white/55">
        {{ store.hasSelection ? '没有找到下一件可继续适配的产品。' : '没有找到匹配产品。' }}
      </div>
    </div>

    <div v-if="!store.hasSelection" class="border-t border-white/10 px-4 py-3">
      <div class="flex items-center justify-between gap-3">
        <button
          type="button"
          class="h-9 border border-white/12 px-3 text-xs font-extrabold text-white/70 transition hover:border-safety-500 hover:text-safety-500 disabled:cursor-not-allowed disabled:opacity-40"
          :disabled="store.productPage <= 1 || store.isProductLoading"
          @click="store.setProductPage(store.productPage - 1)"
        >
          上一页
        </button>
        <span class="text-xs font-bold text-white/45">{{ store.productPage }} / {{ store.productTotalPages }}</span>
        <button
          type="button"
          class="h-9 border border-white/12 px-3 text-xs font-extrabold text-white/70 transition hover:border-safety-500 hover:text-safety-500 disabled:cursor-not-allowed disabled:opacity-40"
          :disabled="store.productPage >= store.productTotalPages || store.isProductLoading"
          @click="store.setProductPage(store.productPage + 1)"
        >
          下一页
        </button>
      </div>
    </div>
  </aside>
</template>

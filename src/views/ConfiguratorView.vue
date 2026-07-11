<script setup lang="ts">
import FitmentCanvas from '../components/FitmentCanvas.vue'
import ProductSelectorPanel from '../components/ProductSelectorPanel.vue'
import { navigateTo } from '../router'
import { directusBaseUrl } from '../services/directus'
import { useConfiguratorStore } from '../stores/configurator'
import type { FitmentGroup, ProductSummary } from '../types/product'

const store = useConfiguratorStore()

function productInitials(product: ProductSummary): string {
  return (product.sku || product.name).slice(0, 2).toUpperCase()
}

function groupCategoryLabels(group: FitmentGroup): string[] {
  return [...new Set(group.items.map((item) => item.categoryLabel))]
}
</script>

<template>
  <main class="bg-iron-50 text-iron-950 lg:h-screen lg:overflow-hidden">
    <section class="grid min-h-screen lg:h-screen lg:min-h-0 lg:grid-cols-[380px_minmax(0,1fr)]">
      <ProductSelectorPanel />

      <section class="flex min-h-0 min-w-0 flex-col bg-iron-50 lg:h-screen lg:overflow-hidden">
        <header class="shrink-0 border-b border-iron-700/10 bg-white px-4 py-3">
          <div class="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div class="min-w-0">
              <p class="text-[11px] font-extrabold uppercase tracking-[0.2em] text-safety-600">Exhibition Configurator</p>
              <h1 class="mt-1 text-2xl font-extrabold text-iron-950">产品适配组选配</h1>
              <p class="mt-1 max-w-3xl text-sm font-semibold leading-6 text-iron-700/65">
                数据实时来自 Directus API，根据已选产品共同所属的适配组继续推荐可组合产品。
              </p>
            </div>

            <div class="flex flex-wrap items-center gap-2">
              <button type="button" class="tool-button bg-white" @click="store.loadDataSourceStatus">刷新数据</button>
              <button type="button" class="tool-button bg-iron-950 text-white hover:bg-iron-800" @click="navigateTo('data')">数据源</button>
            </div>
          </div>

          <div class="mt-3 flex flex-wrap items-center gap-2">
            <span class="metric-chip">产品 {{ store.dataSourceStatus.products }}</span>
            <span class="metric-chip">分类 {{ store.dataSourceStatus.categories }}</span>
            <span class="metric-chip">适配组 {{ store.dataSourceStatus.fitmentGroups }}</span>
            <span class="metric-chip max-w-full truncate">Directus {{ directusBaseUrl }}</span>
          </div>
        </header>

        <div class="min-h-0 flex-1 overflow-hidden p-4">
          <div class="flex h-full min-h-0 flex-col gap-3">
            <div v-if="store.dataSourceError" class="shrink-0 border border-red-300 bg-red-50 p-3 text-sm font-semibold leading-6 text-red-800">
              {{ store.dataSourceError }}
            </div>

            <section class="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_400px]">
              <div class="min-h-0">
                <FitmentCanvas
                  :products="store.selectedProducts"
                  :selection-code="store.selectionCode"
                  :fitment-group-count="store.commonFitmentGroups.length"
                  :fitment-summary="store.fitmentSummary"
                  @remove-products="store.removeSelectedProducts"
                />
              </div>

              <aside class="flex min-h-0 flex-col border border-iron-700/10 bg-white">
                <section class="shrink-0 border-b border-iron-700/10 p-4">
                  <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0">
                      <p class="text-[11px] font-extrabold uppercase tracking-[0.18em] text-safety-600">Inspector</p>
                      <h2 class="mt-1 text-xl font-extrabold">选配状态</h2>
                      <p class="mt-2 line-clamp-2 text-sm font-semibold leading-6 text-iron-700/70">
                        {{ store.fitmentSummary }}
                      </p>
                    </div>
                    <button
                      v-if="store.hasSelection"
                      type="button"
                      class="tool-button shrink-0"
                      @click="store.resetSelection"
                    >
                      重新选择
                    </button>
                  </div>

                  <div class="mt-4 grid grid-cols-3 gap-2 text-sm">
                    <div class="border border-iron-700/10 bg-iron-50 p-2">
                      <p class="text-[11px] font-bold text-iron-700/50">已选</p>
                      <p class="mt-1 text-lg font-extrabold">{{ store.selectedProductIds.length }}</p>
                    </div>
                    <div class="border border-iron-700/10 bg-iron-50 p-2">
                      <p class="text-[11px] font-bold text-iron-700/50">适配组</p>
                      <p class="mt-1 text-lg font-extrabold">{{ store.commonFitmentGroups.length }}</p>
                    </div>
                    <div class="border border-iron-700/10 bg-iron-50 p-2">
                      <p class="text-[11px] font-bold text-iron-700/50">候选</p>
                      <p class="mt-1 text-lg font-extrabold">{{ store.candidateProducts.length }}</p>
                    </div>
                  </div>
                </section>

              <div class="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
                <section>
                  <div class="flex items-center justify-between gap-3">
                    <div>
                      <p class="text-[11px] font-extrabold uppercase tracking-[0.18em] text-safety-600">Current Selection</p>
                      <h3 class="mt-1 text-base font-extrabold">当前选配</h3>
                    </div>
                    <span class="text-xs font-bold text-iron-700/50">{{ store.activeCategory?.label ?? '全部分类' }}</span>
                  </div>

                  <div v-if="store.selectedProducts.length > 0" class="mt-3 space-y-2">
                    <article
                      v-for="(product, index) in store.selectedProducts"
                      :key="product.id"
                      class="grid grid-cols-[48px_minmax(0,1fr)_auto] gap-3 border border-iron-700/10 bg-iron-50 p-2"
                    >
                      <img
                        v-if="product.imageUrl"
                        :src="product.imageUrl"
                        :alt="product.name"
                        class="h-12 w-12 border border-iron-700/10 object-cover"
                        loading="lazy"
                      >
                      <span v-else class="grid h-12 w-12 place-items-center border border-iron-700/10 bg-white text-xs font-extrabold text-iron-700">
                        {{ productInitials(product) }}
                      </span>
                      <div class="min-w-0">
                        <div class="flex min-w-0 items-center gap-2">
                          <span class="shrink-0 bg-safety-100 px-1.5 py-0.5 text-[10px] font-extrabold text-safety-600">第 {{ index + 1 }} 件</span>
                          <span class="truncate text-xs font-bold text-iron-700/55">{{ product.sku }}</span>
                        </div>
                        <p class="mt-1 line-clamp-2 text-sm font-extrabold leading-5">{{ product.name }}</p>
                      </div>
                      <button
                        type="button"
                        class="h-9 self-center border border-iron-700/15 bg-white px-2 text-xs font-extrabold transition hover:border-safety-500 hover:bg-safety-100"
                        @click="store.removeSelectedProduct(product.id)"
                      >
                        移除
                      </button>
                    </article>
                  </div>

                  <div v-else class="mt-3 border border-dashed border-iron-700/20 bg-iron-50 p-5 text-center text-sm font-semibold leading-6 text-iron-700/60">
                    从左侧开始选择产品。
                  </div>
                </section>

                <section>
                  <div class="flex items-center justify-between gap-3">
                    <div>
                      <p class="text-[11px] font-extrabold uppercase tracking-[0.18em] text-safety-600">Fitment Groups</p>
                      <h3 class="mt-1 text-base font-extrabold">共同适配组</h3>
                    </div>
                    <span class="text-xs font-bold text-iron-700/50">{{ store.commonFitmentGroups.length }} 个命中</span>
                  </div>

                  <div v-if="store.isFitmentLoading" class="mt-3 space-y-2">
                    <div v-for="index in 3" :key="index" class="h-28 animate-pulse border border-iron-700/10 bg-iron-50" />
                  </div>

                  <div v-else-if="store.commonFitmentGroups.length > 0" class="mt-3 space-y-2">
                    <article
                      v-for="group in store.commonFitmentGroups"
                      :key="group.id"
                      class="border border-iron-700/10 bg-iron-50 p-3"
                    >
                      <div class="flex flex-wrap items-center gap-2">
                        <span class="bg-safety-100 px-2 py-1 text-xs font-extrabold text-safety-600">{{ group.code }}</span>
                        <span class="bg-white px-2 py-1 text-xs font-bold text-iron-700/60">{{ group.items.length }} 个产品</span>
                      </div>
                      <h4 class="mt-2 line-clamp-1 text-sm font-extrabold">{{ group.name }}</h4>
                      <p v-if="group.description" class="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-iron-700/60">
                        {{ group.description }}
                      </p>
                      <div class="mt-2 flex flex-wrap gap-1">
                          <span
                          v-for="category in groupCategoryLabels(group)"
                          :key="category"
                          class="border border-iron-700/10 bg-white px-2 py-1 text-[11px] font-bold text-iron-700/65"
                        >
                          {{ category }}
                        </span>
                      </div>
                    </article>
                  </div>

                  <div v-else class="mt-3 border border-dashed border-iron-700/20 bg-iron-50 p-5 text-center text-sm font-semibold leading-6 text-iron-700/60">
                    {{ store.hasSelection ? '当前已选产品没有共同适配组。' : '选择产品后显示共同适配组。' }}
                  </div>
                </section>

                <section>
                  <div class="flex items-center justify-between gap-3">
                    <div>
                      <p class="text-[11px] font-extrabold uppercase tracking-[0.18em] text-safety-600">Next Candidates</p>
                      <h3 class="mt-1 text-base font-extrabold">候选产品</h3>
                    </div>
                    <span class="text-xs font-bold text-iron-700/50">{{ store.candidateProducts.length }}</span>
                  </div>

                  <div v-if="store.hasSelection && store.candidateProducts.length > 0" class="mt-3 space-y-2">
                    <button
                      v-for="candidate in store.candidateProducts.slice(0, 8)"
                      :key="candidate.product.id"
                      type="button"
                      class="grid w-full grid-cols-[46px_minmax(0,1fr)] gap-3 border border-iron-700/10 bg-iron-50 p-2 text-left transition hover:border-safety-500 hover:bg-safety-100/50"
                      @click="store.selectProduct(candidate.product.id)"
                    >
                      <img
                        v-if="candidate.product.imageUrl"
                        :src="candidate.product.imageUrl"
                        :alt="candidate.product.name"
                        class="h-[46px] w-[46px] border border-iron-700/10 object-cover"
                        loading="lazy"
                      >
                      <span v-else class="grid h-[46px] w-[46px] place-items-center border border-iron-700/10 bg-white text-xs font-extrabold text-iron-700">
                        {{ productInitials(candidate.product) }}
                      </span>
                      <span class="min-w-0">
                        <span class="flex min-w-0 flex-wrap items-center gap-2">
                          <span class="text-xs font-bold text-safety-600">{{ candidate.categoryLabels.join(' / ') }}</span>
                          <span class="truncate text-[11px] font-semibold text-iron-700/50">{{ candidate.product.sku }}</span>
                        </span>
                        <span class="mt-1 line-clamp-2 block text-sm font-extrabold leading-5">{{ candidate.product.name }}</span>
                      </span>
                    </button>
                  </div>

                  <p v-else class="mt-3 border border-dashed border-iron-700/20 bg-iron-50 p-5 text-sm font-semibold leading-6 text-iron-700/60">
                    {{ store.hasSelection ? '没有更多候选。' : '选择产品后显示候选。' }}
                  </p>
                </section>

                <section class="border border-iron-700/10 bg-iron-50 p-3">
                  <p class="text-[11px] font-extrabold uppercase tracking-[0.18em] text-safety-600">Selection Code</p>
                  <p class="mt-2 break-words text-sm font-extrabold leading-5">{{ store.selectionCode }}</p>
                </section>
              </div>
              </aside>
            </section>
          </div>
        </div>
      </section>
    </section>
  </main>
</template>

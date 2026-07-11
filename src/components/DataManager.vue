<script setup lang="ts">
import { directusBaseUrl } from '../services/directus'
import { useConfiguratorStore } from '../stores/configurator'

const store = useConfiguratorStore()
</script>

<template>
  <section class="min-h-screen bg-iron-950 p-6 text-white">
    <div class="mx-auto max-w-6xl">
      <header class="border-b border-white/10 pb-5">
        <p class="text-[11px] font-extrabold uppercase tracking-[0.22em] text-safety-500">Directus API</p>
        <h1 class="mt-2 text-3xl font-extrabold">数据源状态</h1>
        <p class="mt-2 max-w-3xl text-sm font-semibold leading-6 text-white/65">
          前端直接读取 Directus REST API，不再导入 SQLite、JSON 或本地数据包。
        </p>
      </header>

      <div class="mt-6 grid gap-5 lg:grid-cols-[1fr_360px]">
        <div class="space-y-5">
          <section class="border border-white/10 bg-white/6 p-6">
            <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <p class="text-2xl font-extrabold">连接信息</p>
                <p class="mt-2 break-all text-sm font-semibold leading-6 text-white/60">{{ directusBaseUrl }}</p>
              </div>
              <button
                type="button"
                class="bg-safety-500 px-5 py-3 text-sm font-extrabold text-iron-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="store.isDataSourceLoading"
                @click="store.loadDataSourceStatus"
              >
                {{ store.isDataSourceLoading ? '刷新中' : '刷新状态' }}
              </button>
            </div>

            <div v-if="store.dataSourceError" class="mt-5 border border-red-300/40 bg-red-500/10 p-4 text-sm font-semibold leading-6 text-red-100">
              {{ store.dataSourceError }}
            </div>
          </section>

          <section class="border border-white/10 bg-white/6 p-6">
            <p class="text-2xl font-extrabold">Directus 集合</p>
            <div class="mt-4 grid gap-3 text-sm font-semibold leading-6 text-white/68 md:grid-cols-2">
              <div class="border border-white/10 bg-iron-950/45 p-4">
                <p class="font-extrabold text-white">products</p>
                <p class="mt-1">产品主体：SKU、原始名称、OEM、重量、分类和主图。</p>
              </div>
              <div class="border border-white/10 bg-iron-950/45 p-4">
                <p class="font-extrabold text-white">categories</p>
                <p class="mt-1">产品分类：斗齿、齿座、边刀、斗齿销等。</p>
              </div>
              <div class="border border-white/10 bg-iron-950/45 p-4">
                <p class="font-extrabold text-white">product_fitment_groups</p>
                <p class="mt-1">适配组：一个可共同组合的产品集合。</p>
              </div>
              <div class="border border-white/10 bg-iron-950/45 p-4">
                <p class="font-extrabold text-white">product_fitment_group_items</p>
                <p class="mt-1">适配组成员：只保存产品归属，类别语义来自产品分类。</p>
              </div>
              <div class="border border-white/10 bg-iron-950/45 p-4">
                <p class="font-extrabold text-white">directus_files</p>
                <p class="mt-1">图片资源通过 `/assets/:id` 动态读取。</p>
              </div>
            </div>
          </section>
        </div>

        <aside class="border border-white/10 bg-white/8 p-5">
          <p class="text-xs font-extrabold uppercase tracking-[0.16em] text-safety-500">实时统计</p>
          <dl class="mt-4 space-y-4 text-sm">
            <div>
              <dt class="font-bold text-white/45">产品</dt>
              <dd class="mt-1 text-2xl font-extrabold">{{ store.dataSourceStatus.products }}</dd>
            </div>
            <div>
              <dt class="font-bold text-white/45">分类</dt>
              <dd class="mt-1 text-2xl font-extrabold">{{ store.dataSourceStatus.categories }}</dd>
            </div>
            <div>
              <dt class="font-bold text-white/45">适配组</dt>
              <dd class="mt-1 text-2xl font-extrabold">{{ store.dataSourceStatus.fitmentGroups }}</dd>
            </div>
            <div>
              <dt class="font-bold text-white/45">状态</dt>
              <dd class="mt-1 font-semibold text-white/75">{{ store.isBusy ? '读取中' : '已就绪' }}</dd>
            </div>
          </dl>

          <div class="mt-6 border-l-4 border-safety-500 bg-white/8 p-4 text-sm font-semibold leading-6 text-white/72">
            当前筛选、分页和已选产品会同步到 URL 便于刷新与分享；画布位置、缩放和旋转保存在浏览器本地。业务数据始终来自 Directus。
          </div>
        </aside>
      </div>
    </div>
  </section>
</template>

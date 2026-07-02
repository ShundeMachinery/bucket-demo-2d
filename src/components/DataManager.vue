<script setup lang="ts">
import { ref } from 'vue'
import { useConfiguratorStore } from '../stores/configurator'
import {
  createDataPackageFromFolder,
  downloadDataPackageZip,
  readJsonFile,
} from '../services/dataPackageDb'

const store = useConfiguratorStore()
const message = ref('导入客户数据，或导出一个包含图片文件与全部校准的 ZIP 数据包。')
const isBusy = ref(false)
const showAdvanced = ref(false)

async function importJson(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  isBusy.value = true
  message.value = '正在导入 JSON...'
  try {
    await store.importDataPackage(await readJsonFile(file))
    message.value = `已导入：${file.name}`
  } catch (error) {
    message.value = error instanceof Error ? error.message : '导入 JSON 失败'
  } finally {
    isBusy.value = false
    input.value = ''
  }
}

async function importFolder(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  if (!files.length) return

  isBusy.value = true
  message.value = '正在导入文件夹并内嵌图片...'
  try {
    await store.importDataPackage(await createDataPackageFromFolder(files))
    message.value = '已导入文件夹，图片已写入数据包。'
  } catch (error) {
    message.value = error instanceof Error ? error.message : '导入文件夹失败'
  } finally {
    isBusy.value = false
    input.value = ''
  }
}

async function exportPackage() {
  isBusy.value = true
  message.value = '正在打包 ZIP，包含图片和数据...'
  try {
    await downloadDataPackageZip(store.getCurrentDataPackage())
    message.value = '已导出 ZIP 数据包，里面包含 JSON 和图片文件。'
  } catch (error) {
    message.value = error instanceof Error ? error.message : '导出失败'
  } finally {
    isBusy.value = false
  }
}

async function resetMock() {
  isBusy.value = true
  try {
    await store.resetToMockDataPackage()
    message.value = '已恢复为内置 mock 数据包。'
  } finally {
    isBusy.value = false
  }
}
</script>

<template>
  <section class="min-h-screen bg-iron-950 p-6 text-white">
    <div class="mx-auto max-w-5xl">
      <header class="border-b border-white/10 pb-5">
        <p class="text-[11px] font-extrabold uppercase tracking-[0.22em] text-safety-500">Data Package</p>
        <h1 class="mt-2 text-3xl font-extrabold">数据包管理</h1>
        <p class="mt-2 max-w-3xl text-sm font-semibold leading-6 text-white/65">
          一个 ZIP 数据包包含：产品图片文件、描述、参数、兼容关系、每个组合的位置和透视校准。
        </p>
      </header>

      <div class="mt-6 grid gap-5 lg:grid-cols-[1fr_320px]">
        <div class="space-y-4">
          <div class="border border-white/10 bg-white/6 p-5">
            <p class="text-xl font-extrabold">导入数据</p>
            <p class="mt-2 text-sm leading-6 text-white/60">选择一个 JSON 数据包，或选择 ZIP 解压后的完整文件夹。</p>
            <div class="mt-5 grid gap-3 sm:grid-cols-2">
              <label class="block cursor-pointer bg-white px-5 py-4 text-center font-extrabold text-iron-950 transition hover:bg-safety-500">
                导入 JSON
                <input class="hidden" type="file" accept="application/json,.json" :disabled="isBusy" @change="importJson" />
              </label>
              <label class="block cursor-pointer border border-white/15 px-5 py-4 text-center font-extrabold text-white transition hover:border-safety-500 hover:text-safety-500">
                导入文件夹
                <input class="hidden" type="file" webkitdirectory directory multiple :disabled="isBusy" @change="importFolder" />
              </label>
            </div>
          </div>

          <button
            type="button"
            class="block w-full bg-safety-500 p-6 text-left text-iron-950 transition hover:bg-safety-100 disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="isBusy"
            @click="exportPackage"
          >
            <p class="text-2xl font-extrabold">导出 ZIP 数据包</p>
            <p class="mt-2 text-sm font-bold leading-6 text-iron-800">ZIP 内含 data-package.json、图片文件和全部组合校准，可解压后整文件夹导入。</p>
          </button>

          <div class="border border-white/10">
            <button type="button" class="w-full px-5 py-3 text-left text-sm font-extrabold text-white/70" @click="showAdvanced = !showAdvanced">
              {{ showAdvanced ? '收起高级操作' : '高级操作' }}
            </button>
            <div v-if="showAdvanced" class="border-t border-white/10 p-5">
              <button type="button" class="border border-white/15 px-4 py-3 text-sm font-extrabold text-white/75 hover:border-safety-500 hover:text-safety-500" :disabled="isBusy" @click="resetMock">
                恢复内置 mock 数据
              </button>
            </div>
          </div>
        </div>

        <aside class="border border-white/10 bg-white/8 p-5">
          <p class="text-xs font-extrabold uppercase tracking-[0.16em] text-safety-500">当前数据</p>
          <dl class="mt-4 space-y-4 text-sm">
            <div>
              <dt class="font-bold text-white/45">名称</dt>
              <dd class="mt-1 font-extrabold">{{ store.dataPackageName }}</dd>
            </div>
            <div>
              <dt class="font-bold text-white/45">产品</dt>
              <dd class="mt-1 font-semibold text-white/75">主机 {{ store.excavators.length }} / 挖斗 {{ store.buckets.length }} / 斗齿 {{ store.teeth.length }}</dd>
            </div>
            <div>
              <dt class="font-bold text-white/45">组合校准</dt>
              <dd class="mt-1 font-semibold text-white/75">{{ Object.keys(store.combinationLayouts).length }} 组</dd>
            </div>
            <div>
              <dt class="font-bold text-white/45">保存状态</dt>
              <dd class="mt-1 font-semibold text-white/75">{{ store.isDataPackageSaving ? '保存中' : '已就绪' }}</dd>
            </div>
          </dl>

          <div class="mt-6 border-l-4 border-safety-500 bg-white/8 p-4 text-sm font-semibold leading-6 text-white/72">
            {{ message }}
          </div>
        </aside>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useConfiguratorStore, type HighlightPart } from '../stores/configurator'
import {
  createDataPackageFromFolder,
  downloadDataPackageZip,
  readJsonFile,
} from '../services/dataPackageDb'
import type { Bucket, Excavator, ProductPart, Tooth } from '../types/product'

const store = useConfiguratorStore()
const message = ref('导入客户数据，或导出一个包含图片文件与全部校准的 ZIP 数据包。')
const isBusy = ref(false)
const showAdvanced = ref(false)
const productType = ref<HighlightPart>('excavator')
const imageFileName = ref('')
const form = reactive({
  id: '',
  name: '',
  series: '',
  image: '',
  width: 520,
  height: 260,
  anchorX: 640,
  anchorY: 360,
  hotspotX: 640,
  hotspotY: 360,
  hotspotRadius: 32,
  hotspotLabel: '安装点',
  description: '',
  sellingPoints: '',
  notes: '',
  tonnage: '',
  capacity: '',
  material: '',
  compatibleBucketIds: [] as string[],
  compatibleExcavatorIds: [] as string[],
  compatibleToothIds: [] as string[],
})

const typeOptions = [
  { value: 'excavator', label: '挖掘机' },
  { value: 'bucket', label: '挖斗' },
  { value: 'tooth', label: '斗齿' },
] as const

const selectedTypeLabel = computed(() => {
  return typeOptions.find((item) => item.value === productType.value)?.label ?? '产品'
})

function createSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/gi, '-')
    .replace(/^-+|-+$/g, '')
}

function normalizeList(value: string) {
  return value
    .split(/\n|,|，/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function resetForm() {
  form.id = ''
  form.name = ''
  form.series = ''
  form.image = ''
  form.width = productType.value === 'excavator' ? 820 : productType.value === 'bucket' ? 360 : 132
  form.height = productType.value === 'excavator' ? 420 : productType.value === 'bucket' ? 235 : 78
  form.anchorX = productType.value === 'excavator' ? 430 : productType.value === 'bucket' ? 810 : 1012
  form.anchorY = productType.value === 'excavator' ? 470 : productType.value === 'bucket' ? 486 : 552
  form.hotspotX = form.anchorX
  form.hotspotY = form.anchorY
  form.hotspotRadius = productType.value === 'excavator' ? 46 : productType.value === 'bucket' ? 36 : 22
  form.hotspotLabel = productType.value === 'excavator' ? '快换接口' : productType.value === 'bucket' ? '齿座' : '齿尖'
  form.description = ''
  form.sellingPoints = ''
  form.notes = ''
  form.tonnage = ''
  form.capacity = ''
  form.material = ''
  form.compatibleBucketIds = []
  form.compatibleExcavatorIds = []
  form.compatibleToothIds = []
  imageFileName.value = ''
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error)
    reader.onload = () => resolve(String(reader.result))
    reader.readAsDataURL(file)
  })
}

async function handleImageUpload(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  form.image = await fileToDataUrl(file)
  imageFileName.value = file.name
  input.value = ''
}

function baseProduct(): ProductPart {
  const id = form.id.trim() || `${productType.value}-${createSlug(form.name) || Date.now()}`

  if (!form.name.trim()) {
    throw new Error('请填写产品名称')
  }

  if (!form.image) {
    throw new Error('请上传产品图片')
  }

  return {
    id,
    name: form.name.trim(),
    series: form.series.trim() || 'Custom Series',
    image: form.image,
    anchor: { x: Number(form.anchorX), y: Number(form.anchorY) },
    hotspot: {
      x: Number(form.hotspotX),
      y: Number(form.hotspotY),
      radius: Number(form.hotspotRadius),
      label: form.hotspotLabel.trim() || '安装点',
    },
    dimensions: {
      width: Number(form.width),
      height: Number(form.height),
    },
    description: form.description.trim() || '自定义录入产品，等待补充详细描述。',
    sellingPoints: normalizeList(form.sellingPoints),
    notes: form.notes.trim() || '自定义产品，请在正式演示前复核尺寸和适配关系。',
  }
}

async function submitProduct() {
  isBusy.value = true
  try {
    const base = baseProduct()

    if (productType.value === 'excavator') {
      if (!form.compatibleBucketIds.length) {
        throw new Error('请至少选择一个兼容挖斗')
      }
      await store.addExcavator({
        ...base,
        tonnage: form.tonnage.trim() || '未填写',
        compatibleBucketIds: [...form.compatibleBucketIds],
      } as Excavator)
    }

    if (productType.value === 'bucket') {
      if (!form.compatibleExcavatorIds.length) {
        throw new Error('请至少选择一个兼容挖掘机')
      }
      if (!form.compatibleToothIds.length) {
        throw new Error('请至少选择一个兼容斗齿')
      }
      await store.addBucket({
        ...base,
        capacity: form.capacity.trim() || '未填写',
        compatibleExcavatorIds: [...form.compatibleExcavatorIds],
        compatibleToothIds: [...form.compatibleToothIds],
        mountOffset: { x: 0, y: 0 },
      } as Bucket)
    }

    if (productType.value === 'tooth') {
      if (!form.compatibleBucketIds.length) {
        throw new Error('请至少选择一个兼容挖斗')
      }
      await store.addTooth({
        ...base,
        material: form.material.trim() || '未填写',
        compatibleBucketIds: [...form.compatibleBucketIds],
        mountOffset: { x: 0, y: 0 },
      } as Tooth)
    }

    message.value = `已新增${selectedTypeLabel.value}：${base.name}`
    resetForm()
  } catch (error) {
    message.value = error instanceof Error ? error.message : '新增产品失败'
  } finally {
    isBusy.value = false
  }
}

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
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p class="text-xl font-extrabold">新增产品</p>
                <p class="mt-2 text-sm leading-6 text-white/60">上传透明 PNG/SVG，填写字段和兼容关系，提交后自动保存进当前数据包。</p>
              </div>
              <div class="flex border border-white/10 bg-iron-950/60 p-1">
                <button
                  v-for="option in typeOptions"
                  :key="option.value"
                  type="button"
                  class="px-3 py-2 text-xs font-extrabold transition"
                  :class="productType === option.value ? 'bg-safety-500 text-iron-950' : 'text-white/65 hover:text-white'"
                  @click="productType = option.value; resetForm()"
                >
                  {{ option.label }}
                </button>
              </div>
            </div>

            <div class="mt-5 grid gap-3 sm:grid-cols-2">
              <label class="block">
                <span class="text-xs font-extrabold text-white/55">ID</span>
                <input v-model="form.id" class="mt-1 w-full border border-white/10 bg-iron-950/70 px-3 py-2 text-sm font-semibold outline-none focus:border-safety-500" placeholder="留空自动生成" />
              </label>
              <label class="block">
                <span class="text-xs font-extrabold text-white/55">名称</span>
                <input v-model="form.name" class="mt-1 w-full border border-white/10 bg-iron-950/70 px-3 py-2 text-sm font-semibold outline-none focus:border-safety-500" placeholder="例如 HX520 展示主机" />
              </label>
              <label class="block">
                <span class="text-xs font-extrabold text-white/55">系列</span>
                <input v-model="form.series" class="mt-1 w-full border border-white/10 bg-iron-950/70 px-3 py-2 text-sm font-semibold outline-none focus:border-safety-500" placeholder="Custom Series" />
              </label>
              <label v-if="productType === 'excavator'" class="block">
                <span class="text-xs font-extrabold text-white/55">吨位</span>
                <input v-model="form.tonnage" class="mt-1 w-full border border-white/10 bg-iron-950/70 px-3 py-2 text-sm font-semibold outline-none focus:border-safety-500" placeholder="36 t" />
              </label>
              <label v-if="productType === 'bucket'" class="block">
                <span class="text-xs font-extrabold text-white/55">斗容</span>
                <input v-model="form.capacity" class="mt-1 w-full border border-white/10 bg-iron-950/70 px-3 py-2 text-sm font-semibold outline-none focus:border-safety-500" placeholder="1.8 m3" />
              </label>
              <label v-if="productType === 'tooth'" class="block">
                <span class="text-xs font-extrabold text-white/55">材质</span>
                <input v-model="form.material" class="mt-1 w-full border border-white/10 bg-iron-950/70 px-3 py-2 text-sm font-semibold outline-none focus:border-safety-500" placeholder="高韧性耐磨合金" />
              </label>
            </div>

            <div class="mt-4 grid gap-3 sm:grid-cols-3">
              <label class="block cursor-pointer border border-white/15 bg-white/8 px-4 py-4 text-center text-sm font-extrabold transition hover:border-safety-500 hover:text-safety-500">
                上传图片
                <input class="hidden" type="file" accept="image/*,.svg" :disabled="isBusy" @change="handleImageUpload" />
              </label>
              <div class="sm:col-span-2 border border-white/10 bg-iron-950/50 px-4 py-3 text-sm font-semibold text-white/65">
                {{ imageFileName || '建议使用透明 PNG 或 SVG，占位图会随 ZIP 一起导出。' }}
              </div>
            </div>

            <div class="mt-4 grid gap-3 sm:grid-cols-4">
              <label class="block">
                <span class="text-xs font-extrabold text-white/55">宽</span>
                <input v-model.number="form.width" type="number" class="mt-1 w-full border border-white/10 bg-iron-950/70 px-3 py-2 text-sm font-semibold outline-none focus:border-safety-500" />
              </label>
              <label class="block">
                <span class="text-xs font-extrabold text-white/55">高</span>
                <input v-model.number="form.height" type="number" class="mt-1 w-full border border-white/10 bg-iron-950/70 px-3 py-2 text-sm font-semibold outline-none focus:border-safety-500" />
              </label>
              <label class="block">
                <span class="text-xs font-extrabold text-white/55">锚点 X</span>
                <input v-model.number="form.anchorX" type="number" class="mt-1 w-full border border-white/10 bg-iron-950/70 px-3 py-2 text-sm font-semibold outline-none focus:border-safety-500" />
              </label>
              <label class="block">
                <span class="text-xs font-extrabold text-white/55">锚点 Y</span>
                <input v-model.number="form.anchorY" type="number" class="mt-1 w-full border border-white/10 bg-iron-950/70 px-3 py-2 text-sm font-semibold outline-none focus:border-safety-500" />
              </label>
            </div>

            <div class="mt-4 grid gap-3 sm:grid-cols-3">
              <label class="block">
                <span class="text-xs font-extrabold text-white/55">描述</span>
                <textarea v-model="form.description" rows="3" class="mt-1 w-full border border-white/10 bg-iron-950/70 px-3 py-2 text-sm font-semibold outline-none focus:border-safety-500" />
              </label>
              <label class="block">
                <span class="text-xs font-extrabold text-white/55">卖点，每行一个</span>
                <textarea v-model="form.sellingPoints" rows="3" class="mt-1 w-full border border-white/10 bg-iron-950/70 px-3 py-2 text-sm font-semibold outline-none focus:border-safety-500" />
              </label>
              <label class="block">
                <span class="text-xs font-extrabold text-white/55">备注</span>
                <textarea v-model="form.notes" rows="3" class="mt-1 w-full border border-white/10 bg-iron-950/70 px-3 py-2 text-sm font-semibold outline-none focus:border-safety-500" />
              </label>
            </div>

            <div class="mt-4 grid gap-4 sm:grid-cols-2">
              <div v-if="productType === 'excavator' || productType === 'tooth'" class="border border-white/10 p-3">
                <p class="text-xs font-extrabold text-white/55">兼容挖斗</p>
                <label v-for="bucket in store.buckets" :key="bucket.id" class="mt-2 flex items-center gap-2 text-sm font-semibold text-white/75">
                  <input v-model="form.compatibleBucketIds" class="accent-safety-500" type="checkbox" :value="bucket.id" />
                  {{ bucket.name }}
                </label>
              </div>

              <div v-if="productType === 'bucket'" class="border border-white/10 p-3">
                <p class="text-xs font-extrabold text-white/55">兼容挖掘机</p>
                <label v-for="excavator in store.excavators" :key="excavator.id" class="mt-2 flex items-center gap-2 text-sm font-semibold text-white/75">
                  <input v-model="form.compatibleExcavatorIds" class="accent-safety-500" type="checkbox" :value="excavator.id" />
                  {{ excavator.name }}
                </label>
              </div>

              <div v-if="productType === 'bucket'" class="border border-white/10 p-3">
                <p class="text-xs font-extrabold text-white/55">兼容斗齿</p>
                <label v-for="tooth in store.teeth" :key="tooth.id" class="mt-2 flex items-center gap-2 text-sm font-semibold text-white/75">
                  <input v-model="form.compatibleToothIds" class="accent-safety-500" type="checkbox" :value="tooth.id" />
                  {{ tooth.name }}
                </label>
              </div>
            </div>

            <button type="button" class="mt-5 w-full bg-white px-5 py-4 text-left font-extrabold text-iron-950 transition hover:bg-safety-500 disabled:cursor-not-allowed disabled:opacity-60" :disabled="isBusy" @click="submitProduct">
              添加{{ selectedTypeLabel }}并保存
            </button>
          </div>

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

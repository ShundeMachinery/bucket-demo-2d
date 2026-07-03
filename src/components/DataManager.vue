<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useConfiguratorStore, type HighlightPart } from '../stores/configurator'
import {
  clearDataManagerDraft,
  cloneSerializable,
  createDataPackageFromFolder,
  createDataPackageFromZip,
  downloadDataPackageZip,
  getDataManagerDraft,
  readJsonFile,
  saveDataManagerDraft,
} from '../services/dataPackageDb'
import type { Bucket, Excavator, ProductPart, Tooth } from '../types/product'

const store = useConfiguratorStore()
const message = ref('导入客户数据，或导出一个包含图片文件与全部校准的 ZIP 数据包；ZIP 可直接导入，不需要解压。')
const isBusy = ref(false)
const showAdvanced = ref(false)
const productType = ref<HighlightPart>('excavator')
const imageFileName = ref('')
const editTargetId = ref('')

type ProductFormState = {
  id: string
  name: string
  series: string
  image: string
  width: number
  height: number
  anchorX: number
  anchorY: number
  hotspotX: number
  hotspotY: number
  hotspotRadius: number
  hotspotLabel: string
  mountOffsetX: number
  mountOffsetY: number
  description: string
  sellingPoints: string
  notes: string
  tonnage: string
  capacity: string
  material: string
  compatibleBucketIds: string[]
  compatibleExcavatorIds: string[]
  compatibleToothIds: string[]
}

type DataManagerDraft = {
  productType: HighlightPart
  editTargetId: string
  imageFileName: string
  showAdvanced: boolean
  message: string
  form: ProductFormState
}

const form = reactive<ProductFormState>({
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
  mountOffsetX: 0,
  mountOffsetY: 0,
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
const isDraftReady = ref(false)
let draftSaveTimer: ReturnType<typeof window.setTimeout> | undefined

const typeOptions = [
  { value: 'excavator', label: '挖掘机' },
  { value: 'bucket', label: '挖斗' },
  { value: 'tooth', label: '斗齿' },
] as const

const selectedTypeLabel = computed(() => {
  return typeOptions.find((item) => item.value === productType.value)?.label ?? '产品'
})

const editableProducts = computed(() => {
  if (productType.value === 'excavator') return store.excavators
  if (productType.value === 'bucket') return store.buckets

  return store.teeth
})

const isEditing = computed(() => {
  return Boolean(editTargetId.value && editableProducts.value.some((item) => item.id === editTargetId.value))
})

const editingProductName = computed(() => {
  return editableProducts.value.find((item) => item.id === editTargetId.value)?.name ?? ''
})

const submitButtonText = computed(() => {
  return isEditing.value ? `覆盖保存${selectedTypeLabel.value}` : `添加${selectedTypeLabel.value}并保存`
})

function isProductType(value: unknown): value is HighlightPart {
  return value === 'excavator' || value === 'bucket' || value === 'tooth'
}

function formSnapshot(): ProductFormState {
  return {
    ...form,
    compatibleBucketIds: [...form.compatibleBucketIds],
    compatibleExcavatorIds: [...form.compatibleExcavatorIds],
    compatibleToothIds: [...form.compatibleToothIds],
  }
}

function currentDraft(): DataManagerDraft {
  return {
    productType: productType.value,
    editTargetId: editTargetId.value,
    imageFileName: imageFileName.value,
    showAdvanced: showAdvanced.value,
    message: message.value,
    form: formSnapshot(),
  }
}

function applyDraft(draft: DataManagerDraft) {
  if (isProductType(draft.productType)) {
    productType.value = draft.productType
  }

  imageFileName.value = draft.imageFileName || ''
  editTargetId.value = typeof draft.editTargetId === 'string' ? draft.editTargetId : ''
  showAdvanced.value = Boolean(draft.showAdvanced)
  message.value = draft.message || message.value
  Object.assign(form, {
    ...draft.form,
    compatibleBucketIds: Array.isArray(draft.form?.compatibleBucketIds) ? draft.form.compatibleBucketIds : [],
    compatibleExcavatorIds: Array.isArray(draft.form?.compatibleExcavatorIds) ? draft.form.compatibleExcavatorIds : [],
    compatibleToothIds: Array.isArray(draft.form?.compatibleToothIds) ? draft.form.compatibleToothIds : [],
  })
}

function scheduleDraftSave() {
  if (!isDraftReady.value || typeof window === 'undefined') return

  window.clearTimeout(draftSaveTimer)
  draftSaveTimer = window.setTimeout(() => {
    void saveDataManagerDraft(currentDraft())
  }, 220)
}

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

function sellingPointsText(points: string[] | undefined) {
  return Array.isArray(points) ? points.join('\n') : ''
}

function resetForm() {
  editTargetId.value = ''
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
  form.mountOffsetX = 0
  form.mountOffsetY = 0
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

function loadBaseProduct(part: ProductPart) {
  form.id = part.id
  form.name = part.name
  form.series = part.series
  form.image = part.image
  form.width = part.dimensions.width
  form.height = part.dimensions.height
  form.anchorX = part.anchor.x
  form.anchorY = part.anchor.y
  form.hotspotX = part.hotspot.x
  form.hotspotY = part.hotspot.y
  form.hotspotRadius = part.hotspot.radius
  form.hotspotLabel = part.hotspot.label
  form.description = part.description
  form.sellingPoints = sellingPointsText(part.sellingPoints)
  form.notes = part.notes
  form.tonnage = ''
  form.capacity = ''
  form.material = ''
  form.compatibleBucketIds = []
  form.compatibleExcavatorIds = []
  form.compatibleToothIds = []
  form.mountOffsetX = 0
  form.mountOffsetY = 0
  imageFileName.value = part.image.startsWith('data:') ? '已载入当前产品图片，可重新上传覆盖' : part.image
}

function loadProductForEdit(id: string) {
  const product = editableProducts.value.find((item) => item.id === id)
  if (!product) {
    resetForm()
    return
  }

  editTargetId.value = product.id
  loadBaseProduct(cloneSerializable(product))

  if (productType.value === 'excavator') {
    const excavator = product as Excavator
    form.tonnage = excavator.tonnage
    form.compatibleBucketIds = [...excavator.compatibleBucketIds]
  }

  if (productType.value === 'bucket') {
    const bucket = product as Bucket
    form.capacity = bucket.capacity
    form.compatibleExcavatorIds = [...bucket.compatibleExcavatorIds]
    form.compatibleToothIds = [...bucket.compatibleToothIds]
    form.mountOffsetX = bucket.mountOffset.x
    form.mountOffsetY = bucket.mountOffset.y
  }

  if (productType.value === 'tooth') {
    const tooth = product as Tooth
    form.material = tooth.material
    form.compatibleBucketIds = [...tooth.compatibleBucketIds]
    form.mountOffsetX = tooth.mountOffset.x
    form.mountOffsetY = tooth.mountOffset.y
  }

  message.value = `正在编辑${selectedTypeLabel.value}：${product.name}`
}

function switchProductType(type: HighlightPart) {
  productType.value = type
  resetForm()
}

async function resetDraft() {
  resetForm()
  message.value = '已清空新增产品表单草稿。'
  await clearDataManagerDraft()
  scheduleDraftSave()
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
    const modeLabel = isEditing.value ? '已覆盖保存' : '已新增'

    if (productType.value === 'excavator') {
      if (!form.compatibleBucketIds.length) {
        throw new Error('请至少选择一个兼容挖斗')
      }
      const product = {
        ...base,
        tonnage: form.tonnage.trim() || '未填写',
        compatibleBucketIds: [...form.compatibleBucketIds],
      } as Excavator

      if (isEditing.value) {
        await store.updateExcavator(editTargetId.value, product)
      } else {
        await store.addExcavator(product)
      }
    }

    if (productType.value === 'bucket') {
      if (!form.compatibleExcavatorIds.length) {
        throw new Error('请至少选择一个兼容挖掘机')
      }
      if (!form.compatibleToothIds.length) {
        throw new Error('请至少选择一个兼容斗齿')
      }
      const product = {
        ...base,
        capacity: form.capacity.trim() || '未填写',
        compatibleExcavatorIds: [...form.compatibleExcavatorIds],
        compatibleToothIds: [...form.compatibleToothIds],
        mountOffset: { x: Number(form.mountOffsetX), y: Number(form.mountOffsetY) },
      } as Bucket

      if (isEditing.value) {
        await store.updateBucket(editTargetId.value, product)
      } else {
        await store.addBucket(product)
      }
    }

    if (productType.value === 'tooth') {
      if (!form.compatibleBucketIds.length) {
        throw new Error('请至少选择一个兼容挖斗')
      }
      const product = {
        ...base,
        material: form.material.trim() || '未填写',
        compatibleBucketIds: [...form.compatibleBucketIds],
        mountOffset: { x: Number(form.mountOffsetX), y: Number(form.mountOffsetY) },
      } as Tooth

      if (isEditing.value) {
        await store.updateTooth(editTargetId.value, product)
      } else {
        await store.addTooth(product)
      }
    }

    message.value = `${modeLabel}${selectedTypeLabel.value}：${base.name}`
    resetForm()
  } catch (error) {
    message.value = error instanceof Error ? error.message : `${isEditing.value ? '覆盖保存' : '新增产品'}失败`
  } finally {
    isBusy.value = false
  }
}

async function deleteCurrentProduct() {
  if (!isEditing.value) {
    message.value = '请先选择一个已有产品再删除。'
    return
  }

  const targetId = editTargetId.value
  const targetName = editingProductName.value
  const confirmed = window.confirm(`确认删除${selectedTypeLabel.value}「${targetName}」吗？关联的兼容关系和组合校准也会同步清理。`)
  if (!confirmed) return

  isBusy.value = true
  try {
    if (productType.value === 'excavator') {
      await store.deleteExcavator(targetId)
    }

    if (productType.value === 'bucket') {
      await store.deleteBucket(targetId)
    }

    if (productType.value === 'tooth') {
      await store.deleteTooth(targetId)
    }

    resetForm()
    message.value = `已删除${selectedTypeLabel.value}：${targetName}`
  } catch (error) {
    message.value = error instanceof Error ? error.message : '删除产品失败'
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
    resetForm()
    message.value = `已导入：${file.name}`
  } catch (error) {
    message.value = error instanceof Error ? error.message : '导入 JSON 失败'
  } finally {
    isBusy.value = false
    input.value = ''
  }
}

async function importZip(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  isBusy.value = true
  message.value = '正在读取 ZIP 数据包...'
  try {
    await store.importDataPackage(await createDataPackageFromZip(file))
    resetForm()
    showAdvanced.value = false
    message.value = `已导入 ZIP 数据包：${file.name}。图片、产品数据和组合校准已恢复。`
  } catch (error) {
    message.value = error instanceof Error ? error.message : '导入 ZIP 失败'
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
    resetForm()
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
    message.value = '已导出 ZIP 数据包，里面包含 JSON、图片文件和全部组合校准；可直接导入本页面。'
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
    resetForm()
    message.value = '已恢复为内置 mock 数据包。'
  } finally {
    isBusy.value = false
  }
}

onMounted(async () => {
  try {
    const draft = await getDataManagerDraft<DataManagerDraft>()
    if (draft) {
      applyDraft(draft)
    }
  } finally {
    isDraftReady.value = true
  }
})

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.clearTimeout(draftSaveTimer)
  }
})

watch(
  () => ({
    productType: productType.value,
    editTargetId: editTargetId.value,
    imageFileName: imageFileName.value,
    showAdvanced: showAdvanced.value,
    message: message.value,
    form: formSnapshot(),
  }),
  scheduleDraftSave,
  { deep: true },
)
</script>

<template>
  <section class="min-h-screen bg-iron-950 p-6 text-white">
    <div class="mx-auto max-w-5xl">
      <header class="border-b border-white/10 pb-5">
        <p class="text-[11px] font-extrabold uppercase tracking-[0.22em] text-safety-500">Data Package</p>
        <h1 class="mt-2 text-3xl font-extrabold">数据包管理</h1>
        <p class="mt-2 max-w-3xl text-sm font-semibold leading-6 text-white/65">
          一个 ZIP 数据包包含：产品图片文件、描述、参数、兼容关系、每个组合的位置、缩放和旋转校准。导出后可直接导入，无需解压。
        </p>
      </header>

      <div class="mt-6 grid gap-5 lg:grid-cols-[1fr_320px]">
        <div class="space-y-4">
          <div class="border border-white/10 bg-white/6 p-5">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p class="text-xl font-extrabold">新增 / 编辑产品</p>
                <p class="mt-2 text-sm leading-6 text-white/60">选择已有产品可载入全部字段并覆盖保存；也可以直接新增。刷新页面会恢复未提交草稿。</p>
              </div>
              <div class="flex flex-wrap gap-2">
                <div class="flex border border-white/10 bg-iron-950/60 p-1">
                  <button
                    v-for="option in typeOptions"
                    :key="option.value"
                    type="button"
                    class="px-3 py-2 text-xs font-extrabold transition"
                    :class="productType === option.value ? 'bg-safety-500 text-iron-950' : 'text-white/65 hover:text-white'"
                    @click="switchProductType(option.value)"
                  >
                    {{ option.label }}
                  </button>
                </div>
                <button type="button" class="border border-white/15 px-3 py-2 text-xs font-extrabold text-white/65 transition hover:border-safety-500 hover:text-safety-500" :disabled="isBusy" @click="resetDraft">
                  重置表单
                </button>
              </div>
            </div>

            <div class="mt-5 border border-white/10 bg-iron-950/45 p-4">
              <div class="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
                <label class="block">
                  <span class="text-xs font-extrabold text-white/55">编辑已有{{ selectedTypeLabel }}</span>
                  <select
                    v-model="editTargetId"
                    class="mt-1 w-full border border-white/10 bg-iron-950/70 px-3 py-2 text-sm font-semibold outline-none focus:border-safety-500"
                    :disabled="isBusy"
                    @change="loadProductForEdit(editTargetId)"
                  >
                    <option value="">新增模式，不覆盖已有产品</option>
                    <option v-for="product in editableProducts" :key="product.id" :value="product.id">
                      {{ product.name }} / {{ product.id }}
                    </option>
                  </select>
                </label>
                <button
                  type="button"
                  class="self-end border border-white/15 px-4 py-2 text-sm font-extrabold text-white/70 transition hover:border-safety-500 hover:text-safety-500"
                  :disabled="isBusy || !editTargetId"
                  @click="resetForm"
                >
                  退出编辑
                </button>
                <button
                  type="button"
                  class="self-end border border-red-400/35 px-4 py-2 text-sm font-extrabold text-red-200 transition hover:border-red-300 hover:bg-red-500/12 hover:text-red-100 disabled:cursor-not-allowed disabled:opacity-40"
                  :disabled="isBusy || !isEditing"
                  @click="deleteCurrentProduct"
                >
                  删除
                </button>
              </div>
              <p class="mt-3 text-xs font-semibold leading-5" :class="isEditing ? 'text-safety-500' : 'text-white/45'">
                {{ isEditing ? `当前将覆盖：${editingProductName}` : '当前为新增模式，ID 留空会自动生成。' }}
              </p>
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

            <div class="mt-4 grid gap-3 sm:grid-cols-4">
              <label class="block">
                <span class="text-xs font-extrabold text-white/55">热点 X</span>
                <input v-model.number="form.hotspotX" type="number" class="mt-1 w-full border border-white/10 bg-iron-950/70 px-3 py-2 text-sm font-semibold outline-none focus:border-safety-500" />
              </label>
              <label class="block">
                <span class="text-xs font-extrabold text-white/55">热点 Y</span>
                <input v-model.number="form.hotspotY" type="number" class="mt-1 w-full border border-white/10 bg-iron-950/70 px-3 py-2 text-sm font-semibold outline-none focus:border-safety-500" />
              </label>
              <label class="block">
                <span class="text-xs font-extrabold text-white/55">热点半径</span>
                <input v-model.number="form.hotspotRadius" type="number" class="mt-1 w-full border border-white/10 bg-iron-950/70 px-3 py-2 text-sm font-semibold outline-none focus:border-safety-500" />
              </label>
              <label class="block">
                <span class="text-xs font-extrabold text-white/55">热点标签</span>
                <input v-model="form.hotspotLabel" class="mt-1 w-full border border-white/10 bg-iron-950/70 px-3 py-2 text-sm font-semibold outline-none focus:border-safety-500" />
              </label>
            </div>

            <div v-if="productType === 'bucket' || productType === 'tooth'" class="mt-4 grid gap-3 sm:grid-cols-2">
              <label class="block">
                <span class="text-xs font-extrabold text-white/55">Mount Offset X</span>
                <input v-model.number="form.mountOffsetX" type="number" class="mt-1 w-full border border-white/10 bg-iron-950/70 px-3 py-2 text-sm font-semibold outline-none focus:border-safety-500" />
              </label>
              <label class="block">
                <span class="text-xs font-extrabold text-white/55">Mount Offset Y</span>
                <input v-model.number="form.mountOffsetY" type="number" class="mt-1 w-full border border-white/10 bg-iron-950/70 px-3 py-2 text-sm font-semibold outline-none focus:border-safety-500" />
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
              {{ submitButtonText }}
            </button>
          </div>

          <div class="border border-white/10 bg-white/6 p-5">
            <p class="text-xl font-extrabold">导入数据</p>
            <p class="mt-2 text-sm leading-6 text-white/60">选择一个本页面导出的 ZIP 数据包，会自动恢复产品图片、描述、参数、兼容关系和组合校准。</p>
            <div class="mt-5">
              <label class="block cursor-pointer bg-white px-5 py-4 text-center font-extrabold text-iron-950 transition hover:bg-safety-500">
                导入 ZIP 数据包
                <input class="hidden" type="file" accept=".zip,application/zip,application/x-zip-compressed" :disabled="isBusy" @change="importZip" />
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
            <p class="mt-2 text-sm font-bold leading-6 text-iron-800">ZIP 内含 data-package.json、图片文件和全部组合校准；之后可直接在本页面导入。</p>
          </button>

          <div class="border border-white/10">
            <button type="button" class="w-full px-5 py-3 text-left text-sm font-extrabold text-white/70" @click="showAdvanced = !showAdvanced">
              {{ showAdvanced ? '收起高级操作' : '高级操作' }}
            </button>
            <div v-if="showAdvanced" class="grid gap-3 border-t border-white/10 p-5 sm:grid-cols-2">
              <label class="block cursor-pointer border border-white/15 px-4 py-3 text-center text-sm font-extrabold text-white/75 hover:border-safety-500 hover:text-safety-500">
                兼容导入 JSON
                <input class="hidden" type="file" accept="application/json,.json" :disabled="isBusy" @change="importJson" />
              </label>
              <label class="block cursor-pointer border border-white/15 px-4 py-3 text-center text-sm font-extrabold text-white/75 hover:border-safety-500 hover:text-safety-500">
                兼容导入文件夹
                <input class="hidden" type="file" webkitdirectory directory multiple :disabled="isBusy" @change="importFolder" />
              </label>
              <button type="button" class="border border-white/15 px-4 py-3 text-sm font-extrabold text-white/75 hover:border-safety-500 hover:text-safety-500" :disabled="isBusy" @click="resetDraft">
                清空新增表单草稿
              </button>
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

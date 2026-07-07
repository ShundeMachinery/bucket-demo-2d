import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { cloneSerializable, createDataPackage, getActiveDataPackage, loadBuiltinDataPackage, saveActiveDataPackage } from '../services/dataPackageDb'
import type { DataPackage } from '../types/dataPackage'
import type { Bucket, Excavator, ProductCatalog, Tooth } from '../types/product'

const storageKey = 'bucket-demo-2d:configurator:v2'
const legacyStorageKey = 'bucket-demo-2d:configurator:v1'

const fallbackCatalog: ProductCatalog = {
  stage: {
    width: 1280,
    height: 720,
    defaultScale: 0.9,
  },
  defaults: {
    excavatorId: 'loading-excavator',
    bucketId: 'loading-bucket',
    toothId: 'loading-tooth',
  },
  excavators: [
    {
      id: 'loading-excavator',
      name: '正在加载产品数据库',
      series: 'SQLite',
      tonnage: '--',
      image: '',
      anchor: { x: 430, y: 470 },
      hotspot: { x: 610, y: 430, radius: 42, label: '加载中' },
      dimensions: { width: 820, height: 420 },
      compatibleBucketIds: ['loading-bucket'],
      description: '正在读取 SQLite 产品数据库。',
      sellingPoints: [],
      notes: '请稍候。',
    },
  ],
  buckets: [
    {
      id: 'loading-bucket',
      name: '正在加载挖斗',
      series: 'SQLite',
      capacity: '--',
      image: '',
      anchor: { x: 810, y: 486 },
      hotspot: { x: 968, y: 546, radius: 36, label: '加载中' },
      dimensions: { width: 360, height: 235 },
      compatibleExcavatorIds: ['loading-excavator'],
      compatibleToothIds: ['loading-tooth'],
      mountOffset: { x: 0, y: 0 },
      description: '正在读取 SQLite 产品数据库。',
      sellingPoints: [],
      notes: '请稍候。',
    },
  ],
  teeth: [
    {
      id: 'loading-tooth',
      name: '正在加载斗齿',
      series: 'SQLite',
      material: '--',
      image: '',
      anchor: { x: 1012, y: 552 },
      hotspot: { x: 1035, y: 555, radius: 22, label: '加载中' },
      dimensions: { width: 132, height: 78 },
      compatibleBucketIds: ['loading-bucket'],
      mountOffset: { x: 0, y: 0 },
      description: '正在读取 SQLite 产品数据库。',
      sellingPoints: [],
      notes: '请稍候。',
    },
  ],
  compatibility: [
    {
      id: 'fit-loading',
      excavatorId: 'loading-excavator',
      bucketId: 'loading-bucket',
      toothIds: ['loading-tooth'],
      fitment: '正在加载 SQLite 产品数据库。',
      remark: '请稍候。',
    },
  ],
}

export type HighlightPart = 'excavator' | 'bucket' | 'tooth'

export type LayerAdjustment = {
  offsetX: number
  offsetY: number
  scale: number
  rotateZ: number
}

export type CombinationLayout = {
  layerAdjustments: Record<HighlightPart, LayerAdjustment>
}

const defaultAdjustment: LayerAdjustment = {
  offsetX: 0,
  offsetY: 0,
  scale: 1,
  rotateZ: 0,
}

function cloneDefaultAdjustment() {
  return { ...defaultAdjustment }
}

function createDefaultLayout(): CombinationLayout {
  return {
    layerAdjustments: {
      excavator: cloneDefaultAdjustment(),
      bucket: cloneDefaultAdjustment(),
      tooth: cloneDefaultAdjustment(),
    },
  }
}

type PersistedState = {
  selectedExcavatorId?: string
  selectedBucketId?: string
  selectedToothId?: string
  highlightedPart?: HighlightPart
  isCanvasLocked?: boolean
  scale?: number
  panX?: number
  panY?: number
  combinationLayouts?: Record<string, Partial<CombinationLayout>>
  currentLayout?: Partial<CombinationLayout>
  layerAdjustments?: Partial<Record<HighlightPart, Partial<LayerAdjustment>>>
}

type SelectionState = Pick<PersistedState, 'selectedExcavatorId' | 'selectedBucketId' | 'selectedToothId'>

type ApplyDataPackageOptions = {
  selection?: SelectionState
  layoutOverrides?: Record<string, Partial<CombinationLayout>>
}

function isHighlightPart(value: unknown): value is HighlightPart {
  return value === 'excavator' || value === 'bucket' || value === 'tooth'
}

function clamp(value: unknown, min: number, max: number, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback
}

function normalizeAdjustment(value: Partial<LayerAdjustment> | undefined): LayerAdjustment {
  return {
    offsetX: Math.round(clamp(value?.offsetX, -800, 800, 0)),
    offsetY: Math.round(clamp(value?.offsetY, -500, 500, 0)),
    scale: Number(clamp(value?.scale, 0.55, 1.6, 1).toFixed(2)),
    rotateZ: Math.round(clamp(value?.rotateZ, -180, 180, 0)),
  }
}

function normalizeLayout(value: Partial<CombinationLayout> | undefined): CombinationLayout {
  return {
    layerAdjustments: {
      excavator: normalizeAdjustment(value?.layerAdjustments?.excavator),
      bucket: normalizeAdjustment(value?.layerAdjustments?.bucket),
      tooth: normalizeAdjustment(value?.layerAdjustments?.tooth),
    },
  }
}

function normalizeLegacyLayout(layerAdjustments: Partial<Record<HighlightPart, Partial<LayerAdjustment>>> | undefined): CombinationLayout {
  return {
    layerAdjustments: {
      excavator: normalizeAdjustment(layerAdjustments?.excavator),
      bucket: normalizeAdjustment(layerAdjustments?.bucket),
      tooth: normalizeAdjustment(layerAdjustments?.tooth),
    },
  }
}

function normalizeLayoutMap(layouts: Record<string, Partial<CombinationLayout>> | undefined) {
  return layouts
    ? Object.fromEntries(Object.entries(layouts).map(([key, value]) => [key, normalizeLayout(value)]))
    : {}
}

function readPersistedState(): PersistedState | null {
  if (typeof window === 'undefined') return null

  try {
    const raw = window.localStorage.getItem(storageKey) ?? window.localStorage.getItem(legacyStorageKey)
    return raw ? (JSON.parse(raw) as PersistedState) : null
  } catch {
    return null
  }
}

function createCombinationKey(excavatorId: string, bucketId: string, toothId: string) {
  return `${excavatorId}::${bucketId}::${toothId}`
}

function pickExistingId<T extends { id: string }>(items: T[], id: string | undefined, fallbackId: string) {
  return id && items.some((item) => item.id === id) ? id : fallbackId
}

function addUnique(target: string[], id: string) {
  if (!target.includes(id)) {
    target.push(id)
  }
}

function normalizeUniqueIds(ids: string[], validIds: Set<string>) {
  return Array.from(new Set(ids.filter((id) => validIds.has(id))))
}

function replaceIdInList(ids: string[], oldId: string, nextId: string) {
  return Array.from(new Set(ids.map((id) => (id === oldId ? nextId : id))))
}

function rejectIdInList(ids: string[], id: string) {
  return ids.filter((item) => item !== id)
}

function assertUniqueId(catalog: ProductCatalog, id: string, existingId?: string) {
  const exists = [...catalog.excavators, ...catalog.buckets, ...catalog.teeth].some((part) => {
    return part.id === id && part.id !== existingId
  })

  if (exists) {
    throw new Error(`ID 已存在：${id}`)
  }
}

export const useConfiguratorStore = defineStore('configurator', () => {
  let saveTimer: ReturnType<typeof window.setTimeout> | undefined
  const persisted = readPersistedState()
  const persistedExcavatorId = persisted?.selectedExcavatorId
  const persistedBucketId = persisted?.selectedBucketId
  const persistedToothId = persisted?.selectedToothId
  const activeCatalog = ref<ProductCatalog>(cloneSerializable(fallbackCatalog))
  const dataPackageName = ref('mock-products')
  const dataPackageUpdatedAt = ref('')
  const isDataPackageLoading = ref(true)
  const isDataPackageSaving = ref(false)
  const initialExcavatorId = fallbackCatalog.excavators.some((item) => item.id === persistedExcavatorId) && persistedExcavatorId ? persistedExcavatorId : fallbackCatalog.defaults.excavatorId
  const initialBucketId = fallbackCatalog.buckets.some((item) => item.id === persistedBucketId) && persistedBucketId ? persistedBucketId : fallbackCatalog.defaults.bucketId
  const initialToothId = fallbackCatalog.teeth.some((item) => item.id === persistedToothId) && persistedToothId ? persistedToothId : fallbackCatalog.defaults.toothId
  const selectedExcavatorId = ref(initialExcavatorId)
  const selectedBucketId = ref(initialBucketId)
  const selectedToothId = ref(initialToothId)
  const highlightedPart = ref<HighlightPart>(isHighlightPart(persisted?.highlightedPart) ? persisted.highlightedPart : 'tooth')
  const isCanvasLocked = ref(Boolean(persisted?.isCanvasLocked))
  const scale = ref(clamp(persisted?.scale, 0.48, 1.8, 0.9))
  const panX = ref(Math.round(clamp(persisted?.panX, -420, 420, 0)))
  const panY = ref(Math.round(clamp(persisted?.panY, -260, 260, 0)))
  const initialCombinationKey = createCombinationKey(selectedExcavatorId.value, selectedBucketId.value, selectedToothId.value)
  const initialLayout = persisted?.combinationLayouts?.[initialCombinationKey] || persisted?.currentLayout
    ? normalizeLayout(persisted.combinationLayouts?.[initialCombinationKey] ?? persisted.currentLayout)
    : normalizeLegacyLayout(persisted?.layerAdjustments)
  const combinationLayouts = ref<Record<string, CombinationLayout>>({
    ...normalizeLayoutMap(persisted?.combinationLayouts),
    [initialCombinationKey]: initialLayout,
  })

  const catalog = computed(() => activeCatalog.value)
  const excavators = computed(() => activeCatalog.value.excavators)
  const buckets = computed(() => activeCatalog.value.buckets)
  const teeth = computed(() => activeCatalog.value.teeth)

  const selectedExcavator = computed<Excavator>(() => {
    return activeCatalog.value.excavators.find((item) => item.id === selectedExcavatorId.value) ?? activeCatalog.value.excavators[0]
  })

  const compatibleBuckets = computed<Bucket[]>(() => {
    return activeCatalog.value.buckets.filter((bucket) => {
      return selectedExcavator.value.compatibleBucketIds.includes(bucket.id)
    })
  })

  const selectedBucket = computed<Bucket>(() => {
    const current = compatibleBuckets.value.find((item) => item.id === selectedBucketId.value)
    return current ?? compatibleBuckets.value[0] ?? activeCatalog.value.buckets[0]
  })

  const compatibilityRule = computed(() => {
    return activeCatalog.value.compatibility.find((rule) => {
      return rule.excavatorId === selectedExcavator.value.id && rule.bucketId === selectedBucket.value.id
    })
  })

  const compatibleTeeth = computed<Tooth[]>(() => {
    const ruleToothIds = compatibilityRule.value?.toothIds ?? selectedBucket.value.compatibleToothIds

    return activeCatalog.value.teeth.filter((tooth) => {
      return ruleToothIds.includes(tooth.id) && tooth.compatibleBucketIds.includes(selectedBucket.value.id)
    })
  })

  const selectedTooth = computed<Tooth>(() => {
    const current = compatibleTeeth.value.find((item) => item.id === selectedToothId.value)
    return current ?? compatibleTeeth.value[0] ?? activeCatalog.value.teeth[0]
  })

  const combinationKey = computed(() => createCombinationKey(selectedExcavator.value.id, selectedBucket.value.id, selectedTooth.value.id))

  const currentLayout = computed(() => {
    return combinationLayouts.value[combinationKey.value] ?? createDefaultLayout()
  })

  const layerAdjustments = computed(() => currentLayout.value.layerAdjustments)

  const selectedLayerAdjustment = computed(() => layerAdjustments.value[highlightedPart.value])

  const combinationCode = computed(() => {
    return [
      selectedExcavator.value.name.split(' ')[0],
      selectedBucket.value.name.split(' ')[0],
      selectedTooth.value.name.split(' ')[0],
    ].join(' / ')
  })

  const fitmentSummary = computed(() => {
    return compatibilityRule.value?.fitment ?? '当前组合来自基础兼容关系，建议导入真实适配表后复核。'
  })

  const remarkSummary = computed(() => {
    return compatibilityRule.value?.remark ?? '暂无额外备注。'
  })

  function ensureCompatibleSelection() {
    if (!compatibleBuckets.value.some((bucket) => bucket.id === selectedBucketId.value)) {
      selectedBucketId.value = compatibleBuckets.value[0]?.id ?? activeCatalog.value.buckets[0].id
    }

    if (!compatibleTeeth.value.some((tooth) => tooth.id === selectedToothId.value)) {
      selectedToothId.value = compatibleTeeth.value[0]?.id ?? activeCatalog.value.teeth[0].id
    }
  }

  function selectExcavator(id: string) {
    selectedExcavatorId.value = id
    highlightedPart.value = 'excavator'
    ensureCompatibleSelection()
  }

  function selectBucket(id: string) {
    selectedBucketId.value = id
    highlightedPart.value = 'bucket'
    ensureCompatibleSelection()
  }

  function selectTooth(id: string) {
    selectedToothId.value = id
    highlightedPart.value = 'tooth'
  }

  function setHighlightedPart(part: HighlightPart) {
    highlightedPart.value = part
  }

  function updateLayerAdjustment(part: HighlightPart, patch: Partial<LayerAdjustment>) {
    const layout = ensureCurrentLayout()
    layout.layerAdjustments[part] = {
      ...layout.layerAdjustments[part],
      ...patch,
    }
  }

  function moveLayer(part: HighlightPart, deltaX: number, deltaY: number) {
    const adjustment = layerAdjustments.value[part]
    updateLayerAdjustment(part, {
      offsetX: Math.round(adjustment.offsetX + deltaX),
      offsetY: Math.round(adjustment.offsetY + deltaY),
    })
  }

  function setLayerScale(part: HighlightPart, nextScale: number) {
    updateLayerAdjustment(part, {
      scale: Math.min(1.6, Math.max(0.55, Number(nextScale.toFixed(2)))),
    })
  }

  function setLayerRotation(part: HighlightPart, rotateZ: number) {
    updateLayerAdjustment(part, {
      rotateZ: Math.min(180, Math.max(-180, Math.round(rotateZ))),
    })
  }

  function resetLayerAdjustment(part: HighlightPart) {
    const layout = ensureCurrentLayout()
    layout.layerAdjustments[part] = cloneDefaultAdjustment()
  }

  function resetLayerScale(part: HighlightPart) {
    updateLayerAdjustment(part, { scale: defaultAdjustment.scale })
  }

  function resetLayerRotation(part: HighlightPart) {
    updateLayerAdjustment(part, { rotateZ: defaultAdjustment.rotateZ })
  }

  function resetAllLayerAdjustments() {
    const layout = ensureCurrentLayout()
    layout.layerAdjustments = createDefaultLayout().layerAdjustments
  }

  function ensureCurrentLayout() {
    if (!combinationLayouts.value[combinationKey.value]) {
      combinationLayouts.value[combinationKey.value] = createDefaultLayout()
    }

    return combinationLayouts.value[combinationKey.value]
  }

  function resetCurrentCombinationLayout() {
    combinationLayouts.value[combinationKey.value] = createDefaultLayout()
  }

  function zoomIn() {
    scale.value = Math.min(1.8, Number((scale.value + 0.1).toFixed(2)))
  }

  function zoomOut() {
    scale.value = Math.max(0.48, Number((scale.value - 0.1).toFixed(2)))
  }

  function setScale(nextScale: number) {
    scale.value = Math.min(1.8, Math.max(0.48, Number(nextScale.toFixed(2))))
  }

  function setPan(x: number, y: number) {
    const maxX = Math.max(800, Math.round(activeCatalog.value.stage.width * scale.value))
    const maxY = Math.max(620, Math.round(activeCatalog.value.stage.height * scale.value))
    panX.value = Math.min(maxX, Math.max(-maxX, Math.round(x)))
    panY.value = Math.min(maxY, Math.max(-maxY, Math.round(y)))
  }

  function nudgePan(deltaX: number, deltaY: number) {
    setPan(panX.value + deltaX, panY.value + deltaY)
  }

  function resetView() {
    scale.value = 0.9
    panX.value = 0
    panY.value = 0
  }

  function restoreDefaultCombination() {
    selectedExcavatorId.value = activeCatalog.value.defaults.excavatorId
    selectedBucketId.value = activeCatalog.value.defaults.bucketId
    selectedToothId.value = activeCatalog.value.defaults.toothId
    highlightedPart.value = 'tooth'
    resetView()
    ensureCompatibleSelection()
  }

  function setCanvasLocked(locked: boolean) {
    isCanvasLocked.value = locked
  }

  function toggleCanvasLocked() {
    isCanvasLocked.value = !isCanvasLocked.value
  }

  function applySelectionState(selection: SelectionState | undefined) {
    const defaults = activeCatalog.value.defaults

    selectedExcavatorId.value = pickExistingId(activeCatalog.value.excavators, selection?.selectedExcavatorId, defaults.excavatorId)
    selectedBucketId.value = pickExistingId(activeCatalog.value.buckets, selection?.selectedBucketId, defaults.bucketId)
    selectedToothId.value = pickExistingId(activeCatalog.value.teeth, selection?.selectedToothId, defaults.toothId)

    ensureCompatibleSelection()
  }

  function applyDataPackage(dataPackage: DataPackage, options: ApplyDataPackageOptions = {}) {
    activeCatalog.value = cloneSerializable(dataPackage.catalog)
    combinationLayouts.value = {
      ...normalizeLayoutMap(dataPackage.layouts),
      ...normalizeLayoutMap(options.layoutOverrides),
    }
    dataPackageName.value = dataPackage.name
    dataPackageUpdatedAt.value = dataPackage.updatedAt
    if (options.selection) {
      applySelectionState(options.selection)
    } else {
      restoreDefaultCombination()
    }
    ensureCurrentLayout()
  }

  async function loadActiveDataPackage() {
    isDataPackageLoading.value = true
    try {
      const saved = await getActiveDataPackage()
      const dataPackage = saved ?? await loadBuiltinDataPackage()
      applyDataPackage(dataPackage, {
        selection: {
          selectedExcavatorId: persisted?.selectedExcavatorId,
          selectedBucketId: persisted?.selectedBucketId,
          selectedToothId: persisted?.selectedToothId,
        },
        layoutOverrides: persisted?.combinationLayouts,
      })
    } finally {
      isDataPackageLoading.value = false
    }
  }

  async function persistActiveDataPackage() {
    isDataPackageSaving.value = true
    try {
      const nextPackage = createDataPackage(dataPackageName.value || 'bucket-demo-data', activeCatalog.value, combinationLayouts.value)
      dataPackageUpdatedAt.value = nextPackage.updatedAt
      await saveActiveDataPackage(nextPackage)
    } finally {
      isDataPackageSaving.value = false
    }
  }

  function schedulePersistActiveDataPackage() {
    if (typeof window === 'undefined') return

    window.clearTimeout(saveTimer)
    saveTimer = window.setTimeout(() => {
      void persistActiveDataPackage()
    }, 250)
  }

  async function importDataPackage(dataPackage: DataPackage) {
    applyDataPackage(dataPackage)
    await persistActiveDataPackage()
  }

  async function resetToMockDataPackage() {
    applyDataPackage(await loadBuiltinDataPackage())
    await persistActiveDataPackage()
  }

  function getCurrentDataPackage() {
    return createDataPackage(dataPackageName.value || 'bucket-demo-data', activeCatalog.value, combinationLayouts.value)
  }

  function pruneCompatibilityRules() {
    const excavatorIds = new Set(activeCatalog.value.excavators.map((item) => item.id))
    const bucketIds = new Set(activeCatalog.value.buckets.map((item) => item.id))
    const toothIds = new Set(activeCatalog.value.teeth.map((item) => item.id))

    activeCatalog.value.compatibility = activeCatalog.value.compatibility
      .filter((rule) => excavatorIds.has(rule.excavatorId) && bucketIds.has(rule.bucketId))
      .map((rule) => ({
        ...rule,
        toothIds: normalizeUniqueIds(rule.toothIds, toothIds),
      }))
      .filter((rule) => rule.toothIds.length > 0)
  }

  function rebuildCompatibilityGraph() {
    const bucketIds = new Set(activeCatalog.value.buckets.map((item) => item.id))
    const excavatorIds = new Set(activeCatalog.value.excavators.map((item) => item.id))
    const toothIds = new Set(activeCatalog.value.teeth.map((item) => item.id))
    const existingRuleByPair = new Map(activeCatalog.value.compatibility.map((rule) => [`${rule.excavatorId}::${rule.bucketId}`, cloneSerializable(rule)]))

    for (const excavator of activeCatalog.value.excavators) {
      excavator.compatibleBucketIds = normalizeUniqueIds(excavator.compatibleBucketIds, bucketIds)
    }

    for (const bucket of activeCatalog.value.buckets) {
      bucket.compatibleExcavatorIds = normalizeUniqueIds(bucket.compatibleExcavatorIds, excavatorIds)
      bucket.compatibleToothIds = normalizeUniqueIds(bucket.compatibleToothIds, toothIds)
    }

    for (const tooth of activeCatalog.value.teeth) {
      tooth.compatibleBucketIds = normalizeUniqueIds(tooth.compatibleBucketIds, bucketIds)
    }

    for (const excavator of activeCatalog.value.excavators) {
      for (const bucketId of excavator.compatibleBucketIds) {
        const bucket = activeCatalog.value.buckets.find((item) => item.id === bucketId)
        if (bucket) {
          addUnique(bucket.compatibleExcavatorIds, excavator.id)
        }
      }
    }

    for (const bucket of activeCatalog.value.buckets) {
      for (const excavatorId of bucket.compatibleExcavatorIds) {
        const excavator = activeCatalog.value.excavators.find((item) => item.id === excavatorId)
        if (excavator) {
          addUnique(excavator.compatibleBucketIds, bucket.id)
        }
      }

      for (const toothId of bucket.compatibleToothIds) {
        const tooth = activeCatalog.value.teeth.find((item) => item.id === toothId)
        if (tooth) {
          addUnique(tooth.compatibleBucketIds, bucket.id)
        }
      }
    }

    for (const tooth of activeCatalog.value.teeth) {
      for (const bucketId of tooth.compatibleBucketIds) {
        const bucket = activeCatalog.value.buckets.find((item) => item.id === bucketId)
        if (bucket) {
          addUnique(bucket.compatibleToothIds, tooth.id)
        }
      }
    }

    activeCatalog.value.compatibility = []
    for (const bucket of activeCatalog.value.buckets) {
      for (const excavatorId of bucket.compatibleExcavatorIds) {
        const excavator = activeCatalog.value.excavators.find((item) => item.id === excavatorId)
        if (excavator?.compatibleBucketIds.includes(bucket.id)) {
          const existingRule = existingRuleByPair.get(`${excavator.id}::${bucket.id}`)
          activeCatalog.value.compatibility.push({
            id: existingRule?.id ?? `fit-${excavator.id}-${bucket.id}`,
            excavatorId: excavator.id,
            bucketId: bucket.id,
            toothIds: normalizeUniqueIds(bucket.compatibleToothIds, toothIds),
            fitment: existingRule?.fitment ?? '自定义数据录入生成的适配关系，请在真实交付前复核安装尺寸。',
            remark: existingRule?.remark ?? '由数据管理页新增产品时自动创建。',
          })
        }
      }
    }

    pruneCompatibilityRules()
  }

  function renameProductReferences(part: HighlightPart, oldId: string, nextId: string) {
    if (oldId === nextId) return

    if (part === 'excavator') {
      if (activeCatalog.value.defaults.excavatorId === oldId) activeCatalog.value.defaults.excavatorId = nextId
      if (selectedExcavatorId.value === oldId) selectedExcavatorId.value = nextId
      for (const bucket of activeCatalog.value.buckets) {
        bucket.compatibleExcavatorIds = replaceIdInList(bucket.compatibleExcavatorIds, oldId, nextId)
      }
      for (const rule of activeCatalog.value.compatibility) {
        if (rule.excavatorId === oldId) rule.excavatorId = nextId
      }
    }

    if (part === 'bucket') {
      if (activeCatalog.value.defaults.bucketId === oldId) activeCatalog.value.defaults.bucketId = nextId
      if (selectedBucketId.value === oldId) selectedBucketId.value = nextId
      for (const excavator of activeCatalog.value.excavators) {
        excavator.compatibleBucketIds = replaceIdInList(excavator.compatibleBucketIds, oldId, nextId)
      }
      for (const tooth of activeCatalog.value.teeth) {
        tooth.compatibleBucketIds = replaceIdInList(tooth.compatibleBucketIds, oldId, nextId)
      }
      for (const rule of activeCatalog.value.compatibility) {
        if (rule.bucketId === oldId) rule.bucketId = nextId
      }
    }

    if (part === 'tooth') {
      if (activeCatalog.value.defaults.toothId === oldId) activeCatalog.value.defaults.toothId = nextId
      if (selectedToothId.value === oldId) selectedToothId.value = nextId
      for (const bucket of activeCatalog.value.buckets) {
        bucket.compatibleToothIds = replaceIdInList(bucket.compatibleToothIds, oldId, nextId)
      }
      for (const rule of activeCatalog.value.compatibility) {
        rule.toothIds = replaceIdInList(rule.toothIds, oldId, nextId)
      }
    }

    combinationLayouts.value = Object.fromEntries(
      Object.entries(combinationLayouts.value).map(([key, layout]) => {
        const [excavatorId, bucketId, toothId] = key.split('::')
        const nextKey = [
          part === 'excavator' && excavatorId === oldId ? nextId : excavatorId,
          part === 'bucket' && bucketId === oldId ? nextId : bucketId,
          part === 'tooth' && toothId === oldId ? nextId : toothId,
        ].join('::')

        return [nextKey, layout]
      }),
    )
  }

  function detachExcavatorRelations(id: string) {
    for (const bucket of activeCatalog.value.buckets) {
      bucket.compatibleExcavatorIds = rejectIdInList(bucket.compatibleExcavatorIds, id)
    }

    activeCatalog.value.compatibility = activeCatalog.value.compatibility.filter((rule) => rule.excavatorId !== id)
  }

  function detachBucketRelations(id: string) {
    for (const excavator of activeCatalog.value.excavators) {
      excavator.compatibleBucketIds = rejectIdInList(excavator.compatibleBucketIds, id)
    }

    for (const tooth of activeCatalog.value.teeth) {
      tooth.compatibleBucketIds = rejectIdInList(tooth.compatibleBucketIds, id)
    }

    activeCatalog.value.compatibility = activeCatalog.value.compatibility.filter((rule) => rule.bucketId !== id)
  }

  function detachToothRelations(id: string) {
    for (const bucket of activeCatalog.value.buckets) {
      bucket.compatibleToothIds = rejectIdInList(bucket.compatibleToothIds, id)
    }

    for (const rule of activeCatalog.value.compatibility) {
      rule.toothIds = rejectIdInList(rule.toothIds, id)
    }
  }

  function deleteCombinationLayoutsWithPart(part: HighlightPart, id: string) {
    combinationLayouts.value = Object.fromEntries(
      Object.entries(combinationLayouts.value).filter(([key]) => {
        const [excavatorId, bucketId, toothId] = key.split('::')
        if (part === 'excavator') return excavatorId !== id
        if (part === 'bucket') return bucketId !== id
        return toothId !== id
      }),
    )
  }

  async function addExcavator(product: Excavator) {
    assertUniqueId(activeCatalog.value, product.id)
    activeCatalog.value.excavators.push(cloneSerializable(product))
    rebuildCompatibilityGraph()
    selectedExcavatorId.value = product.id
    highlightedPart.value = 'excavator'
    ensureCompatibleSelection()
    await persistActiveDataPackage()
  }

  async function addBucket(product: Bucket) {
    assertUniqueId(activeCatalog.value, product.id)
    activeCatalog.value.buckets.push(cloneSerializable(product))
    rebuildCompatibilityGraph()
    selectedExcavatorId.value = product.compatibleExcavatorIds[0] ?? selectedExcavatorId.value
    selectedBucketId.value = product.id
    highlightedPart.value = 'bucket'
    ensureCompatibleSelection()
    await persistActiveDataPackage()
  }

  async function addTooth(product: Tooth) {
    assertUniqueId(activeCatalog.value, product.id)
    activeCatalog.value.teeth.push(cloneSerializable(product))
    rebuildCompatibilityGraph()
    const firstBucket = activeCatalog.value.buckets.find((bucket) => bucket.id === product.compatibleBucketIds[0])
    selectedExcavatorId.value = firstBucket?.compatibleExcavatorIds[0] ?? selectedExcavatorId.value
    selectedBucketId.value = firstBucket?.id ?? selectedBucketId.value
    selectedToothId.value = product.id
    highlightedPart.value = 'tooth'
    ensureCompatibleSelection()
    await persistActiveDataPackage()
  }

  async function updateExcavator(existingId: string, product: Excavator) {
    assertUniqueId(activeCatalog.value, product.id, existingId)
    const index = activeCatalog.value.excavators.findIndex((item) => item.id === existingId)
    if (index < 0) throw new Error(`未找到挖掘机：${existingId}`)

    renameProductReferences('excavator', existingId, product.id)
    detachExcavatorRelations(product.id)
    activeCatalog.value.excavators[index] = cloneSerializable(product)
    rebuildCompatibilityGraph()
    selectedExcavatorId.value = product.id
    highlightedPart.value = 'excavator'
    ensureCompatibleSelection()
    await persistActiveDataPackage()
  }

  async function updateBucket(existingId: string, product: Bucket) {
    assertUniqueId(activeCatalog.value, product.id, existingId)
    const index = activeCatalog.value.buckets.findIndex((item) => item.id === existingId)
    if (index < 0) throw new Error(`未找到挖斗：${existingId}`)

    renameProductReferences('bucket', existingId, product.id)
    detachBucketRelations(product.id)
    activeCatalog.value.buckets[index] = cloneSerializable(product)
    rebuildCompatibilityGraph()
    selectedExcavatorId.value = product.compatibleExcavatorIds[0] ?? selectedExcavatorId.value
    selectedBucketId.value = product.id
    highlightedPart.value = 'bucket'
    ensureCompatibleSelection()
    await persistActiveDataPackage()
  }

  async function updateTooth(existingId: string, product: Tooth) {
    assertUniqueId(activeCatalog.value, product.id, existingId)
    const index = activeCatalog.value.teeth.findIndex((item) => item.id === existingId)
    if (index < 0) throw new Error(`未找到斗齿：${existingId}`)

    renameProductReferences('tooth', existingId, product.id)
    detachToothRelations(product.id)
    activeCatalog.value.teeth[index] = cloneSerializable(product)
    rebuildCompatibilityGraph()
    const firstBucket = activeCatalog.value.buckets.find((bucket) => bucket.id === product.compatibleBucketIds[0])
    selectedExcavatorId.value = firstBucket?.compatibleExcavatorIds[0] ?? selectedExcavatorId.value
    selectedBucketId.value = firstBucket?.id ?? selectedBucketId.value
    selectedToothId.value = product.id
    highlightedPart.value = 'tooth'
    ensureCompatibleSelection()
    await persistActiveDataPackage()
  }

  async function deleteExcavator(id: string) {
    if (activeCatalog.value.excavators.length <= 1) {
      throw new Error('至少需要保留一个挖掘机')
    }

    const index = activeCatalog.value.excavators.findIndex((item) => item.id === id)
    if (index < 0) throw new Error(`未找到挖掘机：${id}`)

    activeCatalog.value.excavators.splice(index, 1)
    detachExcavatorRelations(id)
    deleteCombinationLayoutsWithPart('excavator', id)
    const fallback = activeCatalog.value.excavators[0]
    if (activeCatalog.value.defaults.excavatorId === id) activeCatalog.value.defaults.excavatorId = fallback.id
    if (selectedExcavatorId.value === id) selectedExcavatorId.value = fallback.id
    highlightedPart.value = 'excavator'
    rebuildCompatibilityGraph()
    ensureCompatibleSelection()
    await persistActiveDataPackage()
  }

  async function deleteBucket(id: string) {
    if (activeCatalog.value.buckets.length <= 1) {
      throw new Error('至少需要保留一个挖斗')
    }

    const index = activeCatalog.value.buckets.findIndex((item) => item.id === id)
    if (index < 0) throw new Error(`未找到挖斗：${id}`)

    activeCatalog.value.buckets.splice(index, 1)
    detachBucketRelations(id)
    deleteCombinationLayoutsWithPart('bucket', id)
    const fallback = activeCatalog.value.buckets[0]
    if (activeCatalog.value.defaults.bucketId === id) activeCatalog.value.defaults.bucketId = fallback.id
    if (selectedBucketId.value === id) selectedBucketId.value = fallback.id
    highlightedPart.value = 'bucket'
    rebuildCompatibilityGraph()
    ensureCompatibleSelection()
    await persistActiveDataPackage()
  }

  async function deleteTooth(id: string) {
    if (activeCatalog.value.teeth.length <= 1) {
      throw new Error('至少需要保留一个斗齿')
    }

    const index = activeCatalog.value.teeth.findIndex((item) => item.id === id)
    if (index < 0) throw new Error(`未找到斗齿：${id}`)

    activeCatalog.value.teeth.splice(index, 1)
    detachToothRelations(id)
    deleteCombinationLayoutsWithPart('tooth', id)
    const fallback = activeCatalog.value.teeth[0]
    if (activeCatalog.value.defaults.toothId === id) activeCatalog.value.defaults.toothId = fallback.id
    if (selectedToothId.value === id) selectedToothId.value = fallback.id
    highlightedPart.value = 'tooth'
    rebuildCompatibilityGraph()
    ensureCompatibleSelection()
    await persistActiveDataPackage()
  }

  ensureCompatibleSelection()
  ensureCurrentLayout()
  void loadActiveDataPackage()

  watch(
    [
      selectedExcavatorId,
      selectedBucketId,
      selectedToothId,
      highlightedPart,
      isCanvasLocked,
      scale,
      panX,
      panY,
      combinationLayouts,
      activeCatalog,
    ],
    () => {
      if (typeof window === 'undefined') return

      const nextState: PersistedState = {
        selectedExcavatorId: selectedExcavatorId.value,
        selectedBucketId: selectedBucketId.value,
        selectedToothId: selectedToothId.value,
        highlightedPart: highlightedPart.value,
        isCanvasLocked: isCanvasLocked.value,
        scale: scale.value,
        panX: panX.value,
        panY: panY.value,
        currentLayout: currentLayout.value,
        combinationLayouts: combinationLayouts.value,
      }

      window.localStorage.setItem(storageKey, JSON.stringify(nextState))
      schedulePersistActiveDataPackage()
    },
    { deep: true },
  )

  return {
    catalog,
    dataPackageName,
    dataPackageUpdatedAt,
    isDataPackageLoading,
    isDataPackageSaving,
    excavators,
    buckets,
    teeth,
    selectedExcavatorId,
    selectedBucketId,
    selectedToothId,
    highlightedPart,
    isCanvasLocked,
    scale,
    panX,
    panY,
    combinationKey,
    combinationLayouts,
    layerAdjustments,
    selectedExcavator,
    selectedBucket,
    selectedTooth,
    selectedLayerAdjustment,
    compatibleBuckets,
    compatibleTeeth,
    combinationCode,
    fitmentSummary,
    remarkSummary,
    selectExcavator,
    selectBucket,
    selectTooth,
    setHighlightedPart,
    updateLayerAdjustment,
    moveLayer,
    setLayerScale,
    setLayerRotation,
    resetLayerAdjustment,
    resetLayerScale,
    resetLayerRotation,
    resetAllLayerAdjustments,
    resetCurrentCombinationLayout,
    zoomIn,
    zoomOut,
    setScale,
    setPan,
    nudgePan,
    resetView,
    setCanvasLocked,
    toggleCanvasLocked,
    restoreDefaultCombination,
    importDataPackage,
    resetToMockDataPackage,
    getCurrentDataPackage,
    addExcavator,
    addBucket,
    addTooth,
    updateExcavator,
    updateBucket,
    updateTooth,
    deleteExcavator,
    deleteBucket,
    deleteTooth,
  }
})

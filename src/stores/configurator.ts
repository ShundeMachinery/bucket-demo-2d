import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import catalogJson from '../data/products.json'
import { cloneSerializable, createDataPackage, getActiveDataPackage, saveActiveDataPackage } from '../services/dataPackageDb'
import type { DataPackage } from '../types/dataPackage'
import type { Bucket, Excavator, ProductCatalog, Tooth } from '../types/product'

const defaultCatalog = catalogJson as ProductCatalog
const storageKey = 'bucket-demo-2d:configurator:v2'
const legacyStorageKey = 'bucket-demo-2d:configurator:v1'

export type HighlightPart = 'excavator' | 'bucket' | 'tooth'

export type LayerAdjustment = {
  offsetX: number
  offsetY: number
  scale: number
  rotateX: number
  rotateY: number
}

export type CombinationPerspective = {
  rotateX: number
  rotateY: number
}

export type CombinationLayout = {
  layerAdjustments: Record<HighlightPart, LayerAdjustment>
  perspective: CombinationPerspective
}

const defaultAdjustment: LayerAdjustment = {
  offsetX: 0,
  offsetY: 0,
  scale: 1,
  rotateX: 0,
  rotateY: 0,
}

const defaultPerspective: CombinationPerspective = {
  rotateX: 0,
  rotateY: 0,
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
    perspective: { ...defaultPerspective },
  }
}

type PersistedState = {
  selectedExcavatorId?: string
  selectedBucketId?: string
  selectedToothId?: string
  highlightedPart?: HighlightPart
  scale?: number
  panX?: number
  panY?: number
  showcaseView?: boolean
  combinationLayouts?: Record<string, Partial<CombinationLayout>>
  currentLayout?: Partial<CombinationLayout>
  layerAdjustments?: Partial<Record<HighlightPart, Partial<LayerAdjustment>>>
  perspective?: Partial<CombinationPerspective>
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
    rotateX: Math.round(clamp(value?.rotateX, -18, 18, 0)),
    rotateY: Math.round(clamp(value?.rotateY, -24, 24, 0)),
  }
}

function normalizePerspective(value: Partial<CombinationPerspective> | undefined): CombinationPerspective {
  const rotateX = Math.round(clamp(value?.rotateX, -18, 18, defaultPerspective.rotateX))
  const rotateY = Math.round(clamp(value?.rotateY, -24, 24, defaultPerspective.rotateY))

  if (rotateX === 2 && rotateY === -7) {
    return { ...defaultPerspective }
  }

  return {
    rotateX,
    rotateY,
  }
}

function normalizeLayout(value: Partial<CombinationLayout> | undefined): CombinationLayout {
  return {
    layerAdjustments: {
      excavator: normalizeAdjustment(value?.layerAdjustments?.excavator),
      bucket: normalizeAdjustment(value?.layerAdjustments?.bucket),
      tooth: normalizeAdjustment(value?.layerAdjustments?.tooth),
    },
    perspective: normalizePerspective(value?.perspective),
  }
}

function normalizeLegacyLayout(
  layerAdjustments: Partial<Record<HighlightPart, Partial<LayerAdjustment>>> | undefined,
  perspective: Partial<CombinationPerspective> | undefined,
): CombinationLayout {
  return {
    layerAdjustments: {
      excavator: normalizeAdjustment(layerAdjustments?.excavator),
      bucket: normalizeAdjustment(layerAdjustments?.bucket),
      tooth: normalizeAdjustment(layerAdjustments?.tooth),
    },
    perspective: normalizePerspective(perspective),
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

export const useConfiguratorStore = defineStore('configurator', () => {
  let saveTimer: ReturnType<typeof window.setTimeout> | undefined
  const persisted = readPersistedState()
  const persistedExcavatorId = persisted?.selectedExcavatorId
  const persistedBucketId = persisted?.selectedBucketId
  const persistedToothId = persisted?.selectedToothId
  const activeCatalog = ref<ProductCatalog>(cloneSerializable(defaultCatalog))
  const dataPackageName = ref('mock-products')
  const dataPackageUpdatedAt = ref('')
  const isDataPackageLoading = ref(false)
  const isDataPackageSaving = ref(false)
  const initialExcavatorId = defaultCatalog.excavators.some((item) => item.id === persistedExcavatorId) && persistedExcavatorId ? persistedExcavatorId : defaultCatalog.defaults.excavatorId
  const initialBucketId = defaultCatalog.buckets.some((item) => item.id === persistedBucketId) && persistedBucketId ? persistedBucketId : defaultCatalog.defaults.bucketId
  const initialToothId = defaultCatalog.teeth.some((item) => item.id === persistedToothId) && persistedToothId ? persistedToothId : defaultCatalog.defaults.toothId
  const selectedExcavatorId = ref(initialExcavatorId)
  const selectedBucketId = ref(initialBucketId)
  const selectedToothId = ref(initialToothId)
  const highlightedPart = ref<HighlightPart>(isHighlightPart(persisted?.highlightedPart) ? persisted.highlightedPart : 'tooth')
  const scale = ref(clamp(persisted?.scale, 0.48, 1.8, 0.9))
  const panX = ref(Math.round(clamp(persisted?.panX, -420, 420, 0)))
  const panY = ref(Math.round(clamp(persisted?.panY, -260, 260, 0)))
  const showcaseView = ref(typeof persisted?.showcaseView === 'boolean' ? persisted.showcaseView : true)
  const initialCombinationKey = createCombinationKey(selectedExcavatorId.value, selectedBucketId.value, selectedToothId.value)
  const initialLayout = persisted?.combinationLayouts?.[initialCombinationKey] || persisted?.currentLayout
    ? normalizeLayout(persisted.combinationLayouts?.[initialCombinationKey] ?? persisted.currentLayout)
    : normalizeLegacyLayout(persisted?.layerAdjustments, persisted?.perspective)
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

  const combinationPerspective = computed(() => currentLayout.value.perspective)

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

  function setLayerTilt(part: HighlightPart, rotateX: number, rotateY: number) {
    updateLayerAdjustment(part, {
      rotateX: Math.min(18, Math.max(-18, Math.round(rotateX))),
      rotateY: Math.min(24, Math.max(-24, Math.round(rotateY))),
    })
  }

  function resetLayerAdjustment(part: HighlightPart) {
    const layout = ensureCurrentLayout()
    layout.layerAdjustments[part] = cloneDefaultAdjustment()
  }

  function resetLayerScale(part: HighlightPart) {
    updateLayerAdjustment(part, { scale: defaultAdjustment.scale })
  }

  function resetLayerTiltX(part: HighlightPart) {
    updateLayerAdjustment(part, { rotateX: defaultAdjustment.rotateX })
  }

  function resetLayerTiltY(part: HighlightPart) {
    updateLayerAdjustment(part, { rotateY: defaultAdjustment.rotateY })
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

  function setCombinationPerspective(rotateX: number, rotateY: number) {
    const layout = ensureCurrentLayout()
    layout.perspective = normalizePerspective({ rotateX, rotateY })
  }

  function resetCombinationPerspective() {
    const layout = ensureCurrentLayout()
    layout.perspective = { ...defaultPerspective }
  }

  function resetCombinationPerspectiveX() {
    setCombinationPerspective(defaultPerspective.rotateX, combinationPerspective.value.rotateY)
  }

  function resetCombinationPerspectiveY() {
    setCombinationPerspective(combinationPerspective.value.rotateX, defaultPerspective.rotateY)
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
    panX.value = Math.min(420, Math.max(-420, Math.round(x)))
    panY.value = Math.min(260, Math.max(-260, Math.round(y)))
  }

  function nudgePan(deltaX: number, deltaY: number) {
    setPan(panX.value + deltaX, panY.value + deltaY)
  }

  function resetView() {
    scale.value = 0.9
    panX.value = 0
    panY.value = 0
  }

  function toggleShowcaseView() {
    showcaseView.value = !showcaseView.value
  }

  function restoreDefaultCombination() {
    selectedExcavatorId.value = activeCatalog.value.defaults.excavatorId
    selectedBucketId.value = activeCatalog.value.defaults.bucketId
    selectedToothId.value = activeCatalog.value.defaults.toothId
    highlightedPart.value = 'tooth'
    resetView()
    ensureCompatibleSelection()
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
      if (saved) {
        applyDataPackage(saved, {
          selection: {
            selectedExcavatorId: persisted?.selectedExcavatorId,
            selectedBucketId: persisted?.selectedBucketId,
            selectedToothId: persisted?.selectedToothId,
          },
          layoutOverrides: persisted?.combinationLayouts,
        })
      }
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
    applyDataPackage(createDataPackage('mock-products', cloneSerializable(defaultCatalog), {}))
    await persistActiveDataPackage()
  }

  function getCurrentDataPackage() {
    return createDataPackage(dataPackageName.value || 'bucket-demo-data', activeCatalog.value, combinationLayouts.value)
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
      scale,
      panX,
      panY,
      showcaseView,
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
        scale: scale.value,
        panX: panX.value,
        panY: panY.value,
        showcaseView: showcaseView.value,
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
    scale,
    panX,
    panY,
    showcaseView,
    combinationKey,
    combinationLayouts,
    layerAdjustments,
    combinationPerspective,
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
    setLayerTilt,
    resetLayerAdjustment,
    resetLayerScale,
    resetLayerTiltX,
    resetLayerTiltY,
    resetAllLayerAdjustments,
    setCombinationPerspective,
    resetCombinationPerspective,
    resetCombinationPerspectiveX,
    resetCombinationPerspectiveY,
    resetCurrentCombinationLayout,
    zoomIn,
    zoomOut,
    setScale,
    setPan,
    nudgePan,
    resetView,
    toggleShowcaseView,
    restoreDefaultCombination,
    importDataPackage,
    resetToMockDataPackage,
    getCurrentDataPackage,
  }
})

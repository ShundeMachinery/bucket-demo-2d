import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import catalogJson from '../data/products.json'
import type { Bucket, Excavator, ProductCatalog, Tooth } from '../types/product'

const catalog = catalogJson as ProductCatalog
const storageKey = 'bucket-demo-2d:configurator:v1'

export type HighlightPart = 'excavator' | 'bucket' | 'tooth'

export type LayerAdjustment = {
  offsetX: number
  offsetY: number
  scale: number
  rotateX: number
  rotateY: number
}

const defaultAdjustment: LayerAdjustment = {
  offsetX: 0,
  offsetY: 0,
  scale: 1,
  rotateX: 0,
  rotateY: 0,
}

function cloneDefaultAdjustment() {
  return { ...defaultAdjustment }
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
  layerAdjustments?: Partial<Record<HighlightPart, Partial<LayerAdjustment>>>
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

function readPersistedState(): PersistedState | null {
  if (typeof window === 'undefined') return null

  try {
    const raw = window.localStorage.getItem(storageKey)
    return raw ? (JSON.parse(raw) as PersistedState) : null
  } catch {
    return null
  }
}

export const useConfiguratorStore = defineStore('configurator', () => {
  const persisted = readPersistedState()
  const persistedExcavatorId = persisted?.selectedExcavatorId
  const persistedBucketId = persisted?.selectedBucketId
  const persistedToothId = persisted?.selectedToothId
  const selectedExcavatorId = ref(catalog.excavators.some((item) => item.id === persistedExcavatorId) ? persistedExcavatorId : catalog.defaults.excavatorId)
  const selectedBucketId = ref(catalog.buckets.some((item) => item.id === persistedBucketId) ? persistedBucketId : catalog.defaults.bucketId)
  const selectedToothId = ref(catalog.teeth.some((item) => item.id === persistedToothId) ? persistedToothId : catalog.defaults.toothId)
  const highlightedPart = ref<HighlightPart>(isHighlightPart(persisted?.highlightedPart) ? persisted.highlightedPart : 'tooth')
  const scale = ref(clamp(persisted?.scale, 0.48, 1.8, 0.9))
  const panX = ref(Math.round(clamp(persisted?.panX, -420, 420, 0)))
  const panY = ref(Math.round(clamp(persisted?.panY, -260, 260, 0)))
  const showcaseView = ref(typeof persisted?.showcaseView === 'boolean' ? persisted.showcaseView : true)
  const layerAdjustments = ref<Record<HighlightPart, LayerAdjustment>>({
    excavator: normalizeAdjustment(persisted?.layerAdjustments?.excavator),
    bucket: normalizeAdjustment(persisted?.layerAdjustments?.bucket),
    tooth: normalizeAdjustment(persisted?.layerAdjustments?.tooth),
  })

  const excavators = computed(() => catalog.excavators)
  const buckets = computed(() => catalog.buckets)
  const teeth = computed(() => catalog.teeth)

  const selectedExcavator = computed<Excavator>(() => {
    return catalog.excavators.find((item) => item.id === selectedExcavatorId.value) ?? catalog.excavators[0]
  })

  const compatibleBuckets = computed<Bucket[]>(() => {
    return catalog.buckets.filter((bucket) => {
      return selectedExcavator.value.compatibleBucketIds.includes(bucket.id)
    })
  })

  const selectedBucket = computed<Bucket>(() => {
    const current = compatibleBuckets.value.find((item) => item.id === selectedBucketId.value)
    return current ?? compatibleBuckets.value[0] ?? catalog.buckets[0]
  })

  const compatibilityRule = computed(() => {
    return catalog.compatibility.find((rule) => {
      return rule.excavatorId === selectedExcavator.value.id && rule.bucketId === selectedBucket.value.id
    })
  })

  const compatibleTeeth = computed<Tooth[]>(() => {
    const ruleToothIds = compatibilityRule.value?.toothIds ?? selectedBucket.value.compatibleToothIds

    return catalog.teeth.filter((tooth) => {
      return ruleToothIds.includes(tooth.id) && tooth.compatibleBucketIds.includes(selectedBucket.value.id)
    })
  })

  const selectedTooth = computed<Tooth>(() => {
    const current = compatibleTeeth.value.find((item) => item.id === selectedToothId.value)
    return current ?? compatibleTeeth.value[0] ?? catalog.teeth[0]
  })

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
      selectedBucketId.value = compatibleBuckets.value[0]?.id ?? catalog.buckets[0].id
    }

    if (!compatibleTeeth.value.some((tooth) => tooth.id === selectedToothId.value)) {
      selectedToothId.value = compatibleTeeth.value[0]?.id ?? catalog.teeth[0].id
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
    layerAdjustments.value[part] = {
      ...layerAdjustments.value[part],
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
    layerAdjustments.value[part] = cloneDefaultAdjustment()
  }

  function resetAllLayerAdjustments() {
    layerAdjustments.value = {
      excavator: cloneDefaultAdjustment(),
      bucket: cloneDefaultAdjustment(),
      tooth: cloneDefaultAdjustment(),
    }
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
    selectedExcavatorId.value = catalog.defaults.excavatorId
    selectedBucketId.value = catalog.defaults.bucketId
    selectedToothId.value = catalog.defaults.toothId
    highlightedPart.value = 'tooth'
    resetView()
    resetAllLayerAdjustments()
    ensureCompatibleSelection()
  }

  ensureCompatibleSelection()

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
      layerAdjustments,
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
        layerAdjustments: layerAdjustments.value,
      }

      window.localStorage.setItem(storageKey, JSON.stringify(nextState))
    },
    { deep: true },
  )

  return {
    catalog,
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
    setLayerTilt,
    resetLayerAdjustment,
    resetAllLayerAdjustments,
    zoomIn,
    zoomOut,
    setScale,
    setPan,
    nudgePan,
    resetView,
    toggleShowcaseView,
    restoreDefaultCombination,
  }
})

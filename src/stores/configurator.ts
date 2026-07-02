import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import catalogJson from '../data/products.json'
import type { Bucket, Excavator, ProductCatalog, Tooth } from '../types/product'

const catalog = catalogJson as ProductCatalog

export type HighlightPart = 'excavator' | 'bucket' | 'tooth'

export const useConfiguratorStore = defineStore('configurator', () => {
  const selectedExcavatorId = ref(catalog.defaults.excavatorId)
  const selectedBucketId = ref(catalog.defaults.bucketId)
  const selectedToothId = ref(catalog.defaults.toothId)
  const highlightedPart = ref<HighlightPart>('tooth')
  const scale = ref(0.9)
  const panX = ref(0)
  const panY = ref(0)

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

  function restoreDefaultCombination() {
    selectedExcavatorId.value = catalog.defaults.excavatorId
    selectedBucketId.value = catalog.defaults.bucketId
    selectedToothId.value = catalog.defaults.toothId
    highlightedPart.value = 'tooth'
    resetView()
    ensureCompatibleSelection()
  }

  ensureCompatibleSelection()

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
    selectedExcavator,
    selectedBucket,
    selectedTooth,
    compatibleBuckets,
    compatibleTeeth,
    combinationCode,
    fitmentSummary,
    remarkSummary,
    selectExcavator,
    selectBucket,
    selectTooth,
    setHighlightedPart,
    zoomIn,
    zoomOut,
    setScale,
    setPan,
    nudgePan,
    resetView,
    restoreDefaultCombination,
  }
})

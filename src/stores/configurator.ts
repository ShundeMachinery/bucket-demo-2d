import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { productCatalog } from '../catalog/directusCatalog'
import { buildFitmentCandidates, commonFitmentGroups as findCommonFitmentGroups } from '../catalog/fitmentBuilder'
import {
  normalizePage,
  normalizeProductIds,
  parseConfiguratorQueryState,
  resolveInitialConfiguratorState,
  serializeConfiguratorQueryState,
} from '../services/configuratorQueryState'
import type {
  DirectusDataSourceStatus,
  FitmentGroup,
  Product,
  ProductCategory,
} from '../types/product'

const storageKey = 'bucket-demo-2d:directus-fitment:v1'
const productPageSize = 24

type PersistedState = {
  selectedProductIds?: string[]
  search?: string
  selectedCategoryId?: string | null
  productPage?: number
}

function readPersistedState(): PersistedState {
  if (typeof window === 'undefined') return {}

  try {
    const raw = window.localStorage.getItem(storageKey)
    return raw ? (JSON.parse(raw) as PersistedState) : {}
  } catch {
    return {}
  }
}

function persistState(state: PersistedState): void {
  if (typeof window === 'undefined') return

  window.localStorage.setItem(storageKey, JSON.stringify(state))
}

function emptyDataSourceStatus(): DirectusDataSourceStatus {
  return {
    products: 0,
    categories: 0,
    fitmentGroups: 0,
  }
}

function readInitialQueryState() {
  if (typeof window === 'undefined') {
    return parseConfiguratorQueryState('')
  }

  return parseConfiguratorQueryState(window.location.search)
}

function isConfiguratorPath(): boolean {
  if (typeof window === 'undefined') return false

  const normalizedPath = window.location.pathname.replace(/\/+$/, '') || '/'
  return !normalizedPath.endsWith('/data')
}

export const useConfiguratorStore = defineStore('configurator', () => {
  const persisted = readPersistedState()
  const initialQueryState = readInitialQueryState()
  const initialState = resolveInitialConfiguratorState(initialQueryState, persisted)

  const categories = ref<ProductCategory[]>([])
  const products = ref<Product[]>([])
  const initialTotalCount = ref(0)
  const selectedProductIds = ref<string[]>(normalizeProductIds(initialState.selectedProductIds))
  const selectedProducts = ref<Product[]>([])
  const baseFitmentGroups = ref<FitmentGroup[]>([])
  const search = ref(initialState.search ?? '')
  const selectedCategoryId = ref(initialState.selectedCategoryId ?? null)
  const productPage = ref(normalizePage(initialState.productPage))
  const dataSourceStatus = ref<DirectusDataSourceStatus>(emptyDataSourceStatus())
  const isInitialized = ref(false)
  const isDataSourceLoading = ref(false)
  const isCategoryLoading = ref(false)
  const isProductLoading = ref(false)
  const isFitmentLoading = ref(false)
  const dataSourceError = ref<string | null>(null)
  const productError = ref<string | null>(null)
  const fitmentError = ref<string | null>(null)

  let productRequestId = 0
  let fitmentRequestId = 0
  let isApplyingUrlState = false
  let urlSyncTimer: ReturnType<typeof setTimeout> | null = null

  const hasSelection = computed(() => selectedProductIds.value.length > 0)
  const productTotalPages = computed(() => Math.max(1, Math.ceil(initialTotalCount.value / productPageSize)))
  const activeCategory = computed(() => categories.value.find((category) => category.id === selectedCategoryId.value))
  const commonFitmentGroups = computed(() => findCommonFitmentGroups(baseFitmentGroups.value, selectedProductIds.value))
  const candidateProducts = computed(() => (
    buildFitmentCandidates(
      commonFitmentGroups.value,
      selectedProductIds.value,
      search.value,
      selectedCategoryId.value,
    )
  ))
  const activeProducts = computed(() => (
    hasSelection.value ? candidateProducts.value.map((candidate) => candidate.product) : products.value
  ))
  const activeResultCount = computed(() => (
    hasSelection.value ? candidateProducts.value.length : initialTotalCount.value
  ))
  const isBusy = computed(() => (
    isDataSourceLoading.value || isCategoryLoading.value || isProductLoading.value || isFitmentLoading.value
  ))
  const selectionCode = computed(() => (
    selectedProducts.value.length
      ? selectedProducts.value.map((product) => product.sku).join(' / ')
      : '尚未选择产品'
  ))
  const fitmentSummary = computed(() => {
    if (!hasSelection.value) {
      return '先从左侧选择任意产品，系统会按共同适配组继续推荐可组合产品。'
    }

    if (commonFitmentGroups.value.length === 0) {
      return '当前已选产品暂无共同适配组。'
    }

    return `当前选择命中 ${commonFitmentGroups.value.length} 个共同适配组，可继续选择 ${candidateProducts.value.length} 个候选产品。`
  })

  async function initialize(): Promise<void> {
    if (isInitialized.value) return

    isInitialized.value = true
    await Promise.all([
      loadCategories(),
      loadDataSourceStatus(),
      loadInitialProducts(),
      refreshFitmentGroups(),
    ])
  }

  async function loadCategories(): Promise<void> {
    isCategoryLoading.value = true
    try {
      categories.value = await productCatalog.listCategories()
    } catch (error) {
      dataSourceError.value = error instanceof Error ? error.message : '无法加载分类'
      categories.value = []
    } finally {
      isCategoryLoading.value = false
    }
  }

  async function loadDataSourceStatus(): Promise<void> {
    isDataSourceLoading.value = true
    dataSourceError.value = null
    try {
      dataSourceStatus.value = await productCatalog.getDataSourceStatus()
    } catch (error) {
      dataSourceError.value = error instanceof Error ? error.message : '无法连接 Directus'
      dataSourceStatus.value = emptyDataSourceStatus()
    } finally {
      isDataSourceLoading.value = false
    }
  }

  async function loadInitialProducts(): Promise<void> {
    const requestId = ++productRequestId
    isProductLoading.value = true
    productError.value = null

    try {
      const result = await productCatalog.searchProducts({
        search: search.value,
        categoryId: selectedCategoryId.value,
        page: productPage.value,
        limit: productPageSize,
      })

      if (requestId !== productRequestId) {
        return
      }

      products.value = result.products
      initialTotalCount.value = result.filterCount

      if (result.products.length === 0 && result.filterCount > 0 && productPage.value > productTotalPages.value) {
        productPage.value = productTotalPages.value
      }
    } catch (error) {
      if (requestId === productRequestId) {
        products.value = []
        initialTotalCount.value = 0
        productError.value = error instanceof Error ? error.message : '无法加载产品'
      }
    } finally {
      if (requestId === productRequestId) {
        isProductLoading.value = false
      }
    }
  }

  async function refreshFitmentGroups(): Promise<void> {
    const requestId = ++fitmentRequestId

    if (!hasSelection.value) {
      selectedProducts.value = []
      baseFitmentGroups.value = []
      fitmentError.value = null
      isFitmentLoading.value = false
      return
    }

    isFitmentLoading.value = true
    fitmentError.value = null

    try {
      const [productRecords, fitmentGroups] = await Promise.all([
        Promise.all(selectedProductIds.value.map((productId) => productCatalog.getProduct(productId))),
        productCatalog.listFitmentGroupsForProduct(selectedProductIds.value[0]),
      ])

      if (requestId !== fitmentRequestId) {
        return
      }

      selectedProducts.value = productRecords
      baseFitmentGroups.value = fitmentGroups
    } catch (error) {
      if (requestId === fitmentRequestId) {
        selectedProducts.value = []
        baseFitmentGroups.value = []
        fitmentError.value = error instanceof Error ? error.message : '无法加载适配组'
      }
    } finally {
      if (requestId === fitmentRequestId) {
        isFitmentLoading.value = false
      }
    }
  }

  function selectProduct(productId: string): void {
    if (selectedProductIds.value.includes(productId)) {
      return
    }

    selectedProductIds.value = [...selectedProductIds.value, productId]
    productPage.value = 1
  }

  function removeSelectedProduct(productId: string): void {
    selectedProductIds.value = selectedProductIds.value.filter((id) => id !== productId)
    productPage.value = 1
  }

  function removeSelectedProducts(productIds: string[]): void {
    const removedIds = new Set(productIds)
    if (removedIds.size === 0) return

    selectedProductIds.value = selectedProductIds.value.filter((id) => !removedIds.has(id))
    productPage.value = 1
  }

  function resetSelection(): void {
    selectedProductIds.value = []
    selectedProducts.value = []
    baseFitmentGroups.value = []
    productPage.value = 1
  }

  function setSearch(value: string): void {
    search.value = value
    productPage.value = 1
  }

  function setCategory(categoryId: string | null): void {
    selectedCategoryId.value = categoryId
    productPage.value = 1
  }

  function setProductPage(page: number): void {
    productPage.value = Math.min(productTotalPages.value, Math.max(1, Math.round(page)))
  }

  function applyUrlState(): void {
    const parsed = readInitialQueryState()
    if (!parsed.hasQueryState) return

    isApplyingUrlState = true
    selectedProductIds.value = normalizeProductIds(parsed.state.selectedProductIds)
    search.value = parsed.state.search ?? ''
    selectedCategoryId.value = parsed.state.selectedCategoryId ?? null
    productPage.value = normalizePage(parsed.state.productPage)
    isApplyingUrlState = false
  }

  function scheduleUrlStateSync(): void {
    if (isApplyingUrlState || !isConfiguratorPath()) return

    if (urlSyncTimer) {
      clearTimeout(urlSyncTimer)
    }

    urlSyncTimer = setTimeout(() => {
      urlSyncTimer = null
      syncUrlState()
    }, 120)
  }

  function syncUrlState(): void {
    if (typeof window === 'undefined' || !isConfiguratorPath()) return

    const params = serializeConfiguratorQueryState({
      selectedProductIds: selectedProductIds.value,
      search: search.value,
      selectedCategoryId: selectedCategoryId.value,
      productPage: productPage.value,
    })
    const query = params.toString()
    const nextUrl = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`

    if (nextUrl !== currentUrl) {
      window.history.replaceState(window.history.state, document.title, nextUrl)
    }
  }

  watch(
    [selectedProductIds, search, selectedCategoryId, productPage],
    () => {
      persistState({
        selectedProductIds: selectedProductIds.value,
        search: search.value,
        selectedCategoryId: selectedCategoryId.value,
        productPage: productPage.value,
      })
      scheduleUrlStateSync()
    },
    { deep: true },
  )

  watch(
    selectedProductIds,
    () => {
      void refreshFitmentGroups()

      if (!hasSelection.value) {
        void loadInitialProducts()
      }
    },
  )

  watch(
    [search, selectedCategoryId, productPage],
    () => {
      if (!hasSelection.value) {
        void loadInitialProducts()
      }
    },
  )

  if (typeof window !== 'undefined') {
    window.addEventListener('popstate', applyUrlState)
  }

  void initialize()
  scheduleUrlStateSync()

  return {
    categories,
    products,
    selectedProductIds,
    selectedProducts,
    baseFitmentGroups,
    commonFitmentGroups,
    candidateProducts,
    activeProducts,
    activeCategory,
    activeResultCount,
    initialTotalCount,
    productPage,
    productPageSize,
    productTotalPages,
    search,
    selectedCategoryId,
    dataSourceStatus,
    isInitialized,
    isDataSourceLoading,
    isCategoryLoading,
    isProductLoading,
    isFitmentLoading,
    isBusy,
    dataSourceError,
    productError,
    fitmentError,
    hasSelection,
    selectionCode,
    fitmentSummary,
    initialize,
    loadInitialProducts,
    loadDataSourceStatus,
    selectProduct,
    removeSelectedProduct,
    removeSelectedProducts,
    resetSelection,
    refreshFitmentGroups,
    setSearch,
    setCategory,
    setProductPage,
  }
})

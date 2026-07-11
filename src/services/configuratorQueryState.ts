export type ConfiguratorQueryState = {
  selectedProductIds: string[]
  search: string
  selectedCategoryId: string | null
  productPage: number
}

export type ParsedConfiguratorQueryState = {
  hasQueryState: boolean
  state: Partial<ConfiguratorQueryState>
}

const queryKeys = ['p', 'q', 'cat', 'page'] as const

export function parseConfiguratorQueryState(
  input: string | URLSearchParams,
): ParsedConfiguratorQueryState {
  const params = typeof input === 'string'
    ? new URLSearchParams(input.startsWith('?') ? input.slice(1) : input)
    : input

  const hasQueryState = queryKeys.some((key) => params.has(key))
  const productIds = parseProductIds(params.get('p'))
  const page = parsePage(params.get('page'))
  const search = params.get('q')
  const categoryId = params.get('cat')

  const state: Partial<ConfiguratorQueryState> = {}

  if (params.has('p')) {
    state.selectedProductIds = productIds
  }

  if (params.has('q')) {
    state.search = search?.trim() ?? ''
  }

  if (params.has('cat')) {
    state.selectedCategoryId = categoryId?.trim() || null
  }

  if (params.has('page')) {
    state.productPage = page
  }

  return {
    hasQueryState,
    state,
  }
}

export function serializeConfiguratorQueryState(
  state: ConfiguratorQueryState,
): URLSearchParams {
  const params = new URLSearchParams()
  const productIds = normalizeProductIds(state.selectedProductIds)
  const search = state.search.trim()
  const categoryId = state.selectedCategoryId?.trim()
  const productPage = normalizePage(state.productPage)

  if (productIds.length > 0) {
    params.set('p', productIds.join(','))
  }

  if (search) {
    params.set('q', search)
  }

  if (categoryId) {
    params.set('cat', categoryId)
  }

  if (productPage > 1) {
    params.set('page', String(productPage))
  }

  return params
}

export function resolveInitialConfiguratorState(
  queryState: ParsedConfiguratorQueryState,
  persistedState: Partial<ConfiguratorQueryState> = {},
): ConfiguratorQueryState {
  const source = queryState.hasQueryState ? queryState.state : persistedState

  return {
    selectedProductIds: normalizeProductIds(source.selectedProductIds),
    search: source.search ?? '',
    selectedCategoryId: source.selectedCategoryId ?? null,
    productPage: normalizePage(source.productPage),
  }
}

export function normalizeProductIds(productIds: string[] | undefined): string[] {
  if (!Array.isArray(productIds)) return []

  return [...new Set(productIds.map((id) => id.trim()).filter(Boolean))]
}

export function normalizePage(value: unknown): number {
  const numberValue = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numberValue)) return 1

  return Math.max(1, Math.round(numberValue))
}

function parseProductIds(value: string | null): string[] {
  if (!value) return []

  return normalizeProductIds(value.split(','))
}

function parsePage(value: string | null): number {
  if (!value) return 1

  return normalizePage(value)
}

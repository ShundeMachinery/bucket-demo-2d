export type ProductCategory = {
  id: string
  code: string
  label: string
  description?: string
}

export type ProductSummary = {
  id: string
  sku: string
  name: string
  categoryId?: string
  categoryLabel?: string
  categoryCode?: string
  oemNumber?: string
  externalWeightKg?: number
  imageUrl?: string
}

export type Product = ProductSummary & {
  category?: ProductCategory
  description?: string
  aliases: string[]
  weighingDate?: string
  updatedAt?: string
}

export type FitmentGroupItem = {
  id: string
  categoryLabel: string
  product: ProductSummary
}

export type FitmentGroup = {
  id: string
  code: string
  name: string
  description?: string
  items: FitmentGroupItem[]
}

export type FitmentCandidate = {
  product: ProductSummary
  categoryLabels: string[]
  groupIds: string[]
  groupCodes: string[]
  groupNames: string[]
}

export type ProductSearchParams = {
  search: string
  categoryId: string | null
  page: number
  limit: number
}

export type ProductSearchResult = {
  products: Product[]
  filterCount: number
  totalCount?: number
}

export type FitmentGroupSearchParams = {
  search: string
  page: number
  limit: number
}

export type FitmentGroupSearchResult = {
  groups: FitmentGroup[]
  filterCount: number
  totalCount?: number
}

export type DirectusDataSourceStatus = {
  products: number
  categories: number
  fitmentGroups: number
}

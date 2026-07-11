import { directusAssetUrl, readItem, readItems } from '../services/directus'
import type { DirectusQuery } from '../services/directus'
import type {
  DirectusDataSourceStatus,
  FitmentGroup,
  FitmentGroupItem,
  FitmentGroupSearchParams,
  FitmentGroupSearchResult,
  Product,
  ProductCategory,
  ProductSearchParams,
  ProductSearchResult,
  ProductSummary,
} from '../types/product'

type DirectusRelation<T> = string | T | null

export type DirectusCategory = {
  id: string
  name: string
  description: string | null
}

export type DirectusProductAlias = {
  alias: string
}

export type DirectusFile = {
  id: string
  type: string | null
  title: string | null
  width: number | null
  height: number | null
}

export type DirectusProduct = {
  id: string
  sku: string | null
  category_id: DirectusRelation<DirectusCategory>
  original_name: string | null
  actual_weight_kg?: number | null
  external_weight_kg: number | null
  weighing_date: string | null
  description: string | null
  updated_at: string | null
  oem_number: string | null
  primary_image_id: DirectusRelation<DirectusFile>
  aliases: Array<string | DirectusProductAlias> | null
}

export type DirectusFitmentGroupItem = {
  id: string
  group_id: DirectusRelation<DirectusFitmentGroup>
  product_id: DirectusRelation<DirectusProduct>
}

export type DirectusFitmentGroup = {
  id: string
  code: string | null
  name: string | null
  description: string | null
  items: Array<string | DirectusFitmentGroupItem> | null
}

export type ProductCatalog = {
  listCategories: () => Promise<ProductCategory[]>
  searchProducts: (params: ProductSearchParams) => Promise<ProductSearchResult>
  getProduct: (productId: string) => Promise<Product>
  searchFitmentGroups: (params: FitmentGroupSearchParams) => Promise<FitmentGroupSearchResult>
  listFitmentGroupsForProduct: (productId: string) => Promise<FitmentGroup[]>
  getDataSourceStatus: () => Promise<DirectusDataSourceStatus>
}

const productListFields = [
  'id',
  'sku',
  'original_name',
  'oem_number',
  'external_weight_kg',
  'weighing_date',
  'description',
  'updated_at',
  'category_id.id',
  'category_id.name',
  'category_id.description',
  'primary_image_id.id',
  'primary_image_id.type',
  'primary_image_id.title',
  'primary_image_id.width',
  'primary_image_id.height',
  'aliases.alias',
].join(',')

const fitmentGroupFields = [
  'id',
  'code',
  'name',
  'description',
  'items.id',
  'items.product_id.id',
  'items.product_id.sku',
  'items.product_id.original_name',
  'items.product_id.oem_number',
  'items.product_id.external_weight_kg',
  'items.product_id.weighing_date',
  'items.product_id.description',
  'items.product_id.updated_at',
  'items.product_id.category_id.id',
  'items.product_id.category_id.name',
  'items.product_id.category_id.description',
  'items.product_id.primary_image_id.id',
  'items.product_id.primary_image_id.type',
  'items.product_id.primary_image_id.title',
  'items.product_id.primary_image_id.width',
  'items.product_id.primary_image_id.height',
].join(',')

export function createDirectusProductCatalog(): ProductCatalog {
  return {
    async listCategories() {
      const response = await readItems<DirectusCategory>('categories', {
        fields: 'id,name,description',
        limit: 100,
        sort: 'name',
      })

      return response.data.map(mapCategory)
    },

    async searchProducts(params) {
      const query: DirectusQuery = {
        fields: productListFields,
        limit: params.limit,
        page: params.page,
        meta: 'filter_count,total_count',
        sort: 'sku',
      }

      const search = params.search.trim()
      if (search) {
        query.search = search
      }

      if (params.categoryId) {
        query.filter = {
          category_id: {
            _eq: params.categoryId,
          },
        }
      }

      const response = await readItems<DirectusProduct>('products', query)

      return {
        products: response.data.map(mapProduct),
        filterCount: response.meta?.filter_count ?? response.data.length,
        totalCount: response.meta?.total_count,
      }
    },

    async getProduct(productId) {
      const response = await readItem<DirectusProduct>('products', productId, {
        fields: productListFields,
      })

      return mapProduct(response.data)
    },

    async searchFitmentGroups(params) {
      const query: DirectusQuery = {
        fields: fitmentGroupFields,
        limit: params.limit,
        page: params.page,
        meta: 'filter_count,total_count',
        sort: 'code',
      }

      const search = params.search.trim()
      if (search) {
        query.filter = buildFitmentGroupSearchFilter(search)
      }

      const response = await readItems<DirectusFitmentGroup>('product_fitment_groups', query)

      return {
        groups: response.data.map(mapFitmentGroup),
        filterCount: response.meta?.filter_count ?? response.data.length,
        totalCount: response.meta?.total_count,
      }
    },

    async listFitmentGroupsForProduct(productId) {
      const membershipResponse = await readItems<DirectusFitmentGroupItem>(
        'product_fitment_group_items',
        {
          fields: 'group_id',
          limit: 500,
          filter: {
            product_id: {
              _eq: productId,
            },
          },
        },
      )

      const groupIds = [
        ...new Set(
          membershipResponse.data
            .map((item) => getRelationId(item.group_id))
            .filter((groupId): groupId is string => Boolean(groupId)),
        ),
      ]

      if (groupIds.length === 0) {
        return []
      }

      const groupResponse = await readItems<DirectusFitmentGroup>('product_fitment_groups', {
        fields: fitmentGroupFields,
        limit: groupIds.length,
        sort: 'code',
        filter: {
          id: {
            _in: groupIds,
          },
        },
      })

      return groupResponse.data.map(mapFitmentGroup)
    },

    async getDataSourceStatus() {
      const [products, categories, fitmentGroups] = await Promise.all([
        readCollectionCount('products'),
        readCollectionCount('categories'),
        readCollectionCount('product_fitment_groups'),
      ])

      return {
        products,
        categories,
        fitmentGroups,
      }
    },
  }
}

export const productCatalog = createDirectusProductCatalog()

export function mapProduct(record: DirectusProduct): Product {
  const category = mapCategoryRelation(record.category_id)
  const summary = mapProductSummary(record)

  return {
    ...summary,
    category,
    description: htmlToText(record.description),
    aliases: mapAliases(record.aliases),
    weighingDate: stringOrUndefined(record.weighing_date),
    updatedAt: stringOrUndefined(record.updated_at),
  }
}

export function mapFitmentGroup(record: DirectusFitmentGroup): FitmentGroup {
  return {
    id: record.id,
    code: stringOrUndefined(record.code) ?? 'NO-CODE',
    name: stringOrUndefined(record.name) ?? stringOrUndefined(record.code) ?? '未命名适配组',
    description: htmlToText(record.description),
    items: mapFitmentItems(record.items),
  }
}

export function htmlToText(value: string | null): string | undefined {
  if (!value) {
    return undefined
  }

  if (typeof DOMParser !== 'undefined') {
    const document = new DOMParser().parseFromString(value, 'text/html')
    const text = document.body.textContent?.replace(/\s+/g, ' ').trim()
    return text || undefined
  }

  const fallbackText = value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  return fallbackText || undefined
}

function mapProductSummary(record: DirectusProduct): ProductSummary {
  const category = mapCategoryRelation(record.category_id)
  const sku = stringOrUndefined(record.sku) ?? '未设置 SKU'
  const name = stringOrUndefined(record.original_name) ?? stringOrUndefined(record.oem_number) ?? sku

  return {
    id: record.id,
    sku,
    name,
    categoryId: category?.id,
    categoryLabel: category?.label,
    categoryCode: category?.code,
    oemNumber: stringOrUndefined(record.oem_number),
    externalWeightKg: numberOrUndefined(record.external_weight_kg),
    imageUrl: mapProductImageUrl(record.primary_image_id),
  }
}

function mapProductSummaryRelation(record: DirectusRelation<DirectusProduct>): ProductSummary | null {
  if (!record || typeof record === 'string') {
    return null
  }

  return mapProductSummary(record)
}

function mapCategoryRelation(record: DirectusRelation<DirectusCategory>): ProductCategory | undefined {
  if (!record || typeof record === 'string') {
    return undefined
  }

  return mapCategory(record)
}

function mapCategory(record: DirectusCategory): ProductCategory {
  const description = htmlToText(record.description)

  return {
    id: record.id,
    code: record.name,
    label: description ?? humanizeCategoryCode(record.name),
    description,
  }
}

function mapFitmentItems(records: Array<string | DirectusFitmentGroupItem> | null): FitmentGroupItem[] {
  if (!records) {
    return []
  }

  return records
    .map((record) => {
      if (typeof record === 'string') {
        return null
      }

      const product = mapProductSummaryRelation(record.product_id)
      if (!product) {
        return null
      }

      return {
        id: record.id,
        categoryLabel: product.categoryLabel ?? product.categoryCode ?? '未分类',
        product,
      }
    })
    .filter((item): item is FitmentGroupItem => item !== null)
}

function buildFitmentGroupSearchFilter(search: string): DirectusQuery {
  const contains = { _icontains: search }

  return {
    _or: [
      { code: contains },
      { name: contains },
      { description: contains },
      { items: { product_id: { sku: contains } } },
      { items: { product_id: { original_name: contains } } },
      { items: { product_id: { oem_number: contains } } },
      { items: { product_id: { category_id: { name: contains } } } },
      { items: { product_id: { category_id: { description: contains } } } },
    ],
  }
}

function mapAliases(records: Array<string | DirectusProductAlias> | null): string[] {
  if (!records) {
    return []
  }

  return records
    .map((record) => (typeof record === 'string' ? null : stringOrUndefined(record.alias)))
    .filter((alias): alias is string => Boolean(alias))
}

function mapProductImageUrl(record: DirectusRelation<DirectusFile>): string | undefined {
  const fileId = getImageFileId(record)

  if (!fileId) {
    return undefined
  }

  return directusAssetUrl(fileId, {
    width: 640,
    height: 480,
    fit: 'cover',
    quality: 78,
  })
}

function getImageFileId(record: DirectusRelation<DirectusFile>): string | null {
  if (!record) {
    return null
  }

  if (typeof record === 'string') {
    return record
  }

  if (record.type && !record.type.startsWith('image/')) {
    return null
  }

  return record.id
}

function getRelationId<T extends { id: string }>(record: DirectusRelation<T>): string | null {
  if (!record) {
    return null
  }

  return typeof record === 'string' ? record : record.id
}

function stringOrUndefined(value: string | null): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

function numberOrUndefined(value: number | null): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function humanizeCategoryCode(code: string): string {
  const knownLabels: Record<string, string> = {
    adapter: '齿座',
    bucket_tooth: '斗齿',
    bucket_tooth_pin: '斗齿销',
    side_cutter: '边刀',
  }

  return knownLabels[code] ?? code.replaceAll('_', ' ')
}

async function readCollectionCount(collection: string): Promise<number> {
  const response = await readItems<Record<string, unknown>>(collection, {
    fields: 'id',
    limit: 1,
    meta: 'total_count',
  })

  return response.meta?.total_count ?? response.data.length
}

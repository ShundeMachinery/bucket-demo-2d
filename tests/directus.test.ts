import { describe, expect, test } from 'bun:test'
import {
  htmlToText,
  mapFitmentGroup,
  mapProduct,
  type DirectusFitmentGroup,
  type DirectusProduct,
} from '../src/catalog/directusCatalog'
import { buildFitmentCandidates, commonFitmentGroups } from '../src/catalog/fitmentBuilder'
import { directusAssetUrl, serializeDirectusParams } from '../src/services/directus'
import type { FitmentGroup, ProductSummary } from '../src/types/product'

describe('Directus query serialization', () => {
  test('serializes fields, filters, metadata, and sort arrays', () => {
    const params = new URLSearchParams(
      serializeDirectusParams({
        fields: ['id', 'sku'],
        filter: {
          id: {
            _in: ['a', 'b'],
          },
          category_id: {
            _eq: 'category-1',
          },
        },
        meta: 'filter_count,total_count',
        sort: ['sku', '-updated_at'],
      }),
    )

    expect(params.get('fields')).toBe('id,sku')
    expect(params.get('filter[id][_in]')).toBe('a,b')
    expect(params.get('filter[category_id][_eq]')).toBe('category-1')
    expect(params.get('meta')).toBe('filter_count,total_count')
    expect(params.get('sort')).toBe('sku,-updated_at')
  })
})

describe('Directus catalog mappers', () => {
  test('maps product fields and strips HTML descriptions', () => {
    const product = mapProduct({
      id: 'product-1',
      sku: 'BT-001',
      external_weight_kg: 12.5,
      weighing_date: '2026-07-01',
      description: '<p>高耐磨 <strong>斗齿</strong></p>',
      updated_at: '2026-07-10T08:00:00.000Z',
      oem_number: 'OEM-9',
      primary_image_id: {
        id: 'file-1',
        type: 'image/png',
        title: 'Product',
        width: 640,
        height: 480,
      },
      aliases: [{ alias: '别名 A' }],
      category_id: {
        id: 'category-1',
        name: 'bucket_tooth',
        description: '<p>斗齿</p>',
      },
    } satisfies DirectusProduct)

    expect(product.name).toBe('OEM-9')
    expect(product.categoryLabel).toBe('斗齿')
    expect(product.description).toBe('高耐磨 斗齿')
    expect(product.aliases).toEqual(['别名 A'])
    expect(product.imageUrl).toBe(directusAssetUrl('file-1', {
      width: 640,
      height: 480,
      fit: 'cover',
      quality: 78,
    }))
  })

  test('maps missing image and fitment item category with stable fallbacks', () => {
    const group = mapFitmentGroup({
      id: 'group-1',
      code: null,
      name: null,
      description: '<p>测试组</p>',
      items: [
        {
          id: 'item-1',
          group_id: 'group-1',
          product_id: {
            id: 'product-1',
            sku: 'AD-001',
            external_weight_kg: null,
            weighing_date: null,
            description: null,
            updated_at: null,
            oem_number: 'OEM-1',
            primary_image_id: null,
            aliases: null,
            category_id: {
              id: 'category-2',
              name: 'adapter',
              description: '<p>齿座</p>',
            },
          },
        },
      ],
    } satisfies DirectusFitmentGroup)

    expect(group.code).toBe('NO-CODE')
    expect(group.name).toBe('未命名适配组')
    expect(group.description).toBe('测试组')
    expect(group.items[0].categoryLabel).toBe('齿座')
    expect(group.items[0].product.name).toBe('OEM-1')
    expect(group.items[0].product.imageUrl).toBeUndefined()
  })

  test('uses the SKU when the OEM number is missing', () => {
    const product = mapProduct({
      id: 'product-without-oem',
      sku: 'BT-002',
      oem_number: null,
      external_weight_kg: null,
      weighing_date: null,
      description: null,
      updated_at: null,
      primary_image_id: null,
      aliases: null,
      category_id: null,
    } satisfies DirectusProduct)

    expect(product.name).toBe('BT-002')
  })

  test('converts HTML to plain text without requiring a browser DOM', () => {
    expect(htmlToText('<div>齿座 <span>组合</span></div>')).toBe('齿座 组合')
  })
})

describe('fitment candidate builder', () => {
  const tooth = product('p-tooth', 'BT-001', '斗齿', 'cat-tooth')
  const adapter = product('p-adapter', 'AD-001', '齿座', 'cat-adapter')
  const sideCutter = product('p-side', 'SC-001', '边刀', 'cat-side')

  const groups: FitmentGroup[] = [
    group('g-1', 'G-001', [
      item('i-1', '斗齿', tooth),
      item('i-2', '齿座', adapter),
    ]),
    group('g-2', 'G-002', [
      item('i-3', '斗齿', tooth),
      item('i-4', '边刀', sideCutter),
    ]),
    group('g-3', 'G-003', [
      item('i-5', '齿座', adapter),
      item('i-6', '边刀', sideCutter),
    ]),
  ]

  test('finds groups shared by every selected product', () => {
    expect(commonFitmentGroups(groups, [])).toEqual([])
    expect(commonFitmentGroups(groups, ['p-tooth']).map((group) => group.code)).toEqual(['G-001', 'G-002'])
    expect(commonFitmentGroups(groups, ['p-tooth', 'p-adapter']).map((group) => group.code)).toEqual(['G-001'])
  })

  test('deduplicates candidates and keeps group context', () => {
    const candidates = buildFitmentCandidates(
      commonFitmentGroups(groups, ['p-tooth']),
      ['p-tooth'],
      '',
    )

    expect(candidates.map((candidate) => candidate.product.id)).toEqual(['p-adapter', 'p-side'])
    expect(candidates[0].categoryLabels).toEqual(['齿座'])
    expect(candidates[0].groupCodes).toEqual(['G-001'])
  })

  test('filters candidates by search and category', () => {
    const sharedGroups = commonFitmentGroups(groups, ['p-tooth'])

    expect(buildFitmentCandidates(sharedGroups, ['p-tooth'], '边刀').map((candidate) => candidate.product.id)).toEqual(['p-side'])
    expect(buildFitmentCandidates(sharedGroups, ['p-tooth'], '', 'cat-adapter').map((candidate) => candidate.product.id)).toEqual(['p-adapter'])
  })
})

function product(id: string, sku: string, name: string, categoryId: string): ProductSummary {
  return {
    id,
    sku,
    name,
    categoryId,
    categoryLabel: categoryId,
    categoryCode: categoryId,
  }
}

function item(id: string, categoryLabel: string, productValue: ProductSummary) {
  return {
    id,
    categoryLabel,
    product: productValue,
  }
}

function group(id: string, code: string, items: ReturnType<typeof item>[]): FitmentGroup {
  return {
    id,
    code,
    name: code,
    items,
  }
}

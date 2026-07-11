import { describe, expect, test } from 'bun:test'
import {
  parseConfiguratorQueryState,
  resolveInitialConfiguratorState,
  serializeConfiguratorQueryState,
} from '../src/services/configuratorQueryState'

describe('configurator query state', () => {
  test('serializes selected products, search, category, and page', () => {
    const params = serializeConfiguratorQueryState({
      selectedProductIds: ['p-1', 'p-2', 'p-1'],
      search: '  斗齿  ',
      selectedCategoryId: 'cat-1',
      productPage: 3,
    })

    expect(params.get('p')).toBe('p-1,p-2')
    expect(params.get('q')).toBe('斗齿')
    expect(params.get('cat')).toBe('cat-1')
    expect(params.get('page')).toBe('3')
  })

  test('omits default empty state from the URL', () => {
    const params = serializeConfiguratorQueryState({
      selectedProductIds: [],
      search: '',
      selectedCategoryId: null,
      productPage: 1,
    })

    expect(params.toString()).toBe('')
  })

  test('parses Chinese search text and normalizes unsafe values', () => {
    const parsed = parseConfiguratorQueryState('?p=a,,b,a&q=%E9%80%82%E9%85%8D&cat=&page=bad')

    expect(parsed.hasQueryState).toBe(true)
    expect(parsed.state).toEqual({
      selectedProductIds: ['a', 'b'],
      search: '适配',
      selectedCategoryId: null,
      productPage: 1,
    })
  })

  test('reports no query state when managed params are absent', () => {
    const parsed = parseConfiguratorQueryState('?utm_source=demo')

    expect(parsed.hasQueryState).toBe(false)
    expect(parsed.state).toEqual({})
  })

  test('uses URL state before local browser memory', () => {
    const initial = resolveInitialConfiguratorState(
      parseConfiguratorQueryState('?p=url-1,url-2&q=url&cat=url-cat&page=4'),
      {
        selectedProductIds: ['local-1'],
        search: 'local',
        selectedCategoryId: 'local-cat',
        productPage: 2,
      },
    )

    expect(initial).toEqual({
      selectedProductIds: ['url-1', 'url-2'],
      search: 'url',
      selectedCategoryId: 'url-cat',
      productPage: 4,
    })
  })

  test('falls back to local browser memory when URL has no managed state', () => {
    const initial = resolveInitialConfiguratorState(
      parseConfiguratorQueryState('?utm_source=demo'),
      {
        selectedProductIds: ['local-1'],
        search: 'local',
        selectedCategoryId: 'local-cat',
        productPage: 2,
      },
    )

    expect(initial).toEqual({
      selectedProductIds: ['local-1'],
      search: 'local',
      selectedCategoryId: 'local-cat',
      productPage: 2,
    })
  })
})

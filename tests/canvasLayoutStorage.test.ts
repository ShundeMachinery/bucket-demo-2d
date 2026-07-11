import { describe, expect, test } from 'bun:test'
import {
  canvasLayoutStorageKey,
  persistCanvasLayoutState,
  persistCanvasLayouts,
  persistCanvasViewport,
  readCanvasLayoutState,
  readCanvasLayouts,
  restoreCanvasLayout,
} from '../src/services/canvasLayoutStorage'

class MemoryStorage {
  private items = new Map<string, string>()

  getItem(key: string): string | null {
    return this.items.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.items.set(key, value)
  }
}

describe('canvas layout storage', () => {
  test('persists product layouts and viewport as stage-relative ratios', () => {
    const storage = new MemoryStorage()

    persistCanvasLayoutState(
      {
        productA: {
          x: 200,
          y: 150,
          scaleX: 1.2,
          scaleY: 1.2,
          rotation: 17,
        },
      },
      ['productA'],
      { width: 400, height: 300 },
      { panX: 24, panY: -12, scale: 1.35 },
      storage,
    )

    const saved = readCanvasLayoutState(storage)
    expect(saved.nodes.productA).toEqual({
      xRatio: 0.5,
      yRatio: 0.5,
      scaleX: 1.2,
      scaleY: 1.2,
      rotation: 17,
    })
    expect(saved.viewport).toEqual({
      panX: 24,
      panY: -12,
      scale: 1.35,
    })

    expect(restoreCanvasLayout(saved.nodes, 'productA', { width: 800, height: 600 })).toEqual({
      x: 400,
      y: 300,
      scaleX: 1.2,
      scaleY: 1.2,
      rotation: 17,
    })
  })

  test('keeps layouts for products that are not currently selected', () => {
    const storage = new MemoryStorage()
    storage.setItem(canvasLayoutStorageKey, JSON.stringify({
      nodes: {
        productB: {
          xRatio: 0.25,
          yRatio: 0.75,
          scaleX: 0.8,
          scaleY: 0.8,
          rotation: -12,
        },
      },
      viewport: { panX: 30, panY: 20, scale: 0.8 },
    }))

    const saved = persistCanvasLayouts(
      {
        productA: {
          x: 100,
          y: 100,
          scaleX: 1,
          scaleY: 1,
          rotation: 0,
        },
      },
      ['productA'],
      { width: 200, height: 200 },
      storage,
    )

    expect(saved.productA?.xRatio).toBe(0.5)
    expect(saved.productB).toEqual({
      xRatio: 0.25,
      yRatio: 0.75,
      scaleX: 0.8,
      scaleY: 0.8,
      rotation: -12,
    })
    expect(readCanvasLayoutState(storage).viewport).toEqual({
      panX: 30,
      panY: 20,
      scale: 0.8,
    })
  })

  test('persists viewport without dropping saved product nodes', () => {
    const storage = new MemoryStorage()
    persistCanvasLayouts(
      {
        productA: {
          x: 80,
          y: 60,
          scaleX: 1,
          scaleY: 1,
          rotation: 0,
        },
      },
      ['productA'],
      { width: 160, height: 120 },
      storage,
    )

    const saved = persistCanvasViewport({ panX: -40, panY: 18, scale: 2.2 }, storage)
    expect(saved.nodes.productA).toEqual({
      xRatio: 0.5,
      yRatio: 0.5,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
    })
    expect(saved.viewport).toEqual({
      panX: -40,
      panY: 18,
      scale: 2.2,
    })
  })

  test('supports the old flat node storage format', () => {
    const storage = new MemoryStorage()
    storage.setItem(canvasLayoutStorageKey, JSON.stringify({
      productA: {
        xRatio: 0.25,
        yRatio: 0.4,
        scaleX: 1.1,
        scaleY: 0.7,
        rotation: 9,
      },
    }))

    expect(readCanvasLayoutState(storage)).toEqual({
      nodes: {
        productA: {
          xRatio: 0.25,
          yRatio: 0.4,
          scaleX: 1.1,
          scaleY: 0.7,
          rotation: 9,
        },
      },
      viewport: {
        panX: 0,
        panY: 0,
        scale: 1,
      },
    })
  })

  test('ignores invalid storage and normalizes unsafe node and viewport values', () => {
    const storage = new MemoryStorage()

    storage.setItem(canvasLayoutStorageKey, '{not-json')
    expect(readCanvasLayoutState(storage)).toEqual({
      nodes: {},
      viewport: {
        panX: 0,
        panY: 0,
        scale: 1,
      },
    })

    storage.setItem(canvasLayoutStorageKey, JSON.stringify({
      nodes: {
        bad: {
          xRatio: 2,
          yRatio: -1,
          scaleX: 99,
          scaleY: 'wrong',
          rotation: 13.4,
        },
        skipped: {
          xRatio: '0.3',
          yRatio: 0.3,
        },
      },
      viewport: {
        panX: 10.4,
        panY: Number.NaN,
        scale: 8,
      },
    }))

    expect(readCanvasLayoutState(storage)).toEqual({
      nodes: {
        bad: {
          xRatio: 1.5,
          yRatio: -0.5,
          scaleX: 4,
          scaleY: 1,
          rotation: 13,
        },
      },
      viewport: {
        panX: 10,
        panY: 0,
        scale: 2.5,
      },
    })
    expect(readCanvasLayouts(storage).bad?.scaleX).toBe(4)
  })
})

export type CanvasNodeLayout = {
  x: number
  y: number
  scaleX: number
  scaleY: number
  rotation: number
}

export type StageSize = {
  width: number
  height: number
}

export type CanvasViewportLayout = {
  panX: number
  panY: number
  scale: number
}

export type PersistedCanvasNodeLayout = {
  xRatio: number
  yRatio: number
  scaleX: number
  scaleY: number
  rotation: number
}

export type PersistedCanvasLayoutState = {
  nodes: Record<string, PersistedCanvasNodeLayout>
  viewport: CanvasViewportLayout
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>

const defaultViewport: CanvasViewportLayout = {
  panX: 0,
  panY: 0,
  scale: 1,
}

export const canvasLayoutStorageKey = 'bucket-demo-2d:fitment-canvas-layouts:v1'

export function readCanvasLayoutState(
  storage: Pick<StorageLike, 'getItem'> | null = browserStorage(),
): PersistedCanvasLayoutState {
  if (!storage) return emptyCanvasLayoutState()

  try {
    const raw = storage.getItem(canvasLayoutStorageKey)
    const parsed = raw ? JSON.parse(raw) : null

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return emptyCanvasLayoutState()
    }

    return {
      nodes: normalizePersistedNodes('nodes' in parsed ? parsed.nodes : parsed),
      viewport: normalizeViewport((parsed as Partial<PersistedCanvasLayoutState>).viewport),
    }
  } catch {
    return emptyCanvasLayoutState()
  }
}

export function readCanvasLayouts(
  storage: Pick<StorageLike, 'getItem'> | null = browserStorage(),
): Record<string, PersistedCanvasNodeLayout> {
  return readCanvasLayoutState(storage).nodes
}

export function restoreCanvasLayout(
  layouts: Record<string, PersistedCanvasNodeLayout>,
  productId: string,
  stage: StageSize,
): CanvasNodeLayout | null {
  const saved = layouts[productId]
  if (!saved) return null

  return {
    x: Math.round(saved.xRatio * safeDimension(stage.width)),
    y: Math.round(saved.yRatio * safeDimension(stage.height)),
    scaleX: saved.scaleX,
    scaleY: saved.scaleY,
    rotation: saved.rotation,
  }
}

export function persistCanvasLayoutState(
  layouts: Record<string, CanvasNodeLayout>,
  productIds: string[],
  stage: StageSize,
  viewport: CanvasViewportLayout,
  storage: StorageLike | null = browserStorage(),
): PersistedCanvasLayoutState {
  const next = storage ? readCanvasLayoutState(storage) : emptyCanvasLayoutState()

  for (const productId of productIds) {
    const layout = layouts[productId]
    if (!layout) continue

    next.nodes[productId] = toPersistedCanvasLayout(layout, stage)
  }
  next.viewport = normalizeViewport(viewport)

  writeCanvasLayoutState(next, storage)
  return next
}

export function persistCanvasLayouts(
  layouts: Record<string, CanvasNodeLayout>,
  productIds: string[],
  stage: StageSize,
  storage: StorageLike | null = browserStorage(),
): Record<string, PersistedCanvasNodeLayout> {
  return persistCanvasLayoutState(
    layouts,
    productIds,
    stage,
    readCanvasLayoutState(storage).viewport,
    storage,
  ).nodes
}

export function persistCanvasViewport(
  viewport: CanvasViewportLayout,
  storage: StorageLike | null = browserStorage(),
): PersistedCanvasLayoutState {
  const next = storage ? readCanvasLayoutState(storage) : emptyCanvasLayoutState()
  next.viewport = normalizeViewport(viewport)
  writeCanvasLayoutState(next, storage)
  return next
}

export function toPersistedCanvasLayout(
  layout: CanvasNodeLayout,
  stage: StageSize,
): PersistedCanvasNodeLayout {
  return {
    xRatio: roundRatio(layout.x / safeDimension(stage.width)),
    yRatio: roundRatio(layout.y / safeDimension(stage.height)),
    scaleX: normalizeScale(layout.scaleX),
    scaleY: normalizeScale(layout.scaleY),
    rotation: normalizeRotation(layout.rotation),
  }
}

export function emptyCanvasLayoutState(): PersistedCanvasLayoutState {
  return {
    nodes: {},
    viewport: { ...defaultViewport },
  }
}

function writeCanvasLayoutState(state: PersistedCanvasLayoutState, storage: StorageLike | null): void {
  if (!storage) return

  try {
    storage.setItem(canvasLayoutStorageKey, JSON.stringify(state))
  } catch {
    // Storage can be unavailable in private browsing or quota-constrained contexts.
  }
}

function browserStorage(): StorageLike | null {
  if (typeof window === 'undefined') return null
  return window.localStorage
}

function normalizePersistedNodes(value: unknown): Record<string, PersistedCanvasNodeLayout> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}

  return Object.entries(value).reduce<Record<string, PersistedCanvasNodeLayout>>((layouts, [productId, node]) => {
    const normalized = normalizePersistedLayout(node)
    if (normalized) {
      layouts[productId] = normalized
    }

    return layouts
  }, {})
}

function normalizePersistedLayout(value: unknown): PersistedCanvasNodeLayout | null {
  if (!value || typeof value !== 'object') return null

  const layout = value as Partial<PersistedCanvasNodeLayout>
  if (!isFiniteNumber(layout.xRatio) || !isFiniteNumber(layout.yRatio)) {
    return null
  }

  return {
    xRatio: clamp(layout.xRatio, -0.5, 1.5),
    yRatio: clamp(layout.yRatio, -0.5, 1.5),
    scaleX: normalizeScale(layout.scaleX),
    scaleY: normalizeScale(layout.scaleY),
    rotation: normalizeRotation(layout.rotation),
  }
}

function normalizeViewport(value: unknown): CanvasViewportLayout {
  if (!value || typeof value !== 'object') return { ...defaultViewport }

  const viewport = value as Partial<CanvasViewportLayout>
  return {
    panX: isFiniteNumber(viewport.panX) ? Math.round(viewport.panX) : 0,
    panY: isFiniteNumber(viewport.panY) ? Math.round(viewport.panY) : 0,
    scale: normalizeViewScale(viewport.scale),
  }
}

function normalizeScale(value: unknown): number {
  return isFiniteNumber(value) ? clamp(Number(value.toFixed(2)), 0.1, 4) : 1
}

function normalizeViewScale(value: unknown): number {
  return isFiniteNumber(value) ? clamp(Number(value.toFixed(2)), 0.35, 2.5) : 1
}

function normalizeRotation(value: unknown): number {
  return isFiniteNumber(value) ? Math.round(value) : 0
}

function safeDimension(value: number): number {
  return Math.max(1, value)
}

function roundRatio(value: number): number {
  return Number(value.toFixed(5))
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

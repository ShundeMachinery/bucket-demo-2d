type ViteImportMeta = ImportMeta & {
  env?: Record<string, string | boolean | undefined>
}

type DirectusPrimitive = string | number | boolean | null | undefined

export type DirectusQueryValue =
  | DirectusPrimitive
  | DirectusQueryValue[]
  | { [key: string]: DirectusQueryValue }

export type DirectusQuery = Record<string, DirectusQueryValue>

export type DirectusListResponse<T> = {
  data: T[]
  meta?: {
    filter_count?: number
    total_count?: number
  }
}

export type DirectusItemResponse<T> = {
  data: T
}

export const defaultDirectusUrl = 'http://124.223.157.37:8055'

const env = (import.meta as ViteImportMeta).env

export const directusBaseUrl = String(env?.VITE_DIRECTUS_URL ?? (env?.DEV ? '/directus' : defaultDirectusUrl))

const directusToken = typeof env?.VITE_DIRECTUS_TOKEN === 'string' ? env.VITE_DIRECTUS_TOKEN : ''

export async function readItems<T>(
  collection: string,
  params: DirectusQuery = {},
): Promise<DirectusListResponse<T>> {
  return requestDirectus<DirectusListResponse<T>>(`/items/${collection}`, params)
}

export async function readItem<T>(
  collection: string,
  id: string,
  params: DirectusQuery = {},
): Promise<DirectusItemResponse<T>> {
  return requestDirectus<DirectusItemResponse<T>>(`/items/${collection}/${encodeURIComponent(id)}`, params)
}

export function directusAssetUrl(
  fileId: string,
  params: Record<string, string | number | boolean> = {},
): string {
  const query = serializeDirectusParams(params)
  const path = `${normalizedBaseUrl()}/assets/${encodeURIComponent(fileId)}`

  return query ? `${path}?${query}` : path
}

export function serializeDirectusParams(params: Record<string, unknown>): string {
  const searchParams = new URLSearchParams()

  for (const [key, value] of Object.entries(params)) {
    appendParam(searchParams, key, value)
  }

  return searchParams.toString()
}

async function requestDirectus<T>(path: string, params: DirectusQuery): Promise<T> {
  const response = await fetch(buildDirectusUrl(path, params), {
    headers: requestHeaders(),
  })

  if (!response.ok) {
    const detail = await readErrorDetail(response)
    throw new Error(`Directus 请求失败 (${response.status})${detail ? `：${detail}` : ''}`)
  }

  return response.json() as Promise<T>
}

function buildDirectusUrl(path: string, params: DirectusQuery): string {
  const query = serializeDirectusParams(params)
  const url = `${normalizedBaseUrl()}${path}`

  return query ? `${url}?${query}` : url
}

function normalizedBaseUrl(): string {
  return directusBaseUrl.replace(/\/+$/, '')
}

function requestHeaders(): HeadersInit {
  if (!directusToken) return {}

  return {
    Authorization: `Bearer ${directusToken}`,
  }
}

async function readErrorDetail(response: Response): Promise<string> {
  try {
    const payload = await response.json()
    if (Array.isArray(payload?.errors) && payload.errors[0]?.message) {
      return String(payload.errors[0].message)
    }

    if (payload?.error?.message) {
      return String(payload.error.message)
    }
  } catch {
    return ''
  }

  return ''
}

function appendParam(searchParams: URLSearchParams, key: string, value: unknown): void {
  if (value === undefined || value === null || value === '') {
    return
  }

  if (Array.isArray(value)) {
    if (value.every((entry) => !isRecord(entry))) {
      searchParams.append(key, value.map(String).join(','))
      return
    }

    value.forEach((entry, index) => {
      appendParam(searchParams, `${key}[${index}]`, entry)
    })
    return
  }

  if (isRecord(value)) {
    for (const [childKey, childValue] of Object.entries(value)) {
      appendParam(searchParams, `${key}[${childKey}]`, childValue)
    }
    return
  }

  searchParams.append(key, String(value))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function resolveAssetPath(path: string) {
  if (!path || path.startsWith('data:') || /^https?:\/\//i.test(path)) {
    return path
  }

  const basePath = import.meta.env.BASE_URL
  const normalizedBase = basePath.endsWith('/') ? basePath : `${basePath}/`
  const normalizedPath = path.replace(/^\/+/, '')

  return `${normalizedBase}${normalizedPath}`
}

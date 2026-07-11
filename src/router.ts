import { computed, ref } from 'vue'

export type AppRouteName = 'configurator' | 'data'

export type AppRoute = {
  name: AppRouteName
  path: string
  title: string
}

const routes: Record<AppRouteName, AppRoute> = {
  configurator: {
    name: 'configurator',
    path: '/',
    title: '斗齿装配展示台',
  },
  data: {
    name: 'data',
    path: '/data',
    title: 'Directus 数据源',
  },
}

const appBasePath = import.meta.env.BASE_URL
const currentPath = ref(normalizePath(stripBasePath(window.location.pathname)))

function stripBasePath(path: string) {
  if (appBasePath === '/') return path

  const normalizedBase = appBasePath.replace(/\/+$/, '')
  if (!path.startsWith(normalizedBase)) return path

  return path.slice(normalizedBase.length) || '/'
}

function withBasePath(path: string) {
  const normalizedBase = appBasePath.replace(/\/+$/, '')
  if (!normalizedBase) return path

  return `${normalizedBase}${path}`
}

function normalizePath(path: string) {
  const normalized = path.replace(/\/+$/, '') || '/'

  return normalized === '/data' ? '/data' : '/'
}

function routeFromPath(path: string) {
  return path === routes.data.path ? routes.data : routes.configurator
}

window.addEventListener('popstate', () => {
  currentPath.value = normalizePath(stripBasePath(window.location.pathname))
})

export const currentRoute = computed(() => routeFromPath(currentPath.value))

export function navigateTo(routeName: AppRouteName) {
  const nextRoute = routes[routeName]
  if (currentPath.value === nextRoute.path) return

  window.history.pushState({}, nextRoute.title, withBasePath(nextRoute.path))
  currentPath.value = nextRoute.path
}

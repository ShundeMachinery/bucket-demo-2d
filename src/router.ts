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
    title: '数据包管理',
  },
}

const currentPath = ref(normalizePath(window.location.pathname))

function normalizePath(path: string) {
  const normalized = path.replace(/\/+$/, '') || '/'

  return normalized === '/data' ? '/data' : '/'
}

function routeFromPath(path: string) {
  return path === routes.data.path ? routes.data : routes.configurator
}

window.addEventListener('popstate', () => {
  currentPath.value = normalizePath(window.location.pathname)
})

export const currentRoute = computed(() => routeFromPath(currentPath.value))

export function navigateTo(routeName: AppRouteName) {
  const nextRoute = routes[routeName]
  if (currentPath.value === nextRoute.path) return

  window.history.pushState({}, nextRoute.title, nextRoute.path)
  currentPath.value = nextRoute.path
}

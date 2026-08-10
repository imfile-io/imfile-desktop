/**
 * 共享图标注册表。
 * 使用 globalThis 单例：Vite/Rollup 可能把本模块复制进多个 chunk；
 * 若仅用模块内 const，只调用 registerIcons 的副本会把 `icons[name]=icon`
 * 当成无读死代码删掉，导致 mo-icon 全部空白。
 */
const REGISTRY_KEY = '__IMFILE_ICON_REGISTRY__'

function getRegistry () {
  const g = globalThis
  if (!g[REGISTRY_KEY]) {
    g[REGISTRY_KEY] = Object.create(null)
  }
  return g[REGISTRY_KEY]
}

export function registerIcons (data) {
  const icons = getRegistry()
  for (const name in data) {
    const icon = data[name]

    if (!icon.paths) {
      icon.paths = []
    }
    if (icon.d) {
      icon.paths.push({ d: icon.d })
    }

    if (!icon.polygons) {
      icon.polygons = []
    }
    if (icon.points) {
      icon.polygons.push({ points: icon.points })
    }

    icons[name] = icon
  }
}

export function getIcon (name) {
  return getRegistry()[name]
}

export function hasIcon (name) {
  return name in getRegistry()
}

/** 兼容旧代码读取 Icon.icons；始终指向全局表 */
export const icons = getRegistry()

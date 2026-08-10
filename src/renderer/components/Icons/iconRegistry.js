/** 共享图标注册表，避免 Vite 对 Icon.vue 多实例打包导致 register 与渲染读到不同对象 */
const icons = {}

export function registerIcons (data) {
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
  return icons[name]
}

export function hasIcon (name) {
  return name in icons
}

export { icons }

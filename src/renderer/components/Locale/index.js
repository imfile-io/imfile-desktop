import { getLanguage } from '@shared/locales'

let rendererI18n = null

export function setRendererI18n (i18n) {
  rendererI18n = i18n
}

export function getLocaleManager () {
  return {
    changeLanguage (lng) {
      if (!rendererI18n) {
        return Promise.resolve()
      }
      // Composition API：global.locale 为 WritableComputedRef
      rendererI18n.global.locale.value = lng
      return Promise.resolve()
    },
    changeLanguageByLocale (locale) {
      const lng = getLanguage(locale)
      return this.changeLanguage(lng)
    },
    getI18n () {
      return {
        t: (...args) => {
          if (!rendererI18n) {
            return String(args[0] || '')
          }
          return rendererI18n.global.t(...args)
        }
      }
    }
  }
}

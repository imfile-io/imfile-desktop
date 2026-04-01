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
      const loc = rendererI18n.global.locale
      if (typeof loc === 'object' && loc !== null && 'value' in loc) {
        loc.value = lng
      } else {
        rendererI18n.global.locale = lng
      }
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

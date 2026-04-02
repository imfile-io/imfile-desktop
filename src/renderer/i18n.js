import { createI18n } from 'vue-i18n'
import resources from '@shared/locales/all'
import { getLanguage } from '@shared/locales'

const DEFAULT_LOCALE = 'en-US'

function buildMessages () {
  const messages = {}
  for (const key of Object.keys(resources)) {
    messages[key] = resources[key].translation
  }
  return messages
}

export function createAppI18n (prefLocale) {
  const lng = getLanguage(prefLocale) || DEFAULT_LOCALE
  return createI18n({
    legacy: false,
    locale: lng,
    fallbackLocale: DEFAULT_LOCALE,
    messages: buildMessages(),
    globalInjection: true
  })
}

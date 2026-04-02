import { createI18n } from 'vue-i18n'
import resources from '@shared/locales/all'
import { getLanguage } from '@shared/locales'

function buildMessages () {
  const messages = {}
  for (const key of Object.keys(resources)) {
    messages[key] = resources[key].translation
  }
  return messages
}

export function createAppI18n (prefLocale) {
  const lng = getLanguage(prefLocale) || 'en-US'
  return createI18n({
    legacy: false,
    locale: lng,
    fallbackLocale: 'en-US',
    messages: buildMessages(),
    globalInjection: true
  })
}

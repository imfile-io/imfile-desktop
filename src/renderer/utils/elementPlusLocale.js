import epAr from 'element-plus/es/locale/lang/ar.mjs'
import epBg from 'element-plus/es/locale/lang/bg.mjs'
import epCa from 'element-plus/es/locale/lang/ca.mjs'
import epDe from 'element-plus/es/locale/lang/de.mjs'
import epEl from 'element-plus/es/locale/lang/el.mjs'
import epEn from 'element-plus/es/locale/lang/en.mjs'
import epEs from 'element-plus/es/locale/lang/es.mjs'
import epFa from 'element-plus/es/locale/lang/fa.mjs'
import epFr from 'element-plus/es/locale/lang/fr.mjs'
import epHu from 'element-plus/es/locale/lang/hu.mjs'
import epId from 'element-plus/es/locale/lang/id.mjs'
import epIt from 'element-plus/es/locale/lang/it.mjs'
import epJa from 'element-plus/es/locale/lang/ja.mjs'
import epKo from 'element-plus/es/locale/lang/ko.mjs'
import epNbNo from 'element-plus/es/locale/lang/nb-no.mjs'
import epNl from 'element-plus/es/locale/lang/nl.mjs'
import epPl from 'element-plus/es/locale/lang/pl.mjs'
import epPtBr from 'element-plus/es/locale/lang/pt-br.mjs'
import epRo from 'element-plus/es/locale/lang/ro.mjs'
import epRu from 'element-plus/es/locale/lang/ru.mjs'
import epTh from 'element-plus/es/locale/lang/th.mjs'
import epTr from 'element-plus/es/locale/lang/tr.mjs'
import epUk from 'element-plus/es/locale/lang/uk.mjs'
import epVi from 'element-plus/es/locale/lang/vi.mjs'
import epZhCN from 'element-plus/es/locale/lang/zh-cn.mjs'
import epZhTW from 'element-plus/es/locale/lang/zh-tw.mjs'

const map = {
  ar: epAr,
  bg: epBg,
  ca: epCa,
  de: epDe,
  el: epEl,
  'en-US': epEn,
  es: epEs,
  fa: epFa,
  fr: epFr,
  hu: epHu,
  id: epId,
  it: epIt,
  ja: epJa,
  ko: epKo,
  nb: epNbNo,
  nl: epNl,
  pl: epPl,
  'pt-BR': epPtBr,
  ro: epRo,
  ru: epRu,
  th: epTh,
  tr: epTr,
  uk: epUk,
  vi: epVi,
  'zh-CN': epZhCN,
  'zh-TW': epZhTW
}

export function getElementPlusLocale (lng) {
  return map[lng] || epEn
}

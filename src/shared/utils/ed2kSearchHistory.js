const STORAGE_KEY = 'imfile-ed2k-search-history'
const MAX_ITEMS = 30

const normalizeKey = (s) => (s || '').trim().toLowerCase()

export const loadEd2kSearchHistory = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((x) => typeof x === 'string' && x.trim())
      .map((x) => x.trim())
  } catch {
    return []
  }
}

const persist = (items) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  } catch {
    // ignore quota / private mode
  }
}

/** 成功发起搜索后调用：去重（不区分大小写）、新项在前、截断条数 */
export const addEd2kSearchHistoryItem = (query) => {
  const q = (query || '').trim()
  if (!q) return
  const key = normalizeKey(q)
  let list = loadEd2kSearchHistory().filter((item) => normalizeKey(item) !== key)
  list.unshift(q)
  if (list.length > MAX_ITEMS) {
    list = list.slice(0, MAX_ITEMS)
  }
  persist(list)
}

export const removeEd2kSearchHistoryItem = (query) => {
  const key = normalizeKey(query)
  const list = loadEd2kSearchHistory().filter((item) => normalizeKey(item) !== key)
  persist(list)
}

export const clearEd2kSearchHistory = () => {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

const STORAGE_KEY = 'imfile-ssapi-search-history'
const MAX_ITEMS = 30

const normalizeKey = (s) => (s || '').trim().toLowerCase()

export const loadSsapiSearchHistory = () => {
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
    // ignore
  }
}

export const addSsapiSearchHistoryItem = (query) => {
  const q = (query || '').trim()
  if (!q) return
  const key = normalizeKey(q)
  let list = loadSsapiSearchHistory().filter((item) => normalizeKey(item) !== key)
  list.unshift(q)
  if (list.length > MAX_ITEMS) {
    list = list.slice(0, MAX_ITEMS)
  }
  persist(list)
}

export const removeSsapiSearchHistoryItem = (query) => {
  const key = normalizeKey(query)
  const list = loadSsapiSearchHistory().filter((item) => normalizeKey(item) !== key)
  persist(list)
}

export const clearSsapiSearchHistory = () => {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

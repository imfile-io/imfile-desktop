/**
 * Bitmagnet 只读搜索网关（POST /v1/search）响应解析与磁力链接辅助。
 * 基址由用户偏好提供，本模块不包含任何默认域名。
 */

/**
 * @param {unknown} input
 * @returns {string} 规范化后的 https 根地址（仅 origin），无效则 ''
 */
export function normalizeSsapiBaseUrl (input) {
  const raw = String(input ?? '').trim()
  if (!raw) return ''
  try {
    const u = new URL(raw)
    if (u.protocol !== 'https:') return ''
    return u.origin
  } catch {
    return ''
  }
}

/**
 * @param {string} base normalizeSsapiBaseUrl 的结果
 * @returns {string}
 */
export function buildSsapiSearchUrl (base) {
  const b = normalizeSsapiBaseUrl(base)
  if (!b) return ''
  return `${b}/v1/search`
}

function pickTorrent (item) {
  if (!item || typeof item !== 'object') return null
  const t = item.torrent
  return t && typeof t === 'object' ? t : null
}

/**
 * @param {string} name
 * @param {string} infoHash 40 位 hex（大小写均可）
 * @returns {string}
 */
export function buildMagnetFromInfoHash (name, infoHash) {
  const h = String(infoHash || '').trim().toLowerCase()
  if (!/^[a-f0-9]{40}$/.test(h)) return ''
  const n = String(name || '').trim()
  const dn = n ? `&dn=${encodeURIComponent(n)}` : ''
  return `magnet:?xt=urn:btih:${h}${dn}`
}

/**
 * @param {object} item TorrentContent 形态（字段以 API 实际 JSON 为准）
 * @returns {object|null}
 */
export function normalizeSsapiSearchItem (item) {
  if (!item || typeof item !== 'object') return null
  const torrent = pickTorrent(item)
  const infoHashRaw =
    item.infoHash ??
    item.info_hash ??
    (torrent && torrent.infoHash) ??
    (torrent && torrent.info_hash) ??
    ''
  const hash = String(infoHashRaw).trim().toLowerCase()
  if (!/^[a-f0-9]{40}$/.test(hash)) return null

  const title = item.title
  const tname = torrent && torrent.name
  const name =
    (typeof title === 'string' && title.trim()) ||
    (typeof tname === 'string' && tname.trim()) ||
    hash

  const sizeRaw = torrent && torrent.size != null ? torrent.size : item.size
  const sizeBytes = Number(sizeRaw)
  const sizeBytesSafe = Number.isFinite(sizeBytes) && sizeBytes >= 0 ? sizeBytes : 0

  const seeders = Number(item.seeders ?? (torrent && torrent.seeders))
  const leechers = Number(item.leechers ?? (torrent && torrent.leechers))
  let source = '—'
  if (Number.isFinite(seeders) || Number.isFinite(leechers)) {
    const s = Number.isFinite(seeders) ? seeders : 0
    const l = Number.isFinite(leechers) ? leechers : 0
    source = `${s}/${l}`
  }

  const magnetFromApi =
    torrent && typeof torrent.magnetUri === 'string'
      ? torrent.magnetUri.trim()
      : torrent && typeof torrent.magnet_uri === 'string'
        ? torrent.magnet_uri.trim()
        : ''

  const magnetUri =
    magnetFromApi && magnetFromApi.toLowerCase().startsWith('magnet:')
      ? magnetFromApi
      : buildMagnetFromInfoHash(name, hash)

  return {
    hash,
    name,
    sizeBytes: sizeBytesSafe,
    source,
    magnetUri,
    raw: item
  }
}

/**
 * @param {object} json POST /v1/search 解析后的对象
 * @returns {object} { rows, totalCount, hasNextPage }
 */
export function mapSsapiSearchResponse (json) {
  if (!json || typeof json !== 'object') {
    return { rows: [], totalCount: null, hasNextPage: false }
  }
  const payload = json.data
  const block =
    payload && typeof payload === 'object' && payload.items
      ? payload
      : payload &&
          typeof payload === 'object' &&
          payload.torrentContent &&
          payload.torrentContent.search
        ? payload.torrentContent.search
        : null

  const items = block && Array.isArray(block.items) ? block.items : []
  const rows = items.map(normalizeSsapiSearchItem).filter(Boolean)

  const totalCount =
    block && block.totalCount != null ? Number(block.totalCount) : null
  const hasNextPage = Boolean(block && block.hasNextPage)

  return {
    rows,
    totalCount: Number.isFinite(totalCount) ? totalCount : null,
    hasNextPage
  }
}

/**
 * @param {object} row normalizeSsapiSearchItem 结果
 * @returns {string}
 */
export function getSsapiRowMagnet (row) {
  if (!row || typeof row !== 'object') return ''
  const m = typeof row.magnetUri === 'string' ? row.magnetUri.trim() : ''
  if (m && m.toLowerCase().startsWith('magnet:')) return m
  return buildMagnetFromInfoHash(row.name, row.hash)
}

/**
 * 设置页 / 提交前：空字符串合法；非空须为可解析的 https origin
 * @param {unknown} value
 * @returns {boolean}
 */
export function isValidSsapiBaseUrlOptional (value) {
  const s = String(value ?? '').trim()
  if (!s) return true
  return Boolean(normalizeSsapiBaseUrl(s))
}

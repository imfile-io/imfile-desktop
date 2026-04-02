/**
 * goed2kd SearchDTO.results 项字段兼容（以服务端实际 JSON 为准，可再扩展）。
 */
export function normalizeSearchResult (item) {
  if (!item || typeof item !== 'object') return null
  const name = item.file_name || item.name || item.FileName || ''
  const sizeBytes = Number(item.size ?? item.file_size ?? item.FileSize ?? 0)
  const hashRaw = item.hash || item.file_hash || item.Hash || ''
  const hash = String(hashRaw).toLowerCase().trim()
  if (!hash) return null
  const sources = item.sources ?? item.num_sources ?? item.source_count ?? item.Sources
  let source = '—'
  if (typeof sources === 'number' && Number.isFinite(sources)) {
    source = String(sources)
  } else if (typeof sources === 'string' && sources) {
    source = sources
  }
  return {
    hash,
    name: name || hash,
    sizeBytes,
    source,
    raw: item
  }
}

export function mapSearchResultsFromDto (dto) {
  const list = dto && (dto.results ?? dto.Results)
  if (!Array.isArray(list)) return []
  return list.map(normalizeSearchResult).filter(Boolean)
}

/**
 * 按 hash 合并：保留已出现顺序，新条目按接口返回顺序追加（便于轮询增量展示）。
 * @param {number} [max=Infinity] 最大行数；达到后不再追加新 hash，仍会更新的已有行；返回 truncated=true
 */
export function mergeSearchResultRows (prevRows, incomingRows, max = Infinity) {
  const prev = Array.isArray(prevRows) ? prevRows : []
  const incoming = Array.isArray(incomingRows) ? incomingRows : []
  const cap = typeof max === 'number' && max > 0 ? max : Infinity
  const byHash = new Map(prev.map((r) => [r.hash, r]))
  const order = prev.map((r) => r.hash)
  const seen = new Set(order)
  let truncated = false

  for (const r of incoming) {
    if (!r || !r.hash) continue
    if (!seen.has(r.hash)) {
      if (order.length >= cap) {
        truncated = true
        continue
      }
      seen.add(r.hash)
      order.push(r.hash)
      byHash.set(r.hash, r)
    } else {
      const cur = byHash.get(r.hash)
      byHash.set(r.hash, { ...cur, ...r })
    }
  }

  const rows = order.map((h) => byHash.get(h))
  return { rows, truncated }
}

/** 是否仍在搜索中（需与 goed2kd 返回的 state 字符串对齐） */
export function isGoed2kSearchActive (dto) {
  if (!dto || dto.error) return false
  const s = String(dto.state || '').toUpperCase()
  return ['RUNNING', 'SEARCHING', 'PENDING', 'STARTING', 'WAITING', 'BUSY'].includes(s)
}

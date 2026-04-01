import { getTaskName } from '@shared/utils'

const toNumber = (value, defaultValue = 0) => {
  const result = Number(value)
  return Number.isFinite(result) ? result : defaultValue
}

const normalizeGoed2kdStatus = (status = '') => {
  const value = String(status || '').toLowerCase()
  switch (value) {
    case 'downloading':
    case 'active':
    case 'running':
      return 'active'
    case 'paused':
    case 'pause':
      return 'paused'
    case 'finished':
    case 'complete':
    case 'completed':
      return 'complete'
    case 'error':
    case 'failed':
      return 'error'
    default:
      return 'waiting'
  }
}

export const buildTaskKey = (engine, id) => `${engine}:${id}`

export const adaptAria2Task = (task = {}) => {
  const id = task.gid || ''
  return {
    ...task,
    engine: 'aria2',
    id,
    gid: id,
    taskKey: buildTaskKey('aria2', id),
    raw: task
  }
}

export const adaptGoed2kdTask = (task = {}) => {
  const id = task.hash || ''
  const totalWanted = toNumber(task.total_wanted || task.size, 0)
  const totalDone = toNumber(task.total_done, 0)
  const completedLength = totalDone
  const totalLength = totalWanted
  const progress = totalLength > 0 ? completedLength / totalLength : 0
  const name = task.file_name || task.file_path || id
  const status = normalizeGoed2kdStatus(task.status || task.state)

  return {
    ...task,
    engine: 'goed2kd',
    id,
    gid: id,
    hash: id,
    taskKey: buildTaskKey('goed2kd', id),
    status,
    name,
    files: [],
    peers: [],
    completedLength,
    totalLength,
    downloadSpeed: toNumber(task.download_rate, 0),
    progress,
    raw: task,
    dir: task.file_path || '',
    bittorrent: null
  }
}

export const adaptTaskForMainFlow = (task = {}) => {
  if (task.engine === 'goed2kd' || task.hash) {
    return adaptGoed2kdTask(task)
  }
  return adaptAria2Task(task)
}

export const getTaskDisplayName = (task = {}, defaultName = 'Unknown') => {
  return getTaskName(task, { defaultName, maxLen: -1 })
}

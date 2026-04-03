import { ipcRenderer } from 'electron'
import api from '@/api'
import { EMPTY_STRING, POST_DOWNLOAD_ACTION, TASK_STATUS } from '@shared/constants'
import { checkTaskIsBT, intersection } from '@shared/utils'
import { adaptAria2Task, adaptGoed2kdTask } from '../taskAdapter'

const resolveGoed2kdList = (resp) => {
  if (Array.isArray(resp)) return resp
  if (!resp || typeof resp !== 'object') return []
  if (Array.isArray(resp.data)) return resp.data
  if (Array.isArray(resp.list)) return resp.list
  if (Array.isArray(resp.items)) return resp.items
  if (Array.isArray(resp.transfers)) return resp.transfers
  if (resp.data && typeof resp.data === 'object') {
    if (Array.isArray(resp.data.list)) return resp.data.list
    if (Array.isArray(resp.data.items)) return resp.data.items
    if (Array.isArray(resp.data.transfers)) return resp.data.transfers
  }
  return []
}

const matchGoed2kdListByCurrentTab = (status, currentList) => {
  if (currentList === 'active') {
    return status === TASK_STATUS.ACTIVE
  }
  if (currentList === 'waiting') {
    return status === TASK_STATUS.PAUSED || status === TASK_STATUS.WAITING
  }
  if (currentList === 'stopped') {
    return [TASK_STATUS.COMPLETE, TASK_STATUS.ERROR, TASK_STATUS.REMOVED].includes(status)
  }
  return false
}

const state = {
  /** 本次运行有效：全部下载完成后的动作 */
  onCompleteAction: POST_DOWNLOAD_ACTION.NONE,
  /** 下载完成后操作确认弹窗已打开，避免重复触发 */
  postDownloadAwaitingConfirm: false,
  currentList: 'active',
  taskDetailVisible: false,
  currentTaskGid: EMPTY_STRING,
  enabledFetchPeers: false,
  currentTaskItem: null,
  currentTaskFiles: [],
  currentTaskPeers: [],
  seedingList: [],
  taskList: [],
  count: {
    downloading: 0,
    seeding: 0,
    waiting: 0,
    stoped: 0
  },
  selectedTaskKeyList: []
}

const getters = {
}

const mutations = {
  SET_ON_COMPLETE_ACTION (state, action) {
    state.onCompleteAction = action || POST_DOWNLOAD_ACTION.NONE
  },
  SET_POST_DOWNLOAD_AWAITING_CONFIRM (state, value) {
    state.postDownloadAwaitingConfirm = !!value
  },
  UPDATE_SEEDING_LIST (state, seedingList) {
    state.seedingList = seedingList
  },
  UPDATE_TASK_LIST (state, taskList) {
    state.taskList = taskList
  },
  UPDATE_SELECTED_TASK_KEY_LIST (state, taskKeyList) {
    state.selectedTaskKeyList = taskKeyList
  },
  CHANGE_CURRENT_LIST (state, currentList) {
    state.currentList = currentList
  },
  CHANGE_TASK_DETAIL_VISIBLE (state, visible) {
    state.taskDetailVisible = visible
  },
  UPDATE_CURRENT_TASK_GID (state, gid) {
    state.currentTaskGid = gid
  },
  UPDATE_ENABLED_FETCH_PEERS (state, enabled) {
    state.enabledFetchPeers = enabled
  },
  UPDATE_CURRENT_TASK_ITEM (state, task) {
    state.currentTaskItem = task
  },
  UPDATE_CURRENT_TASK_FILES (state, files) {
    state.currentTaskFiles = files
  },
  UPDATE_CURRENT_TASK_PEERS (state, peers) {
    state.currentTaskPeers = peers
  },
  UPDATE_COUNT (state, counts) {
    state.count = counts
  }
}

const actions = {
  setOnCompleteAction ({ commit }, action) {
    commit('SET_ON_COMPLETE_ACTION', action)
  },
  /**
   * 在单次任务完成回调后调用：刷新全局统计后若已无任何下载中任务则执行一次性动作并复位为 none。
   */
  async runPostDownloadActionIfIdle ({ state, commit, dispatch }) {
    const desired = state.onCompleteAction
    if (!desired || desired === POST_DOWNLOAD_ACTION.NONE) {
      return
    }

    try {
      await dispatch('fetchAllList')
    } catch (e) {
      console.warn('[imFile] runPostDownloadActionIfIdle fetchAllList:', e?.message ?? e)
      return
    }

    let goed2kdIncomplete = 0
    try {
      const st = await api.getGoed2kdStatus()
      if (st && st.healthy) {
        const resp = await api.fetchGoed2kdTaskList()
        const raw = resolveGoed2kdList(resp)
        const list = (raw || []).map((t) => {
          const adapted = adaptGoed2kdTask(t)
          return adapted
        })
        goed2kdIncomplete = list.filter((t) => {
          if (t.status === TASK_STATUS.COMPLETE || t.status === TASK_STATUS.ERROR || t.status === TASK_STATUS.REMOVED) {
            return false
          }
          if (t.totalLength > 0 && t.completedLength < t.totalLength) {
            return true
          }
          return t.status === TASK_STATUS.ACTIVE || t.status === TASK_STATUS.WAITING || t.status === TASK_STATUS.PAUSED
        }).length
      }
    } catch (e) {
      console.warn('[imFile] runPostDownloadActionIfIdle goed2kd check:', e?.message ?? e)
    }

    const aria2Incomplete = state.count.downloading
    if (aria2Incomplete > 0 || goed2kdIncomplete > 0) {
      return
    }

    if (state.postDownloadAwaitingConfirm) {
      return
    }

    commit('SET_POST_DOWNLOAD_AWAITING_CONFIRM', true)
    return { ready: true, action: desired }
  },
  /**
   * 用户取消倒计时确认：不执行系统动作，并重置为「无」。
   */
  cancelPostDownloadConfirm ({ commit }) {
    commit('SET_POST_DOWNLOAD_AWAITING_CONFIRM', false)
    commit('SET_ON_COMPLETE_ACTION', POST_DOWNLOAD_ACTION.NONE)
  },
  /**
   * 倒计时结束或用户确认后执行（会先复位 store 再调主进程）。
   */
  async executePostDownloadAction ({ commit }, action) {
    commit('SET_POST_DOWNLOAD_AWAITING_CONFIRM', false)
    commit('SET_ON_COMPLETE_ACTION', POST_DOWNLOAD_ACTION.NONE)
    if (!action || action === POST_DOWNLOAD_ACTION.NONE) {
      return { ok: true }
    }
    return ipcRenderer.invoke('application:post-download-action', action)
  },
  changeCurrentList ({ commit, dispatch }, currentList) {
    commit('CHANGE_CURRENT_LIST', currentList)
    commit('UPDATE_SELECTED_TASK_KEY_LIST', [])
    dispatch('fetchList')
  },
  fetchAllList ({ commit }) {
    return api.fetchAllTaskList().then(data => {
      const downloadingList = data[0][0].concat(data[1][0])
      const downloading = downloadingList.filter((item) => item.completedLength !== item.totalLength).length
      const seeding = downloadingList.filter((item) => item.completedLength === item.totalLength).length
      const waiting = data[1][0].length
      const stoped = data[2][0].length

      commit('UPDATE_COUNT', {
        downloading,
        seeding,
        waiting,
        stoped
      })
    })
  },
  fetchList ({ commit, state }) {
    return api.fetchTaskList({ type: state.currentList })
      .then(async (aria2Data) => {
        let taskList = (aria2Data || []).map(adaptAria2Task)
        if (['active', 'waiting', 'stopped'].includes(state.currentList)) {
          try {
            const goed2kdStatus = await api.getGoed2kdStatus()
            if (!goed2kdStatus || !goed2kdStatus.healthy) {
              commit('UPDATE_TASK_LIST', taskList)
              commit('UPDATE_COUNT', {
                ...state.count,
                [state.currentList === 'active' ? 'downloading' : state.currentList]: taskList.length
              })
              const taskKeys = taskList.map((task) => task.taskKey)
              const list = intersection(state.selectedTaskKeyList, taskKeys)
              commit('UPDATE_SELECTED_TASK_KEY_LIST', list)
              return
            }
            const goed2kdResp = await api.fetchGoed2kdTaskList()
            const goed2kdData = resolveGoed2kdList(goed2kdResp)
            const goed2kdList = (goed2kdData || [])
              .map(adaptGoed2kdTask)
              .filter(task => matchGoed2kdListByCurrentTab(task.status, state.currentList))
            taskList = taskList.concat(goed2kdList)
          } catch (err) {
            console.warn('[imFile] fetch goed2kd task list fail:', err)
          }
        }

        commit('UPDATE_TASK_LIST', taskList)
        commit('UPDATE_COUNT', {
          ...state.count,
          [state.currentList === 'active' ? 'downloading' : state.currentList]: taskList.length
        })
        const { selectedTaskKeyList } = state
        const taskKeys = taskList.map((task) => task.taskKey)
        const list = intersection(selectedTaskKeyList, taskKeys)
        commit('UPDATE_SELECTED_TASK_KEY_LIST', list)
      })
      .catch((err) => {
        console.warn('[imFile] fetch task list fail:', err)
      })
  },
  selectTasks ({ commit }, list) {
    commit('UPDATE_SELECTED_TASK_KEY_LIST', list)
  },
  selectAllTask ({ commit, state }) {
    const taskKeys = state.taskList.map((task) => task.taskKey)
    commit('UPDATE_SELECTED_TASK_KEY_LIST', taskKeys)
  },
  fetchItem ({ dispatch }, gid) {
    return api.fetchTaskItem({ gid })
      .then((data) => {
        dispatch('updateCurrentTaskItem', data)
      })
      .catch((err) => {
        console.warn('[imFile] fetch task item fail:', err)
      })
  },
  fetchItemWithPeers ({ dispatch }, gid) {
    return api.fetchTaskItemWithPeers({ gid })
      .then((data) => {
        console.log('fetchItemWithPeers===>', data)
        dispatch('updateCurrentTaskItem', data)
      })
      .catch((err) => {
        console.warn('[imFile] fetch task item with peers fail:', err)
      })
  },
  showTaskDetailByGid ({ commit, dispatch }, gid) {
    api.fetchTaskItem({ gid })
      .then((task) => {
        dispatch('updateCurrentTaskItem', task)
        commit('UPDATE_CURRENT_TASK_GID', task.gid)
        commit('CHANGE_TASK_DETAIL_VISIBLE', true)
      })
  },
  showTaskDetail ({ commit, dispatch }, task) {
    dispatch('updateCurrentTaskItem', task)
    commit('UPDATE_CURRENT_TASK_GID', task.id || task.gid)
    commit('CHANGE_TASK_DETAIL_VISIBLE', true)
  },
  hideTaskDetail ({ commit }) {
    commit('CHANGE_TASK_DETAIL_VISIBLE', false)
  },
  toggleEnabledFetchPeers ({ commit }, enabled) {
    commit('UPDATE_ENABLED_FETCH_PEERS', enabled)
  },
  updateCurrentTaskItem ({ commit }, task) {
    commit('UPDATE_CURRENT_TASK_ITEM', task)
    if (task) {
      commit('UPDATE_CURRENT_TASK_FILES', task.files)
      commit('UPDATE_CURRENT_TASK_PEERS', task.peers)
    } else {
      commit('UPDATE_CURRENT_TASK_FILES', [])
      commit('UPDATE_CURRENT_TASK_PEERS', [])
    }
  },
  updateCurrentTaskGid ({ commit }, gid) {
    commit('UPDATE_CURRENT_TASK_GID', gid)
  },
  addUri ({ dispatch }, data) {
    const { uris, outs, options } = data
    const ed2kUris = (uris || []).filter(uri => String(uri).startsWith('ed2k://'))
    const normalUris = (uris || []).filter(uri => !String(uri).startsWith('ed2k://'))
    const requests = []

    if (normalUris.length > 0) {
      requests.push(api.addUri({ uris: normalUris, outs, options }))
    }
    ed2kUris.forEach((uri) => {
      requests.push(api.addEd2kTask(uri))
    })

    return Promise.all(requests).then(() => {
      dispatch('fetchList')
      dispatch('app/updateAddTaskOptions', {}, { root: true })
    })
  },
  addTorrent ({ dispatch }, data) {
    const { torrent, options } = data
    return api.addTorrent({ torrent, options })
      .then(() => {
        dispatch('fetchList')
        dispatch('app/updateAddTaskOptions', {}, { root: true })
      })
  },
  addMetalink ({ dispatch }, data) {
    const { metalink, options } = data
    return api.addMetalink({ metalink, options })
      .then(() => {
        dispatch('fetchList')
        dispatch('app/updateAddTaskOptions', {}, { root: true })
      })
  },
  getTaskOption (_, gid) {
    return new Promise((resolve) => {
      api.getOption({ gid })
        .then((data) => {
          resolve(data)
        })
    })
  },
  changeTaskOption (_, payload) {
    const { gid, options } = payload
    return api.changeOption({ gid, options })
  },
  removeTask ({ state, dispatch }, task) {
    const gid = task.id || task.gid
    if (gid === state.currentTaskGid) {
      dispatch('hideTaskDetail')
    }

    const request = api.removeTaskByEngine(task)
    return request
      .finally(() => {
        dispatch('fetchList')
        dispatch('saveSession')
      })
  },
  forcePauseTask ({ dispatch }, task) {
    const gid = task.id || task.gid
    const { status } = task
    if (status !== TASK_STATUS.ACTIVE) {
      return Promise.resolve(true)
    }

    if (task.engine === 'goed2kd') {
      return api.pauseTaskByEngine(task)
        .finally(() => {
          dispatch('fetchList')
          dispatch('saveSession')
        })
    }

    return api.forcePauseTask({ gid })
      .finally(() => {
        dispatch('fetchList')
        dispatch('saveSession')
      })
  },
  pauseTask ({ dispatch }, task) {
    const gid = task.id || task.gid
    if (task.engine === 'goed2kd') {
      return api.pauseTaskByEngine(task)
        .finally(() => {
          dispatch('fetchList')
          dispatch('saveSession')
        })
    }
    const isBT = checkTaskIsBT(task)
    const promise = isBT ? api.forcePauseTask({ gid }) : api.pauseTask({ gid })
    promise.finally(() => {
      dispatch('fetchList')
      dispatch('saveSession')
    })
    return promise
  },
  resumeTask ({ dispatch }, task) {
    const request = api.resumeTaskByEngine(task)
    return request
      .finally(() => {
        dispatch('fetchList')
        dispatch('saveSession')
      })
  },
  pauseAllTask ({ dispatch }) {
    return api.pauseAllTask()
      .catch(() => {
        return api.forcePauseAllTask()
      })
      .finally(() => {
        dispatch('fetchList')
        dispatch('saveSession')
      })
  },
  resumeAllTask ({ dispatch }) {
    return api.resumeAllTask()
      .finally(() => {
        dispatch('fetchList')
        dispatch('saveSession')
      })
  },
  addToSeedingList ({ state, commit }, gid) {
    const { seedingList } = state
    if (seedingList.includes(gid)) {
      return
    }

    const list = [
      ...seedingList,
      gid
    ]
    commit('UPDATE_SEEDING_LIST', list)
  },
  removeFromSeedingList ({ state, commit }, gid) {
    const { seedingList } = state
    const idx = seedingList.indexOf(gid)
    if (idx === -1) {
      return
    }

    const list = [...seedingList.slice(0, idx), ...seedingList.slice(idx + 1)]
    commit('UPDATE_SEEDING_LIST', list)
  },
  stopSeeding ({ dispatch }, { gid }) {
    const options = {
      seedTime: 0
    }
    return dispatch('changeTaskOption', { gid, options })
  },
  removeTaskRecord ({ state, dispatch }, task) {
    const { gid, status } = task
    if (gid === state.currentTaskGid) {
      dispatch('hideTaskDetail')
    }

    const { ERROR, COMPLETE, REMOVED } = TASK_STATUS
    if ([ERROR, COMPLETE, REMOVED].indexOf(status) === -1) {
      return
    }
    const request = task.engine === 'goed2kd'
      ? api.removeTaskByEngine(task)
      : api.removeTaskRecord({ gid })
    return request
      .finally(() => {
        dispatch('fetchList')
        dispatch('saveSession')
      })
  },
  saveSession () {
    return api.saveSession().catch((err) => {
      console.warn('[imFile] saveSession failed:', err)
    })
  },
  purgeTaskRecord ({ dispatch }) {
    return api.purgeTaskRecord()
      .finally(() => dispatch('fetchList'))
  },
  toggleTask ({ dispatch }, task) {
    const { status } = task
    const { ACTIVE, WAITING, PAUSED } = TASK_STATUS
    if (status === ACTIVE) {
      return dispatch('pauseTask', task)
    } else if (status === WAITING || status === PAUSED) {
      return dispatch('resumeTask', task)
    }
  },
  batchResumeSelectedTasks ({ state }) {
    const gids = state.selectedTaskKeyList
      .filter(taskKey => String(taskKey).startsWith('aria2:'))
      .map(taskKey => taskKey.split(':')[1])
    if (gids.length === 0) {
      return
    }

    return api.batchResumeTask({ gids })
  },
  batchPauseSelectedTasks ({ state }) {
    const gids = state.selectedTaskKeyList
      .filter(taskKey => String(taskKey).startsWith('aria2:'))
      .map(taskKey => taskKey.split(':')[1])
    if (gids.length === 0) {
      return
    }

    return api.batchPauseTask({ gids })
  },
  batchForcePauseTask (_, gids) {
    return api.batchForcePauseTask({ gids })
  },
  batchResumeTask (_, gids) {
    return api.batchResumeTask({ gids })
  },
  batchRemoveTask ({ dispatch }, gids) {
    return api.batchRemoveTask({ gids })
      .finally(() => {
        dispatch('fetchList')
        dispatch('saveSession')
      })
  }
}

export default {
  namespaced: true,
  state,
  getters,
  mutations,
  actions
}

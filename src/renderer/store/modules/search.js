const createInitialState = () => ({
  keyword: '',
  hasSearched: false,
  searchRows: [],
  searchError: '',
  searchLoading: false,
  resultsTruncated: false
})

const state = createInitialState()

const getters = {}

const mutations = {
  UPDATE_SEARCH_KEYWORD (state, keyword) {
    state.keyword = typeof keyword === 'string' ? keyword : ''
  },
  UPDATE_SEARCH_HAS_SEARCHED (state, v) {
    state.hasSearched = Boolean(v)
  },
  UPDATE_SEARCH_ROWS (state, rows) {
    state.searchRows = Array.isArray(rows) ? [...rows] : []
  },
  UPDATE_SEARCH_ERROR (state, err) {
    state.searchError = err ? String(err) : ''
  },
  UPDATE_SEARCH_LOADING (state, v) {
    state.searchLoading = Boolean(v)
  },
  UPDATE_SEARCH_RESULTS_TRUNCATED (state, v) {
    state.resultsTruncated = Boolean(v)
  },
  RESET_SEARCH_STATE (state) {
    Object.assign(state, createInitialState())
  }
}

const actions = {}

export default {
  namespaced: true,
  state,
  getters,
  mutations,
  actions
}

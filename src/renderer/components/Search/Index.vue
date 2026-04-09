<template>
  <el-container class="main panel search-page" direction="horizontal">
    <el-aside width="200px" class="subnav hidden-xs-only">
      <nav class="subnav-inner subnav-inner--stacked">
        <div class="subnav-inner-body" aria-hidden="true" />
        <mo-subnav-footer />
      </nav>
    </el-aside>
    <el-container class="content panel" direction="vertical">
      <el-header class="panel-header search-panel-header" height="auto">
        <div class="search-title-wrap">
          <h4 class="search-page-title">{{ $t('search.title') }}</h4>
        </div>
        <el-tabs v-model="activeSearchTab" class="search-mode-tabs">
          <el-tab-pane :label="$t('search.tab-ed2k')" name="ed2k">
            <div class="search-toolbar">
              <div class="search-toolbar-row">
                <el-input
                  v-model="keyword"
                  class="search-input"
                  size="large"
                  :placeholder="$t('search.placeholder')"
                  clearable
                  :disabled="searchLoading"
                  @keyup.enter="runSearch"
                >
                  <template #append>
                    <el-button
                      type="primary"
                      size="default"
                      :loading="searchButtonLoading"
                      @click="onSearchButtonClick"
                    >
                      {{
                        searchLoading && !searchButtonLoading
                          ? $t('search.stop-search')
                          : $t('search.search')
                      }}
                    </el-button>
                  </template>
                </el-input>
                <el-button
                  class="search-reset-btn"
                  plain
                  size="default"
                  :disabled="!canResetSearch"
                  @click="onResetSearch"
                >
                  {{ $t('search.reset') }}
                </el-button>
              </div>
              <div v-if="searchHistory.length" class="search-history">
                <div class="search-history-head">
                  <span class="search-history-label">{{ $t('search.history-label') }}</span>
                  <el-button
                    link
                    type="danger"
                    size="small"
                    @click="clearAllHistory"
                  >
                    {{ $t('search.clear-history') }}
                  </el-button>
                </div>
                <div class="search-history-tags">
                  <el-tag
                    v-for="(item, idx) in searchHistory"
                    :key="idx + '-' + item"
                    class="search-history-tag"
                    closable
                    @click="onHistoryTagClick(item, $event)"
                    @close="removeHistoryItem(item)"
                  >
                    {{ item }}
                  </el-tag>
                </div>
              </div>
            </div>
          </el-tab-pane>
          <el-tab-pane :label="$t('search.tab-bt')" name="ssapi">
            <div class="search-toolbar">
              <el-alert
                v-if="!ssapiBaseUrlNormalized"
                type="info"
                :closable="false"
                show-icon
                class="search-ssapi-config-alert"
              >
                <span>{{ $t('search.ssapi-base-required-hint') }}</span>
                <el-button
                  link
                  type="primary"
                  class="search-ssapi-open-pref"
                  @click="openSsapiPreference"
                >
                  {{ $t('search.open-preferences') }}
                </el-button>
              </el-alert>
              <div class="search-toolbar-row">
                <el-input
                  v-model="ssapiKeyword"
                  class="search-input"
                  size="large"
                  :placeholder="$t('search.ssapi-placeholder')"
                  clearable
                  :disabled="ssapiSearchLoading || !ssapiBaseUrlNormalized"
                  @keyup.enter="runSsapiSearch"
                >
                  <template #append>
                    <el-button
                      type="primary"
                      size="default"
                      :loading="ssapiSearchButtonLoading"
                      :disabled="!ssapiBaseUrlNormalized"
                      @click="onSsapiSearchButtonClick"
                    >
                      {{
                        ssapiSearchLoading && !ssapiSearchButtonLoading
                          ? $t('search.stop-search')
                          : $t('search.search')
                      }}
                    </el-button>
                  </template>
                </el-input>
                <div class="search-sort-controls">
                  <el-dropdown
                    trigger="click"
                    :hide-on-click="true"
                    :disabled="ssapiSearchLoading || !ssapiBaseUrlNormalized"
                    @command="onSsapiSortCommand"
                  >
                    <el-button class="search-sort-trigger" plain size="default">
                      {{ ssapiSortDisplayLabel }}
                    </el-button>
                    <template #dropdown>
                      <el-dropdown-menu>
                        <el-dropdown-item
                          v-for="opt in ssapiSortOptions"
                          :key="opt.value"
                          :command="opt.value"
                        >
                          {{ opt.label }}
                        </el-dropdown-item>
                      </el-dropdown-menu>
                    </template>
                  </el-dropdown>
                </div>
              </div>
              <div v-if="ssapiHistory.length" class="search-history">
                <div class="search-history-head">
                  <span class="search-history-label">{{ $t('search.history-label') }}</span>
                  <el-button
                    link
                    type="danger"
                    size="small"
                    @click="clearAllSsapiHistory"
                  >
                    {{ $t('search.clear-history') }}
                  </el-button>
                </div>
                <div class="search-history-tags">
                  <el-tag
                    v-for="(item, idx) in ssapiHistory"
                    :key="'s-' + idx + '-' + item"
                    class="search-history-tag"
                    closable
                    @click="onSsapiHistoryTagClick(item, $event)"
                    @close="removeSsapiHistoryItem(item)"
                  >
                    {{ item }}
                  </el-tag>
                </div>
              </div>
            </div>
          </el-tab-pane>
        </el-tabs>
      </el-header>
      <el-main class="panel-content search-panel-main">
        <template v-if="activeSearchTab === 'ed2k'">
          <el-alert
            v-if="hasSearched && resultsTruncated"
            type="warning"
            :closable="false"
            show-icon
            class="search-truncate-alert"
          >
            {{ $t('search.results-truncated', { max: maxSearchResults }) }}
          </el-alert>
          <div v-if="!hasSearched" class="search-empty-state">
            <el-empty
              class="search-el-empty"
              :image-size="80"
              :description="$t('search.initial-hint')"
            />
          </div>
          <div
            v-else-if="searchLoading && !hasResultRows"
            class="search-searching-only"
          >
            {{ $t('search.searching') }}
          </div>
          <div v-else class="search-results">
            <div class="mo-table-wrapper search-table-wrap">
              <el-table
                :data="displayedRows"
                stripe
                row-key="hash"
                class="search-table"
                tooltip-effect="dark"
                :empty-text="searchError ? searchError : $t('search.empty')"
              >
                <el-table-column prop="name" :label="$t('search.name')" min-width="160" show-overflow-tooltip />
                <el-table-column prop="sizeLabel" :label="$t('search.size')" width="120" />
                <el-table-column prop="source" :label="$t('search.source')" width="140" show-overflow-tooltip />
                <el-table-column min-width="180" align="right" class-name="search-actions-column">
                  <template #default="{ row }">
                    <div class="search-actions-cell">
                      <el-button
                        plain
                        size="small"
                        :disabled="!getEd2kUri(row)"
                        @click="onCopyLink(row)"
                      >
                        {{ $t('search.copy-link') }}
                      </el-button>
                      <el-button
                        type="primary"
                        size="small"
                        :loading="Boolean(downloadingByHash[row.hash])"
                        :disabled="!row.hash"
                        @click="onDownload(row)"
                      >
                        {{ $t('search.download') }}
                      </el-button>
                    </div>
                  </template>
                </el-table-column>
              </el-table>
            </div>
          </div>
        </template>
        <template v-else>
          <div v-if="!ssapiHasSearched" class="search-empty-state">
            <el-empty
              class="search-el-empty"
              :image-size="80"
              :description="ssapiEmptyDescription"
            />
          </div>
          <div
            v-else-if="ssapiSearchLoading && !hasSsapiResultRows"
            class="search-searching-only"
          >
            {{ $t('search.searching') }}
          </div>
          <div v-else class="search-results">
            <div class="mo-table-wrapper search-table-wrap">
              <el-table
                :data="displayedSsapiRows"
                stripe
                row-key="hash"
                class="search-table"
                tooltip-effect="dark"
                :empty-text="ssapiError ? ssapiError : $t('search.empty')"
              >
                <el-table-column :label="$t('search.name')" min-width="160" show-overflow-tooltip>
                  <template #default="{ row }">
                    <el-button
                      link
                      type="primary"
                      class="search-name-link"
                      :disabled="!row.hash"
                      @click="onOpenSsapiFiles(row)"
                    >
                      <span class="search-name-link-text">{{ row.name }}</span>
                    </el-button>
                  </template>
                </el-table-column>
                <el-table-column prop="sizeLabel" :label="$t('search.size')" width="120" />
                <el-table-column prop="source" :label="$t('search.ssapi-source-seed-leech')" width="140" show-overflow-tooltip />
                <el-table-column min-width="180" align="right" class-name="search-actions-column">
                  <template #default="{ row }">
                    <div class="search-actions-cell">
                      <el-button
                        plain
                        size="small"
                        :disabled="!getSsapiMagnet(row)"
                        @click="onCopySsapiMagnet(row)"
                      >
                        {{ $t('search.copy-magnet') }}
                      </el-button>
                      <el-button
                        type="primary"
                        size="small"
                        :loading="Boolean(ssapiDownloadingByHash[row.hash])"
                        :disabled="!getSsapiMagnet(row)"
                        @click="onDownloadSsapi(row)"
                      >
                        {{ $t('search.download') }}
                      </el-button>
                    </div>
                  </template>
                </el-table-column>
              </el-table>
            </div>
          </div>
        </template>
      </el-main>
    </el-container>
    <el-drawer
      v-model="ssapiFilesDrawerVisible"
      :title="ssapiFilesDrawerTitle"
      size="50%"
      :append-to-body="true"
      class="search-ssapi-files-drawer"
    >
      <div v-if="ssapiFilesLoading" class="search-searching-only">
        {{ $t('search.loading-files') }}
      </div>
      <el-empty
        v-else-if="ssapiFilesError"
        :image-size="72"
        :description="ssapiFilesError"
      />
      <div v-else class="mo-table-wrapper search-table-wrap">
        <el-table
          :data="ssapiFilesRows"
          stripe
          row-key="key"
          class="search-table"
          tooltip-effect="dark"
          :empty-text="$t('search.empty')"
        >
          <el-table-column prop="index" :label="'#'" width="60" />
          <el-table-column prop="path" :label="$t('search.file-path')" min-width="170" show-overflow-tooltip />
          <el-table-column prop="extension" :label="$t('search.file-extension')" width="110" show-overflow-tooltip />
          <el-table-column prop="sizeLabel" :label="$t('search.size')" width="120" />
        </el-table>
      </div>
    </el-drawer>
  </el-container>
</template>

<script>
import { mapState, mapMutations } from 'vuex'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import SubnavFooter from '@/components/Subnav/SubnavFooter.vue'
import api from '@/api'
import { GOED2K_SEARCH_MAX_RESULTS, SSAPI_SEARCH_DEFAULT_LIMIT } from '@shared/constants'
import {
  bytesToSize,
  mapSearchResultsFromDto,
  mergeSearchResultRows,
  getSearchResultEd2kUri,
  isGoed2kSearchActive,
  loadEd2kSearchHistory,
  addEd2kSearchHistoryItem,
  removeEd2kSearchHistoryItem,
  clearEd2kSearchHistory,
  normalizeSsapiBaseUrl,
  buildSsapiSearchUrl,
  mapSsapiSearchResponse,
  getSsapiRowMagnet,
  loadSsapiSearchHistory,
  addSsapiSearchHistoryItem,
  removeSsapiSearchHistoryItem,
  clearSsapiSearchHistory
} from '@shared/utils'

const POLL_MS = 1000
const MAX_POLLS = 120
const SSAPI_SORT_FIELDS = [
  { value: 'relevance', labelKey: 'search.sort-relevance' },
  { value: 'seeders', labelKey: 'search.sort-seeders' },
  { value: 'leechers', labelKey: 'search.sort-leechers' },
  { value: 'size', labelKey: 'search.sort-size' },
  { value: 'published_at', labelKey: 'search.sort-published-at' },
  { value: 'updated_at', labelKey: 'search.sort-updated-at' },
  { value: 'name', labelKey: 'search.sort-name' }
]
const SSAPI_FILES_LIMIT = 100

function mapSsapiTorrentFiles (json) {
  const payload = json && typeof json === 'object' ? json.data : null
  const block =
    payload && typeof payload === 'object' && Array.isArray(payload.items)
      ? payload
      : payload &&
          typeof payload === 'object' &&
          payload.torrent &&
          payload.torrent.files &&
          Array.isArray(payload.torrent.files.items)
        ? payload.torrent.files
        : null
  const list = block && Array.isArray(block.items) ? block.items : []
  return list
    .map((item, idx) => {
      if (!item || typeof item !== 'object') return null
      const path = String(item.path ?? item.name ?? '').trim()
      const extension = String(item.extension ?? '').trim()
      const sizeRaw = Number(item.size ?? item.length ?? 0)
      const size = Number.isFinite(sizeRaw) && sizeRaw >= 0 ? sizeRaw : 0
      const indexRaw = Number(item.index ?? idx + 1)
      const index = Number.isFinite(indexRaw) ? indexRaw : idx + 1
      return {
        key: `${index}-${path || idx}`,
        index,
        path: path || `#${idx + 1}`,
        extension: extension.replace(/^\./, ''),
        size,
        sizeLabel: bytesToSize(size)
      }
    })
    .filter(Boolean)
}

export default {
  name: 'mo-content-search',
  components: {
    [SubnavFooter.name]: SubnavFooter
  },
  setup () {
    const { t } = useI18n()
    return { t }
  },
  data () {
    return {
      activeSearchTab: 'ed2k',
      searchButtonLoading: false,
      pollTimer: null,
      pollInFlight: false,
      downloadingByHash: {},
      searchHistory: [],
      ssapiKeyword: '',
      ssapiRows: [],
      ssapiError: '',
      ssapiSearchLoading: false,
      ssapiSearchButtonLoading: false,
      ssapiSortField: 'relevance',
      ssapiSortDescending: false,
      ssapiHasSearched: false,
      ssapiHistory: [],
      ssapiDownloadingByHash: {},
      ssapiAbortController: null,
      ssapiFilesDrawerVisible: false,
      ssapiFilesDrawerTitle: '',
      ssapiFilesLoading: false,
      ssapiFilesError: '',
      ssapiFilesRows: []
    }
  },
  computed: {
    ...mapState('preference', {
      preferenceConfig: (state) => state.config
    }),
    ...mapState('search', [
      'hasSearched',
      'searchRows',
      'searchError',
      'searchLoading',
      'resultsTruncated'
    ]),
    ssapiBaseUrlNormalized () {
      const raw = this.preferenceConfig && this.preferenceConfig.ssapiSearchBaseUrl
      return normalizeSsapiBaseUrl(raw)
    },
    ssapiEmptyDescription () {
      return this.ssapiBaseUrlNormalized
        ? this.t('search.ssapi-initial-hint')
        : this.t('search.ssapi-base-required-hint')
    },
    displayedSsapiRows () {
      return this.ssapiRows
    },
    hasSsapiResultRows () {
      return Array.isArray(this.ssapiRows) && this.ssapiRows.length > 0
    },
    ssapiSortOptions () {
      return SSAPI_SORT_FIELDS.map((item) => ({
        value: item.value,
        label: this.t(item.labelKey)
      }))
    },
    ssapiSortDisplayLabel () {
      const current = this.ssapiSortOptions.find((i) => i.value === this.ssapiSortField)
      const name = current ? current.label : this.t('search.sort-relevance')
      const dirArrow = this.ssapiSortDescending ? '↓' : '↑'
      return `${name} ${dirArrow}`
    },
    keyword: {
      get () {
        return this.$store.state.search.keyword
      },
      set (v) {
        this.$store.commit('search/UPDATE_SEARCH_KEYWORD', v)
      }
    },
    displayedRows () {
      return this.searchRows
    },
    hasResultRows () {
      return Array.isArray(this.searchRows) && this.searchRows.length > 0
    },
    maxSearchResults () {
      return GOED2K_SEARCH_MAX_RESULTS
    },
    canResetSearch () {
      return this.searchLoading || this.hasSearched || Boolean((this.keyword || '').trim())
    }
  },
  mounted () {
    this.searchHistory = loadEd2kSearchHistory()
    this.ssapiHistory = loadSsapiSearchHistory()
    this.resumeSearchIfNeeded()
  },
  unmounted () {
    this.stopPolling()
    this.abortSsapiRequest()
  },
  methods: {
    ...mapMutations('search', {
      setSearchRows: 'UPDATE_SEARCH_ROWS',
      setSearchError: 'UPDATE_SEARCH_ERROR',
      setSearchLoading: 'UPDATE_SEARCH_LOADING',
      setHasSearched: 'UPDATE_SEARCH_HAS_SEARCHED',
      setResultsTruncated: 'UPDATE_SEARCH_RESULTS_TRUNCATED'
    }),
    async resumeSearchIfNeeded () {
      if (!this.searchLoading) return
      const res = await api.getGoed2kCurrentSearch()
      if (!res.ok) {
        this.setSearchLoading(false)
        this.setSearchError(res.message || '')
        return
      }
      const dto = res.data
      this.applyDto(dto)
      if (dto && dto.error) {
        ElMessage.error(String(dto.error))
        this.setSearchLoading(false)
        return
      }
      if (isGoed2kSearchActive(dto)) {
        this.startPolling()
      } else {
        this.setSearchLoading(false)
      }
    },
    applyDto (dto) {
      if (!dto) return
      const incoming = mapSearchResultsFromDto(dto).map((r) => ({
        ...r,
        sizeLabel: bytesToSize(r.sizeBytes)
      }))
      const { rows, truncated } = mergeSearchResultRows(
        this.searchRows,
        incoming,
        GOED2K_SEARCH_MAX_RESULTS
      )
      this.setSearchRows(rows)
      if (truncated) {
        this.setResultsTruncated(true)
      }
      if (dto.error) {
        this.setSearchError(String(dto.error))
      } else {
        this.setSearchError('')
      }
    },
    stopPolling () {
      if (this.pollTimer) {
        clearInterval(this.pollTimer)
        this.pollTimer = null
      }
      this.pollInFlight = false
    },
    async stopCurrentSearchAndSyncState () {
      try {
        await api.stopGoed2kSearch()
      } catch (_) {}
      this.setSearchLoading(false)
    },
    startPolling () {
      this.stopPolling()
      let polls = 0
      this.pollTimer = setInterval(async () => {
        if (this.pollInFlight) return
        this.pollInFlight = true
        polls += 1
        try {
          const res = await api.getGoed2kCurrentSearch()
          if (!res.ok) {
            this.setSearchError(res.message || '')
            this.setSearchLoading(false)
            this.stopPolling()
            return
          }
          const dto = res.data
          this.applyDto(dto)
          if (dto && dto.error) {
            ElMessage.error(String(dto.error))
            this.setSearchLoading(false)
            this.stopPolling()
            return
          }
          if (!isGoed2kSearchActive(dto)) {
            this.setSearchLoading(false)
            this.stopPolling()
            return
          }
          if (polls >= MAX_POLLS) {
            this.setSearchError(this.t('search.search-failed'))
            await this.stopCurrentSearchAndSyncState()
            this.stopPolling()
          }
        } finally {
          this.pollInFlight = false
        }
      }, POLL_MS)
    },
    onSearchButtonClick () {
      if (this.searchLoading && !this.searchButtonLoading) {
        this.cancelSearch()
      } else {
        this.runSearch()
      }
    },
    async onResetSearch () {
      this.searchButtonLoading = false
      this.stopPolling()
      if (this.searchLoading) {
        await this.stopCurrentSearchAndSyncState()
      }
      this.$store.commit('search/RESET_SEARCH_STATE')
      this.downloadingByHash = {}
      ElMessage.success(this.t('search.reset-done'))
    },
    async runSearch () {
      const q = (this.keyword || '').trim()
      if (!q) {
        ElMessage.warning(this.t('search.query-required'))
        return
      }
      if (this.searchLoading) {
        return
      }
      const status = await api.getGoed2kdStatus()
      if (!status || !status.healthy) {
        ElMessage.error(this.t('search.engine-not-ready'))
        return
      }
      this.setHasSearched(true)
      this.setSearchLoading(true)
      this.searchButtonLoading = true
      this.setSearchError('')
      this.setResultsTruncated(false)
      this.setSearchRows([])
      this.stopPolling()
      let res
      try {
        res = await api.startGoed2kSearch({ query: q, scope: 'all' })
      } catch (e) {
        this.setSearchLoading(false)
        ElMessage.error(e && e.message ? String(e.message) : this.t('search.search-failed'))
        return
      } finally {
        this.searchButtonLoading = false
      }
      if (!res.ok) {
        this.setSearchLoading(false)
        ElMessage.error(res.message || this.t('search.search-failed'))
        return
      }
      addEd2kSearchHistoryItem(q)
      this.searchHistory = loadEd2kSearchHistory()
      this.applyDto(res.data)
      if (!isGoed2kSearchActive(res.data)) {
        this.setSearchLoading(false)
        return
      }
      this.startPolling()
    },
    async cancelSearch () {
      this.stopPolling()
      await this.stopCurrentSearchAndSyncState()
    },
    getEd2kUri (row) {
      return getSearchResultEd2kUri(row)
    },
    async onCopyLink (row) {
      const uri = getSearchResultEd2kUri(row)
      if (!uri) return
      try {
        await navigator.clipboard.writeText(uri)
        ElMessage.success(this.t('search.copy-link-success'))
      } catch {
        ElMessage.error(this.t('search.copy-link-fail'))
      }
    },
    onHistoryTagClick (item, e) {
      if (e && e.target && e.target.closest && e.target.closest('.el-tag__close')) {
        return
      }
      this.keyword = item
      this.runSearch()
    },
    removeHistoryItem (item) {
      removeEd2kSearchHistoryItem(item)
      this.searchHistory = loadEd2kSearchHistory()
    },
    async clearAllHistory () {
      try {
        await ElMessageBox.confirm(
          this.t('search.clear-history-confirm'),
          this.t('search.clear-history'),
          {
            type: 'warning',
            confirmButtonText: this.t('app.yes'),
            cancelButtonText: this.t('app.cancel')
          }
        )
      } catch {
        return
      }
      clearEd2kSearchHistory()
      this.searchHistory = []
    },
    async onDownload (row) {
      if (!row || !row.hash) return
      this.downloadingByHash = { ...this.downloadingByHash, [row.hash]: true }
      try {
        const res = await api.downloadGoed2kSearchResult(row.hash)
        if (!res.ok) {
          ElMessage.error(res.message || this.t('search.download-failed'))
          return
        }
        ElMessage.success(this.t('search.download-started'))
        await this.$store.dispatch('task/fetchAllList')
      } finally {
        const next = { ...this.downloadingByHash }
        delete next[row.hash]
        this.downloadingByHash = next
      }
    },
    openSsapiPreference () {
      this.$router.push({ path: '/preference/advanced' }).catch(() => {})
    },
    abortSsapiRequest () {
      if (this.ssapiAbortController) {
        try {
          this.ssapiAbortController.abort()
        } catch (_) {}
        this.ssapiAbortController = null
      }
    },
    onSsapiSearchButtonClick () {
      if (this.ssapiSearchLoading && !this.ssapiSearchButtonLoading) {
        this.cancelSsapiSearch()
      } else {
        this.runSsapiSearch()
      }
    },
    applySsapiSortImmediately () {
      // 仅在已有搜索条件时即时刷新；避免仅切换控件就触发空搜索提示。
      if (!this.ssapiHasSearched || !(this.ssapiKeyword || '').trim()) return
      if (this.ssapiSearchLoading) {
        this.abortSsapiRequest()
        this.ssapiSearchLoading = false
        this.ssapiSearchButtonLoading = false
      }
      this.runSsapiSearch()
    },
    onSsapiSortCommand (field) {
      if (!field) return
      // 重复点击同一项时切换升降；切换字段时默认升序。
      if (this.ssapiSortField === field) {
        this.ssapiSortDescending = !this.ssapiSortDescending
      } else {
        this.ssapiSortField = field
        this.ssapiSortDescending = false
      }
      this.applySsapiSortImmediately()
    },
    cancelSsapiSearch () {
      this.abortSsapiRequest()
      this.ssapiSearchLoading = false
    },
    getSsapiMagnet (row) {
      return getSsapiRowMagnet(row)
    },
    async onCopySsapiMagnet (row) {
      const uri = getSsapiRowMagnet(row)
      if (!uri) return
      try {
        await navigator.clipboard.writeText(uri)
        ElMessage.success(this.t('search.copy-magnet-success'))
      } catch {
        ElMessage.error(this.t('search.copy-link-fail'))
      }
    },
    onSsapiHistoryTagClick (item, e) {
      if (e && e.target && e.target.closest && e.target.closest('.el-tag__close')) {
        return
      }
      this.ssapiKeyword = item
      this.runSsapiSearch()
    },
    removeSsapiHistoryItem (item) {
      removeSsapiSearchHistoryItem(item)
      this.ssapiHistory = loadSsapiSearchHistory()
    },
    async clearAllSsapiHistory () {
      try {
        await ElMessageBox.confirm(
          this.t('search.clear-history-confirm'),
          this.t('search.clear-history'),
          {
            type: 'warning',
            confirmButtonText: this.t('app.yes'),
            cancelButtonText: this.t('app.cancel')
          }
        )
      } catch {
        return
      }
      clearSsapiSearchHistory()
      this.ssapiHistory = []
    },
    async runSsapiSearch () {
      const q = (this.ssapiKeyword || '').trim()
      if (!q) {
        ElMessage.warning(this.t('search.query-required'))
        return
      }
      const base = this.ssapiBaseUrlNormalized
      if (!base) {
        ElMessage.warning(this.t('search.ssapi-base-required-hint'))
        return
      }
      if (this.ssapiSearchLoading) {
        return
      }
      const url = buildSsapiSearchUrl(base)
      if (!url) {
        ElMessage.warning(this.t('search.ssapi-base-required-hint'))
        return
      }

      this.abortSsapiRequest()
      const controller = new AbortController()
      this.ssapiAbortController = controller

      this.ssapiHasSearched = true
      this.ssapiSearchLoading = true
      this.ssapiSearchButtonLoading = true
      this.ssapiError = ''
      this.ssapiRows = []

      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            queryString: q,
            limit: SSAPI_SEARCH_DEFAULT_LIMIT,
            page: 1,
            orderBy: [
              {
                field: this.ssapiSortField,
                descending: this.ssapiSortDescending
              }
            ],
            totalCount: true,
            hasNextPage: true
          }),
          signal: controller.signal
        })

        const text = await res.text()
        let json = null
        try {
          json = text ? JSON.parse(text) : null
        } catch {
          json = null
        }

        if (!res.ok) {
          const msg =
            (json && json.message) ||
            (json && json.error) ||
            text ||
            this.t('search.search-failed')
          this.ssapiError = String(msg)
          ElMessage.error(this.ssapiError)
          return
        }

        if (!json || typeof json !== 'object') {
          this.ssapiError = this.t('search.search-failed')
          ElMessage.error(this.ssapiError)
          return
        }

        const gqlErrs = json.errors
        if (gqlErrs != null) {
          const arr = Array.isArray(gqlErrs) ? gqlErrs : [gqlErrs]
          const msg = arr
            .map((e) => (e && e.message) || (typeof e === 'string' ? e : ''))
            .filter(Boolean)
            .join('; ')
          if (msg) {
            this.ssapiError = msg
            ElMessage.error(msg)
            return
          }
        }

        const mapped = mapSsapiSearchResponse(json)
        this.ssapiRows = mapped.rows.map((r) => ({
          ...r,
          sizeLabel: bytesToSize(r.sizeBytes)
        }))

        addSsapiSearchHistoryItem(q)
        this.ssapiHistory = loadSsapiSearchHistory()
      } catch (e) {
        if (e && e.name === 'AbortError') {
          return
        }
        const msg =
          (e && e.message) ? String(e.message) : this.t('search.search-failed')
        this.ssapiError = msg
        ElMessage.error(msg)
      } finally {
        this.ssapiAbortController = null
        this.ssapiSearchLoading = false
        this.ssapiSearchButtonLoading = false
      }
    },
    async onDownloadSsapi (row) {
      const magnet = getSsapiRowMagnet(row)
      if (!magnet || !row || !row.hash) return
      this.ssapiDownloadingByHash = {
        ...this.ssapiDownloadingByHash,
        [row.hash]: true
      }
      try {
        await this.$store.dispatch('task/addUri', {
          uris: [magnet],
          options: {}
        })
        ElMessage.success(this.t('search.download-started'))
        await this.$store.dispatch('task/fetchAllList')
      } catch (e) {
        ElMessage.error(
          (e && e.message) || this.t('search.download-failed')
        )
      } finally {
        const next = { ...this.ssapiDownloadingByHash }
        delete next[row.hash]
        this.ssapiDownloadingByHash = next
      }
    },
    async onOpenSsapiFiles (row) {
      if (!row || !row.hash) return
      const base = this.ssapiBaseUrlNormalized
      if (!base) {
        ElMessage.warning(this.t('search.ssapi-base-required-hint'))
        return
      }
      const hash = String(row.hash || '').trim().toLowerCase()
      if (!/^[a-f0-9]{40}$/.test(hash)) {
        ElMessage.warning(this.t('search.invalid-info-hash'))
        return
      }
      this.ssapiFilesDrawerVisible = true
      this.ssapiFilesDrawerTitle = this.t('search.files-of', { name: row.name || hash })
      this.ssapiFilesLoading = true
      this.ssapiFilesError = ''
      this.ssapiFilesRows = []
      try {
        const url = `${base}/v1/torrents/${encodeURIComponent(hash)}/files?limit=${SSAPI_FILES_LIMIT}&page=1&totalCount=1&hasNextPage=1`
        const res = await fetch(url, { method: 'GET' })
        const text = await res.text()
        let json = null
        try {
          json = text ? JSON.parse(text) : null
        } catch {
          json = null
        }
        if (!res.ok) {
          const msg =
            (json && json.message) ||
            (json && json.error) ||
            text ||
            this.t('search.load-files-failed')
          this.ssapiFilesError = String(msg)
          return
        }
        if (!json || typeof json !== 'object') {
          this.ssapiFilesError = this.t('search.load-files-failed')
          return
        }
        const errs = json.errors
        if (errs != null) {
          const arr = Array.isArray(errs) ? errs : [errs]
          const msg = arr
            .map((e) => (e && e.message) || (typeof e === 'string' ? e : ''))
            .filter(Boolean)
            .join('; ')
          if (msg) {
            this.ssapiFilesError = msg
            return
          }
        }
        this.ssapiFilesRows = mapSsapiTorrentFiles(json)
      } catch (e) {
        this.ssapiFilesError =
          (e && e.message) ? String(e.message) : this.t('search.load-files-failed')
      } finally {
        this.ssapiFilesLoading = false
      }
    }
  }
}
</script>

<style lang="scss" scoped>
.search-truncate-alert {
  margin: 0 16px 12px;
  box-sizing: border-box;
}

@media only screen and (min-width: 568px) {
  .search-truncate-alert {
    margin-left: 36px;
    margin-right: 36px;
  }
}

.search-panel-header {
  padding-bottom: 16px;
}

.search-title-wrap {
  width: 100%;
  text-align: center;
  padding: 12px 0 8px;
  box-sizing: border-box;
}

.search-page-title {
  margin: 0;
  font-size: 22px;
  font-weight: 600;
  line-height: 1.35;
  letter-spacing: 0.04em;
}

.search-mode-tabs {
  margin: 12px auto 0;
  max-width: 720px;
  width: 100%;

  :deep(.el-tabs__header) {
    margin-bottom: 0;
  }

  :deep(.el-tabs__nav-wrap) {
    justify-content: center;
  }

  :deep(.el-tabs__content) {
    overflow: visible;
  }
}

.search-ssapi-config-alert {
  margin-bottom: 12px;
}

.search-ssapi-open-pref {
  margin-left: 8px;
  vertical-align: baseline;
}

.search-toolbar {
  margin: 20px auto 0;
  max-width: 720px;
  width: 100%;
}

.search-toolbar-row {
  display: flex;
  align-items: center;
  gap: 10px;

  .search-input {
    padding-right: 0;
    flex: 1;
  }
}

.search-sort-controls {
  display: flex;
  align-items: center;
  flex: 0 0 auto;
}

.search-sort-trigger {
  min-width: 128px;
  height: 40px;
  padding: 0 12px;
  justify-content: space-between;
}

:deep(.search-ssapi-files-drawer .el-drawer__body) {
  padding-top: 8px;
}

.search-reset-btn {
  flex: 0 0 auto;
}

.search-history {
  margin-top: 12px;
  width: 100%;
}

.search-history-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}

.search-history-label {
  font-size: 13px;
  color: $--color-text-secondary;
}

.search-history-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.search-history-tag {
  cursor: pointer;
  max-width: 100%;

  :deep(.el-tag__content) {
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

.search-searching-only {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 240px;
  padding: 16px 16px 64px;
  box-sizing: border-box;
  font-size: 14px;
  color: $--color-text-secondary;
}

/* 与 flex 布局配合，保证主区域可纵向滚动（勿用 overflow:hidden，否则会挡住长列表） */
.search-page.main.el-container {
  flex: 1;
  min-height: 0;
  height: 100%;
}

.search-page > .el-container.content.panel {
  flex: 1;
  min-height: 0;
}

.search-panel-main {
  flex: 1 1 auto;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
}

.search-empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 240px;
  padding: 16px 16px 64px;
  box-sizing: border-box;
}

.search-results {
  padding: 0 16px 64px;
  box-sizing: border-box;
  min-height: 200px;
}

@media only screen and (min-width: 568px) {
  .search-results {
    padding-left: 36px;
    padding-right: 36px;
  }

  .search-empty-state,
  .search-searching-only {
    padding-left: 36px;
    padding-right: 36px;
  }
}

.search-table-wrap {
  margin-top: 0;
}

.search-table {
  width: 100%;
  table-layout: fixed;

  :deep(.cell) {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

.search-actions-cell {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  flex-wrap: nowrap;
  white-space: nowrap;
}

.search-name-link {
  display: inline-flex;
  width: 100%;
  max-width: 100%;
  text-align: left;
  justify-content: flex-start;
  overflow: hidden;
}

.search-name-link-text {
  display: inline-block;
  width: 100%;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>

<style lang="scss">
/* 标题强调色：覆盖 .theme-dark .panel .panel-header h4 的默认标题色 */
.search-page .panel-header .search-page-title {
  color: $--color-primary;
}

.theme-dark .search-page .panel-header .search-page-title {
  color: $--color-primary;
}

/* 仅浅色：勿在无 theme-light 时写死浅底，否则会覆盖深色全局样式 */
html.theme-light .search-page {
  .search-toolbar {
    .el-input__wrapper {
      background-color: $--background-color-gray !important;
      box-shadow: 0 0 0 1px $--border-color-lighter inset !important;
    }

    .el-input__inner {
      color: $--subnav-text-color;

      &::placeholder {
        color: $--color-text-placeholder;
      }
    }

    .el-input-group__append {
      background-color: $--background-color-gray !important;
      box-shadow: none !important;
    }
  }
}

.search-page {
  .search-el-empty {
    .el-empty__description {
      color: $--color-text-secondary;
    }
  }
}

.theme-dark .search-page .search-el-empty .el-empty__description {
  color: $--dk-panel-title-color;
}

.theme-dark .search-page .search-searching-only {
  color: $--dk-panel-title-color;
}

.theme-dark .search-page .search-history-label {
  color: $--dk-panel-title-color;
}

.theme-dark .search-page .search-reset-btn:not(.is-disabled) {
  border-color: rgba(255, 255, 255, 0.24);
  color: #e8e8e8;
  background-color: transparent;

  &:hover,
  &:focus,
  &:focus-visible {
    border-color: rgba(255, 255, 255, 0.36);
    color: #fff;
    background-color: rgba(255, 255, 255, 0.1);
  }
}

.theme-dark .search-page .search-reset-btn.is-disabled,
.theme-dark .search-page .search-reset-btn:disabled {
  border-color: rgba(255, 255, 255, 0.18) !important;
  color: rgba(255, 255, 255, 0.45) !important;
  background-color: transparent !important;
}
</style>

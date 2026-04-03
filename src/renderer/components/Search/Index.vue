<template>
  <el-container class="main panel search-page" direction="horizontal">
    <el-container class="content panel" direction="vertical">
      <el-header class="panel-header search-panel-header" height="auto">
        <div class="search-title-wrap">
          <h4 class="search-page-title">{{ $t('search.title') }}</h4>
        </div>
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
      </el-header>
      <el-main class="panel-content search-panel-main">
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
              <el-table-column prop="name" :label="$t('search.name')" min-width="200" show-overflow-tooltip />
              <el-table-column prop="sizeLabel" :label="$t('search.size')" width="120" />
              <el-table-column prop="source" :label="$t('search.source')" width="140" show-overflow-tooltip />
              <el-table-column min-width="220" align="right" class-name="search-actions-column">
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
      </el-main>
    </el-container>
  </el-container>
</template>

<script>
import { mapState, mapMutations } from 'vuex'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import api from '@/api'
import { GOED2K_SEARCH_MAX_RESULTS } from '@shared/constants'
import {
  bytesToSize,
  mapSearchResultsFromDto,
  mergeSearchResultRows,
  getSearchResultEd2kUri,
  isGoed2kSearchActive,
  loadEd2kSearchHistory,
  addEd2kSearchHistoryItem,
  removeEd2kSearchHistoryItem,
  clearEd2kSearchHistory
} from '@shared/utils'

const POLL_MS = 1000
const MAX_POLLS = 120

export default {
  name: 'mo-content-search',
  setup () {
    const { t } = useI18n()
    return { t }
  },
  data () {
    return {
      searchButtonLoading: false,
      pollTimer: null,
      downloadingByHash: {},
      searchHistory: []
    }
  },
  computed: {
    ...mapState('search', [
      'hasSearched',
      'searchRows',
      'searchError',
      'searchLoading',
      'resultsTruncated'
    ]),
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
    this.resumeSearchIfNeeded()
  },
  unmounted () {
    this.stopPolling()
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
    },
    startPolling () {
      this.stopPolling()
      let polls = 0
      this.pollTimer = setInterval(async () => {
        polls += 1
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
        if (!isGoed2kSearchActive(dto) || polls >= MAX_POLLS) {
          this.setSearchLoading(false)
          this.stopPolling()
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
        await api.stopGoed2kSearch().catch(() => {})
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
      this.setSearchLoading(false)
      await api.stopGoed2kSearch().catch(() => {})
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
}

.search-actions-cell {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: wrap;
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

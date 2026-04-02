<template>
  <el-container class="main panel search-page" direction="horizontal">
    <el-container class="content panel" direction="vertical">
      <el-header class="panel-header search-panel-header" height="auto">
        <div class="search-title-wrap">
          <h4 class="search-page-title">{{ $t('search.title') }}</h4>
        </div>
        <div class="search-toolbar">

          <el-input v-model="keyword" class="search-input" size="large" :placeholder="$t('search.placeholder')"
            clearable @keyup.enter="runSearch">
            <template #append>
              <el-button type="primary" size="medium" @click="runSearch">
                {{ $t('search.search') }}
              </el-button>
            </template>
          </el-input>
        </div>
      </el-header>
      <el-main class="panel-content search-panel-main">
        <div v-if="!hasSearched" class="search-empty-state">
          <el-empty class="search-el-empty" :image-size="80" :description="$t('search.initial-hint')" />
        </div>
        <div v-else class="search-results">
          <div class="mo-table-wrapper search-table-wrap">
            <el-table :data="displayedRows" stripe class="search-table" tooltip-effect="dark"
              :empty-text="$t('search.empty')">
              <el-table-column prop="name" :label="$t('search.name')" min-width="200" show-overflow-tooltip />
              <el-table-column prop="size" :label="$t('search.size')" width="120" />
              <el-table-column prop="source" :label="$t('search.source')" width="140" show-overflow-tooltip />
              <el-table-column width="120" align="right">
                <template #default>
                  <el-button type="primary" size="small" @click="onDownload">
                    {{ $t('search.download') }}
                  </el-button>
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
import { ElMessage } from 'element-plus'

const MOCK_ROWS = [
  {
    id: '1',
    name: 'Example.Documentary.1080p.x264',
    size: '4.2 GB',
    source: 'Demo index',
    ed2k: 'ed2k://|file|example.mkv|1234567890|ABCDEF|/'
  },
  {
    id: '2',
    name: 'Sample.Music.FLAC.Collection',
    size: '890 MB',
    source: 'Demo index',
    ed2k: 'ed2k://|file|music.flac|9876543210|FEDCBA|/'
  },
  {
    id: '3',
    name: 'Archive.Software.Bundle',
    size: '156 MB',
    source: 'Legacy mock',
    ed2k: 'ed2k://|file|bundle.zip|1111111111|AAAAAA|/'
  },
  {
    id: '4',
    name: 'ED2K.Protocol.Overview.pdf',
    size: '2.1 MB',
    source: 'Docs',
    ed2k: 'ed2k://|file|overview.pdf|2222222222|BBBBBB|/'
  },
  {
    id: '5',
    name: 'Network.Resource.Placeholder',
    size: '700 MB',
    source: 'Demo index',
    ed2k: 'ed2k://|file|placeholder.iso|3333333333|CCCCCC|/'
  }
]

export default {
  name: 'mo-content-search',
  data() {
    return {
      keyword: '',
      filterText: '',
      hasSearched: false,
      allRows: MOCK_ROWS.map((r) => ({ ...r }))
    }
  },
  computed: {
    displayedRows() {
      if (!this.hasSearched) {
        return []
      }
      const q = (this.filterText || '').trim().toLowerCase()
      if (!q) {
        return this.allRows
      }
      return this.allRows.filter((row) => {
        return (
          row.name.toLowerCase().includes(q) ||
          row.source.toLowerCase().includes(q)
        )
      })
    }
  },
  methods: {
    runSearch() {
      this.hasSearched = true
      this.filterText = this.keyword
    },
    onDownload() {
      ElMessage.info(this.$t('search.mock-download-tip'))
    }
  }
}
</script>

<style lang="scss" scoped>
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

  .search-input {
    padding-right: .2em;
  }
}

.search-panel-main {
  overflow: hidden;
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

  .search-empty-state {
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
</style>

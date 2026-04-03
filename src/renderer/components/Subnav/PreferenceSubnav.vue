<template>
  <nav class="subnav-inner subnav-inner--stacked">
    <div class="subnav-inner-body">
      <h3>{{ title }}</h3>
      <ul>
        <li
          @click="() => nav('basic')"
          :class="[current === 'basic' ? 'active' : '']"
        >
          <i class="subnav-icon">
            <mo-icon name='preference-basic' width="20" height="20" />
          </i>
          <span>{{ $t('preferences.basic') }}</span>
        </li>
        <li
          @click="() => nav('advanced')"
          :class="[current === 'advanced' ? 'active' : '']"
        >
          <i class="subnav-icon">
            <mo-icon name='preference-advanced' width="20" height="20" />
          </i>
          <span>{{ $t('preferences.advanced') }}</span>
        </li>
      </ul>
    </div>
    <mo-subnav-footer />
  </nav>
</template>

<script>
import '@/components/Icons/preference-basic'
import '@/components/Icons/preference-advanced'
import { useI18n } from 'vue-i18n'
import SubnavFooter from '@/components/Subnav/SubnavFooter.vue'

export default {
  name: 'mo-preference-subnav',
  components: {
    [SubnavFooter.name]: SubnavFooter
  },
  setup () {
    const { t } = useI18n()
    return { t }
  },
  props: {
    current: {
      type: String,
      default: 'basic'
    }
  },
  computed: {
    title () {
      return this.t('subnav.preferences')
    }
  },
  methods: {
    nav (category = 'basic') {
      this.$router.push({
        path: `/preference/${category}`
      }).catch(err => {
        console.log(err)
      })
    }
  }
}
</script>

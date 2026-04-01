<template>
  <nav class="subnav-inner">
    <h3>{{ title }}</h3>
    <ul>
      <li
        @click="() => nav('active')"
        :class="[current === 'active' ? 'active' : '']"
      >
        <i class="subnav-icon">
          <mo-icon name="task-start" width="20" height="20" />
        </i>
        <span>{{ `${$t('task.active')}${count.downloading ? '(' + count.downloading + ')' : ''}` }}</span>
      </li>
      <li
        @click="() => nav('seeding')"
        :class="[current === 'seeding' ? 'active' : '']"
      >
        <i class="subnav-icon">
          <mo-icon name="task-start" width="20" height="20" />
        </i>
        <span>{{`${$t('task.seeding')}${count.seeding ? '(' + count.seeding + ')' : ''}` }}</span>
      </li>
      <li
        @click="() => nav('waiting')"
        :class="[current === 'waiting' ? 'active' : '']"
      >
        <i class="subnav-icon">
          <mo-icon name="task-pause" width="20" height="20" />
        </i>
        <span>{{`${$t('task.waiting')}${count.waiting ? '(' + count.waiting + ')' : ''}` }}</span>
      </li>
      <li
        @click="() => nav('stopped')"
        :class="[current === 'stopped' ? 'active' : '']"
      >
        <i class="subnav-icon">
          <mo-icon name="task-stop" width="20" height="20" />
        </i>
        <span>{{`${$t('task.stopped')}${count.stoped ? '(' + count.stoped + ')' : ''}` }}</span>
      </li>
    </ul>
  </nav>
</template>

<script>
import { mapState } from 'vuex'
import '@/components/Icons/task-start'
import '@/components/Icons/task-pause'
import '@/components/Icons/task-stop'
export default {
  name: 'mo-task-subnav',
  props: {
    current: {
      type: String,
      default: 'active'
    }
  },
  computed: {
    ...mapState('task', {
      count: state => state.count
    }),
    title () {
      return this.$t('subnav.task-list')
    }
  },
  methods: {
    nav (status = 'active') {
      this.$router.push({
        path: `/task/${status}`
      }).catch(err => {
        console.log(err)
      })
    }
  }
}
</script>

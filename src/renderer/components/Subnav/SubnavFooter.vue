<template>
  <div class="subnav-footer">
    <ul>
      <li @click="navPreference" class="non-draggable">
        <i class="subnav-icon">
          <mo-icon name="menu-preference" width="20" height="20" />
        </i>
        <span>{{ $t('subnav.preferences') }}</span>
      </li>
      <li @click="onAbout" class="non-draggable">
        <i class="subnav-icon">
          <mo-icon name="menu-about" width="20" height="20" />
        </i>
        <span>{{ $t('app.about') }}</span>
      </li>
    </ul>
  </div>
</template>

<script>
import '@/components/Icons/menu-preference'
import '@/components/Icons/menu-about'

export default {
  name: 'mo-subnav-footer',
  methods: {
    navPreference () {
      this.$router.push({ path: '/preference' }).catch((err) => {
        console.log(err)
      })
    },
    onAbout () {
      this.$store.dispatch('app/showAboutPanel')
    }
  }
}
</script>

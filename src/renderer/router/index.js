import { createRouter, createWebHashHistory } from 'vue-router'

export default createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'main',
      component: () => import('@/components/Main.vue'),
      children: [
        {
          path: '/task',
          alias: '/',
          component: () => import('@/components/Task/Index.vue'),
          props: {
            status: 'active'
          }
        },
        {
          path: '/task/:status',
          name: 'task',
          component: () => import('@/components/Task/Index.vue'),
          props: true
        },
        {
          path: '/preference',
          name: 'preference',
          component: () => import('@/components/Preference/Index.vue'),
          props: true,
          children: [
            {
              path: 'basic',
              alias: '',
              components: {
                subnav: () => import('@/components/Subnav/PreferenceSubnav.vue'),
                form: () => import('@/components/Preference/Basic.vue')
              },
              props: {
                subnav: { current: 'basic' }
              }
            },
            {
              path: 'advanced',
              components: {
                subnav: () => import('@/components/Subnav/PreferenceSubnav.vue'),
                form: () => import('@/components/Preference/Advanced.vue')
              },
              props: {
                subnav: { current: 'advanced' }
              }
            },
            {
              path: 'lab',
              components: {
                subnav: () => import('@/components/Subnav/PreferenceSubnav.vue'),
                form: () => import('@/components/Preference/Lab.vue')
              },
              props: {
                subnav: { current: 'lab' }
              }
            }
          ]
        }
      ]
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/'
    }
  ]
})

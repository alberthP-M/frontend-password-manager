import { createRouter, createWebHistory } from 'vue-router'
import VaultView from '@/views/VaultView.vue'
import VaultAsimetricView from '@/views/VaultAsimetricView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: VaultView,
    },

    {
      path: '/vault-asimetric',
      name: 'vault',
      component: VaultAsimetricView,
    },
  ],
})

export default router

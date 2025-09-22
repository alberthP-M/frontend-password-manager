import { createRouter, createWebHistory } from 'vue-router'
import VaultView from '@/views/VaultView.vue'
import VaultAsimetricView from '@/views/VaultAsimetricView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'vault',
      component: VaultView,
    },

    {
      path: '/vault-asimetric',
      name: 'vault-asimetric',
      component: VaultAsimetricView,
    },
  ],
})

export default router

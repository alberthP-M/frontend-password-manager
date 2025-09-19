import { createRouter, createWebHistory } from 'vue-router'
import VaultView from '@/views/VaultView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: VaultView,
    },
  ],
})

export default router

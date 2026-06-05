import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  history: createWebHashHistory(''),
  routes: [
    {
      path: '/',
      name: '默认页',
      component: () => import('../components/Root.vue')
    },
    {
      path: '/dialog',
      name: '对话框',
      component: () => import('../components/Dialog.vue')
    },
    {
      path: '/taskpane',
      name: '任务窗格',
      component: () => import('../components/TaskPane.vue')
    },
    // AI 功能路由
    {
      path: '/ai-pane',
      name: 'AI任务窗格',
      component: () => import('../components/ai/AiTaskPane.vue')
    },
    {
      path: '/ai-dialog',
      name: 'AI对话框',
      component: () => import('../components/ai/AiDialog.vue')
    },
    {
      path: '/ai-settings',
      name: 'AI设置',
      component: () => import('../components/ai/AiSettings.vue')
    },
    {
      path: '/ai-history',
      name: 'AI历史会话',
      component: () => import('../components/ai/HistoryPane.vue')
    }
  ]
})

export default router

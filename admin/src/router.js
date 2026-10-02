import { createRouter, createWebHashHistory } from 'vue-router'
import { getToken } from './api'
import Login from './views/Login.vue'
import Dashboard from './views/Dashboard.vue'
import Users from './views/Users.vue'
import UserDetail from './views/UserDetail.vue'
import Ops from './views/Ops.vue'

const routes = [
  { path: '/login', component: Login, meta: { public: true } },
  { path: '/', component: Dashboard },
  { path: '/users', component: Users },
  { path: '/users/:uid', component: UserDetail },
  { path: '/ops', component: Ops },
  { path: '/:pathMatch(.*)*', redirect: '/' }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

/* 未登录一律回登录页（hash 模式便于静态托管，刷新不 404） */
router.beforeEach((to) => {
  if (to.meta && to.meta.public) return true
  if (!getToken()) return { path: '/login', query: { from: to.fullPath } }
  return true
})

export default router

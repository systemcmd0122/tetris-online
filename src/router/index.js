import { createRouter, createWebHistory } from 'vue-router';
const HomeView = () => import('../views/HomeView.vue');
const SprintView = () => import('../views/SprintView.vue');
const BotBattleView = () => import('../views/BotBattleView.vue');
const MultiBattleView = () => import('../views/MultiBattleView.vue');
const ProfileView = () => import('../views/ProfileView.vue');
const HowToView = () => import('../views/HowToView.vue');
const UpdatesView = () => import('../views/UpdatesView.vue');
const StatusView = () => import('../views/StatusView.vue');
const AdminView = () => import('../views/AdminView.vue');

const routes = [
  { path: '/', name: 'Home', component: HomeView },
  { path: '/sprint', name: 'Sprint', component: SprintView },
  { path: '/battle', name: 'BotBattle', component: BotBattleView },
  { path: '/multi', name: 'MultiBattle', component: MultiBattleView },
  { path: '/profile', name: 'Profile', component: ProfileView },
  { path: '/how-to', name: 'HowTo', component: HowToView },
  { path: '/updates', name: 'Updates', component: UpdatesView },
  { path: '/status', name: 'Status', component: StatusView },
  { path: '/admin', name: 'Admin', component: AdminView },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;

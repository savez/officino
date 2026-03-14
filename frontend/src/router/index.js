import { createRouter, createWebHistory } from 'vue-router';
import { getCurrentUser } from '../services/auth';

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('../pages/LoginPage.vue'),
    meta: { public: true },
  },
  {
    path: '/',
    name: 'Dashboard',
    component: () => import('../pages/DashboardPage.vue'),
  },
  {
    path: '/catalogo',
    name: 'CatalogoProdotti',
    component: () => import('../pages/CatalogoProdottiPage.vue'),
  },
  {
    path: '/categorie',
    name: 'Categorie',
    component: () => import('../pages/CategoriePage.vue'),
  },
  {
    path: '/clienti',
    name: 'Clienti',
    component: () => import('../pages/ClientiPage.vue'),
  },
  {
    path: '/preventivi',
    name: 'Preventivi',
    component: () => import('../pages/PreventiviPage.vue'),
  },
  {
    path: '/preventivi/:id',
    name: 'PreventivoDettaglio',
    component: () => import('../pages/PreventivoDettaglioPage.vue'),
  },
  {
    path: '/utenti',
    name: 'Utenti',
    component: () => import('../pages/UtentiPage.vue'),
    meta: { requiresAdmin: true },
  },
  {
    path: '/impostazioni',
    name: 'Impostazioni',
    component: () => import('../pages/ImpostazioniPage.vue'),
    meta: { requiresAdmin: true },
  },
  {
    path: '/403',
    name: 'Forbidden',
    component: () => import('../pages/ForbiddenPage.vue'),
  },
  {
    path: '/rapportini',
    name: 'Rapportini',
    component: () => import('../pages/RapportiniPage.vue'),
  },
  {
    path: '/note-lavorazione',
    name: 'NoteLavorazione',
    component: () => import('../pages/NoteLavorazionePage.vue'),
    meta: { requiresAdmin: true },
  },
  {
    path: '/log',
    name: 'Log',
    component: () => import('../pages/LogModifichePage.vue'),
    meta: { requiresAdmin: true },
  },
  {
    path: '/guida',
    name: 'Guida',
    component: () => import('../pages/GuidaPage.vue'),
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

// Auth guard
router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('token');

  if (!to.meta.public && !token) {
    return next('/login');
  }

  if (to.meta.requiresAdmin) {
    const user = getCurrentUser();
    if (!user || user.ruolo !== 'admin') {
      return next('/403');
    }
  }

  next();
});

export default router;

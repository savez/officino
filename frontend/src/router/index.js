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
    // La pagina e' riservata: l'anagrafica clienti la gestisce l'amministratore.
    // Le API di LETTURA restano invece aperte, perche' la tendina dei
    // rapportini ne ha bisogno.
    path: '/clienti',
    name: 'Clienti',
    component: () => import('../pages/ClientiPage.vue'),
    meta: { requiresAdmin: true },
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
  // Rotta di riserva, in fondo per forza: deve essere l'ultima a essere provata.
  //
  // Serve da quando il sito statico riscrive ogni percorso su index.html: prima
  // un indirizzo inesistente riceveva un 404 dal server, ora arriva fin qui.
  // Senza questa rotta il router non troverebbe corrispondenza e non
  // renderizzerebbe nulla — una pagina bianca, che e' peggio di un errore
  // perche' non dice cosa e' successo.
  {
    path: '/:percorsoNonTrovato(.*)*',
    name: 'NonTrovata',
    component: () => import('../pages/NotFoundPage.vue'),
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

// Esportato oltre al router perche' la guida deve poter sapere quali aree
// siano riservate. Prima manteneva un proprio elenco: tre fonti di verita' —
// router, menu e guida — che nessuno confrontava, e infatti la guida e' rimasta
// indietro quando i permessi sono cambiati.
export { routes };

export default router;

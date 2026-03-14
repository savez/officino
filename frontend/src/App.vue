<script setup>
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { logout, getCurrentUser, isAdmin } from './services/auth';
import { coldStartMessage } from './services/api';

const appVersion = __APP_VERSION__;

const route = useRoute();
const router = useRouter();
const user = computed(() => getCurrentUser());
const isLoginPage = computed(() => route.name === 'Login');
const adminUser = computed(() => isAdmin());

function handleLogout() {
  logout();
  router.push('/login');
}
</script>

<template>
  <nav v-if="!isLoginPage" class="navbar navbar-expand-md navbar-dark bg-dark mb-3">
    <div class="container-fluid">
      <router-link class="navbar-brand d-flex align-items-center gap-2" to="/">
        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" aria-hidden="true">
          <rect width="24" height="24" rx="6" fill="#f97316" />
          <path fill="white" d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z" />
        </svg>
        Officino
        <span class="badge bg-secondary opacity-75 fw-normal" style="font-size:0.65rem">v{{ appVersion }}</span>
      </router-link>

      <button
        class="navbar-toggler"
        type="button"
        data-bs-toggle="collapse"
        data-bs-target="#navbarMain"
        aria-controls="navbarMain"
        aria-expanded="false"
        aria-label="Toggle navigazione"
      >
        <span class="navbar-toggler-icon"></span>
      </button>

      <div id="navbarMain" class="collapse navbar-collapse">
        <ul class="navbar-nav me-auto mb-2 mb-md-0">
          <li class="nav-item">
            <router-link class="nav-link" active-class="active" to="/catalogo">
              <i class="bi bi-box-seam me-1"></i>Catalogo Prodotti
            </router-link>
          </li>
          <li class="nav-item">
            <router-link class="nav-link" active-class="active" to="/categorie">
              <i class="bi bi-tag me-1"></i>Categorie
            </router-link>
          </li>
          <li class="nav-item">
            <router-link class="nav-link" active-class="active" to="/clienti">
              <i class="bi bi-people me-1"></i>Clienti
            </router-link>
          </li>
          <li class="nav-item">
            <router-link class="nav-link" active-class="active" to="/preventivi">
              <i class="bi bi-file-earmark-text me-1"></i>Preventivi
            </router-link>
          </li>
          <li class="nav-item">
            <router-link class="nav-link" active-class="active" to="/rapportini">
              <i class="bi bi-journal-text me-1"></i>Rapportini
            </router-link>
          </li>
          <li v-if="adminUser" class="nav-item">
            <router-link class="nav-link" active-class="active" to="/note-lavorazione">
              <i class="bi bi-clipboard-check me-1"></i>Note Lavorazione
            </router-link>
          </li>
          <li v-if="adminUser" class="nav-item">
            <router-link class="nav-link" active-class="active" to="/utenti"><i class="bi bi-person-gear me-1"></i>Utenti</router-link>
          </li>
          <li v-if="adminUser" class="nav-item">
            <router-link class="nav-link" active-class="active" to="/impostazioni">
              <i class="bi bi-gear me-1"></i>Impostazioni
            </router-link>
          </li>
          <!-- LOG MANAGEMENT DISABLED
          <li class="nav-item">
            <router-link class="nav-link text-white-50" active-class="active text-white" to="/log">
              <i class="bi bi-clock-history me-1"></i>Log
            </router-link>
          </li>
          LOG MANAGEMENT DISABLED -->
        </ul>

        <div class="d-flex align-items-center gap-2">
          <template v-if="user">
            <span class="text-light">{{ user.nome }}</span>
            <span
              class="badge"
              :class="adminUser ? 'bg-warning text-dark' : 'bg-secondary'"
            >{{ user.ruolo }}</span>
          </template>
          <router-link class="btn btn-outline-light btn-sm" to="/guida" title="Guida">
            <i class="bi bi-question-circle me-1"></i>Guida
          </router-link>
          <button class="btn btn-outline-light btn-sm" @click="handleLogout"><i class="bi bi-box-arrow-right me-1"></i>Esci</button>
        </div>
      </div>
    </div>
  </nav>

  <div class="container-fluid">
    <div v-if="coldStartMessage && !isLoginPage" class="alert alert-warning py-2 text-center mt-2">
      <span class="spinner-border spinner-border-sm me-2"></span>{{ coldStartMessage }}
    </div>
    <router-view />
  </div>
</template>

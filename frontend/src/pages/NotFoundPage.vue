<script setup>
import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();
</script>

<template>
  <div class="container py-5 text-center">
    <div class="row justify-content-center">
      <div class="col-md-6">
        <h1 class="display-1 fw-bold text-secondary">404</h1>
        <h2 class="mb-3">Pagina non trovata</h2>
        <p class="text-muted mb-4">
          L'indirizzo <code>{{ route.fullPath }}</code> non corrisponde a nessuna pagina.<br />
          Può essere un errore di battitura o un collegamento non più valido.
        </p>
        <button class="btn btn-primary" @click="router.push('/')">
          <i class="bi bi-house me-1"></i>Torna alla dashboard
        </button>
      </div>
    </div>
  </div>
</template>

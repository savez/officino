<script setup>
import { useRouter } from 'vue-router';

const router = useRouter();
</script>

<template>
  <div class="container py-5 text-center">
    <div class="row justify-content-center">
      <div class="col-md-6">
        <h1 class="display-1 fw-bold text-danger">403</h1>
        <h2 class="mb-3">Accesso negato</h2>
        <p class="text-muted mb-4">
          Non hai i permessi necessari per accedere a questa pagina.<br />
          Contatta un amministratore se pensi che sia un errore.
        </p>
        <button class="btn btn-primary" @click="router.push('/')"><i class="bi bi-house me-1"></i>Torna alla dashboard</button>
      </div>
    </div>
  </div>
</template>

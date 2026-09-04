<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { login } from '../services/auth'
import { coldStartMessage } from '../services/api'

const router = useRouter()

const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

async function handleSubmit() {
  error.value = ''
  loading.value = true

  try {
    await login(email.value, password.value)
    router.push('/')
  } catch (err) {
    error.value = err.response?.data?.message || 'Credenziali non valide'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="row justify-content-center align-items-center min-vh-100">
    <div class="col-11 col-sm-8 col-md-5 col-lg-4">
      <div class="text-center mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 24 24" aria-hidden="true">
          <rect width="24" height="24" rx="6" fill="var(--of-marchio)" />
          <path fill="white" d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z" />
        </svg>
        <h1 class="fw-bold mt-2 mb-0" style="letter-spacing: -0.5px">Officino</h1>
        <p class="text-muted small mb-0">Gestione officina meccanica</p>
      </div>

      <div class="card shadow">
        <div class="card-body p-4">
          <h3 class="card-title text-center mb-4">Accedi</h3>

          <div v-if="coldStartMessage" class="alert alert-warning py-2 text-center">
            <span class="spinner-border spinner-border-sm me-2"></span>{{ coldStartMessage }}
          </div>

          <div v-if="error" class="alert alert-danger py-2">{{ error }}</div>

          <form @submit.prevent="handleSubmit">
            <div class="mb-3">
              <label for="email" class="form-label">Email</label>
              <input
                id="email"
                v-model="email"
                type="email"
                class="form-control"
                required
                autocomplete="email"
                autofocus
              />
            </div>

            <div class="mb-3">
              <label for="password" class="form-label">Password</label>
              <input
                id="password"
                v-model="password"
                type="password"
                class="form-control"
                required
                autocomplete="current-password"
              />
            </div>

            <button type="submit" class="btn btn-primary w-100" :disabled="loading">
              <span v-if="loading" class="spinner-border spinner-border-sm me-1"></span>
              <i class="bi bi-box-arrow-in-right me-1"></i>Entra
            </button>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

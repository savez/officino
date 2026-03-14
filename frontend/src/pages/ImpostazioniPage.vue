<script setup>
import { ref, onMounted } from 'vue';
import {
  getImpostazioni,
  updateImpostazioni,
  uploadLogo,
  deleteLogo,
} from '../services/impostazioni';
import HelpIcon from '../components/HelpIcon.vue';

// ── State ───────────────────────────────────────────────────────────

const loading = ref(false);
const saving = ref(false);
const error = ref('');
const successMsg = ref('');

// Form fields
const form = ref({
  nome: '',
  partita_iva: '',
  indirizzo: '',
  telefono: '',
  email: '',
  aliquota_iva_default: 22,
  // log_attivi: true, // LOG MANAGEMENT DISABLED
});

// Logo
const logoUrl = ref(null);
const logoFile = ref(null);
const logoInput = ref(null);
const uploadingLogo = ref(false);
const deletingLogo = ref(false);

// ── Data Loading ────────────────────────────────────────────────────

async function loadImpostazioni() {
  loading.value = true;
  error.value = '';

  try {
    const data = await getImpostazioni();
    form.value = {
      nome: data.nome || '',
      partita_iva: data.partita_iva || '',
      indirizzo: data.indirizzo || '',
      telefono: data.telefono || '',
      email: data.email || '',
      aliquota_iva_default: data.aliquota_iva_default ?? 22,
      // log_attivi: data.log_attivi ?? true, // LOG MANAGEMENT DISABLED
    };
    logoUrl.value = data.logo_base64 || data.logo_url || null;
  } catch (err) {
    error.value = 'Errore nel caricamento delle impostazioni.';
    console.error(err);
  } finally {
    loading.value = false;
  }
}

// ── Actions ─────────────────────────────────────────────────────────

function clearMessages() {
  error.value = '';
  successMsg.value = '';
}

async function onSave() {
  clearMessages();
  saving.value = true;

  try {
    await updateImpostazioni(form.value);
    successMsg.value = 'Impostazioni salvate con successo.';
  } catch (err) {
    if (err.response?.data?.error) {
      error.value = err.response.data.error;
    } else {
      error.value = 'Errore durante il salvataggio delle impostazioni.';
    }
    console.error(err);
  } finally {
    saving.value = false;
  }
}

function onFileSelected(event) {
  const file = event.target.files[0];
  if (file) {
    logoFile.value = file;
  }
}

async function onUploadLogo() {
  if (!logoFile.value) return;

  clearMessages();
  uploadingLogo.value = true;

  try {
    const data = await uploadLogo(logoFile.value);
    logoUrl.value = data.logo_base64 || data.logo_url || null;
    logoFile.value = null;
    if (logoInput.value) {
      logoInput.value.value = '';
    }
    successMsg.value = 'Logo caricato con successo.';
  } catch (err) {
    if (err.response?.data?.error) {
      error.value = err.response.data.error;
    } else {
      error.value = 'Errore durante il caricamento del logo.';
    }
    console.error(err);
  } finally {
    uploadingLogo.value = false;
  }
}

async function onDeleteLogo() {
  const ok = window.confirm('Sei sicuro di voler eliminare il logo?');
  if (!ok) return;

  clearMessages();
  deletingLogo.value = true;

  try {
    await deleteLogo();
    logoUrl.value = null;
    successMsg.value = 'Logo eliminato con successo.';
  } catch (err) {
    if (err.response?.data?.error) {
      error.value = err.response.data.error;
    } else {
      error.value = "Errore durante l'eliminazione del logo.";
    }
    console.error(err);
  } finally {
    deletingLogo.value = false;
  }
}

// ── Init ────────────────────────────────────────────────────────────

onMounted(() => {
  loadImpostazioni();
});
</script>

<template>
  <div>
    <h2 class="mb-3">
      <i class="bi bi-gear me-2"></i>Impostazioni Officina
      <HelpIcon anchor="impostazioni" />
    </h2>

    <!-- Loading -->
    <div v-if="loading" class="text-center py-5">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Caricamento...</span>
      </div>
    </div>

    <div v-else>
      <!-- Messages -->
      <div v-if="error" class="alert alert-danger alert-dismissible fade show">
        {{ error }}
        <button type="button" class="btn-close" @click="error = ''"></button>
      </div>
      <div v-if="successMsg" class="alert alert-success alert-dismissible fade show">
        {{ successMsg }}
        <button type="button" class="btn-close" @click="successMsg = ''"></button>
      </div>

      <!-- Form Card -->
      <div class="card mb-4">
        <div class="card-header">
          <h6 class="mb-0">Dati Officina</h6>
        </div>
        <div class="card-body">
          <form @submit.prevent="onSave">
            <div class="row g-3">
              <!-- Nome -->
              <div class="col-12 col-md-6">
                <label for="nome" class="form-label">Nome *</label>
                <input
                  id="nome"
                  v-model="form.nome"
                  type="text"
                  class="form-control"
                  required
                  placeholder="Nome dell'officina"
                />
              </div>

              <!-- Partita IVA -->
              <div class="col-12 col-md-6">
                <label for="partita_iva" class="form-label">Partita IVA</label>
                <input
                  id="partita_iva"
                  v-model="form.partita_iva"
                  type="text"
                  class="form-control"
                  placeholder="Partita IVA"
                />
              </div>

              <!-- Indirizzo -->
              <div class="col-12">
                <label for="indirizzo" class="form-label">Indirizzo</label>
                <textarea
                  id="indirizzo"
                  v-model="form.indirizzo"
                  class="form-control"
                  rows="2"
                  placeholder="Indirizzo completo"
                ></textarea>
              </div>

              <!-- Telefono -->
              <div class="col-12 col-md-6">
                <label for="telefono" class="form-label">Telefono</label>
                <input
                  id="telefono"
                  v-model="form.telefono"
                  type="text"
                  class="form-control"
                  placeholder="Numero di telefono"
                />
              </div>

              <!-- Email -->
              <div class="col-12 col-md-6">
                <label for="email" class="form-label">Email</label>
                <input
                  id="email"
                  v-model="form.email"
                  type="email"
                  class="form-control"
                  placeholder="Email di contatto"
                />
              </div>

              <!-- Aliquota IVA -->
              <div class="col-12 col-md-4">
                <label for="aliquota_iva" class="form-label">Aliquota IVA Predefinita (%)</label>
                <input
                  id="aliquota_iva"
                  v-model.number="form.aliquota_iva_default"
                  type="number"
                  class="form-control"
                  min="0"
                  max="100"
                  step="0.01"
                />
              </div>

              <!-- LOG MANAGEMENT DISABLED
              <div class="col-12">
                <div class="form-check mt-2">
                  <input
                    id="log_attivi"
                    v-model="form.log_attivi"
                    class="form-check-input"
                    type="checkbox"
                  />
                  <label class="form-check-label" for="log_attivi">
                    Attiva registrazione log modifiche
                  </label>
                </div>
              </div>
              LOG MANAGEMENT DISABLED -->
            </div>

            <!-- Save button -->
            <div class="mt-4">
              <button type="submit" class="btn btn-primary" :disabled="saving">
                <span
                  v-if="saving"
                  class="spinner-border spinner-border-sm me-1"
                  role="status"
                ></span>
                <i class="bi bi-floppy me-1"></i
                >{{ saving ? 'Salvataggio...' : 'Salva Impostazioni' }}
              </button>
            </div>
          </form>
        </div>
      </div>

      <!-- Logo Card -->
      <div class="card mb-4">
        <div class="card-header">
          <h6 class="mb-0">Logo Officina</h6>
        </div>
        <div class="card-body">
          <!-- Current logo -->
          <div v-if="logoUrl" class="mb-3">
            <p class="text-muted mb-2">Logo attuale:</p>
            <img
              :src="logoUrl"
              alt="Logo officina"
              class="img-thumbnail"
              style="max-height: 150px; max-width: 300px"
            />
          </div>
          <div v-else class="mb-3">
            <p class="text-muted mb-0">Nessun logo caricato.</p>
          </div>

          <!-- Upload -->
          <div class="row g-2 align-items-end">
            <div class="col-12 col-md-6">
              <label for="logoFile" class="form-label">Carica nuovo logo</label>
              <input
                id="logoFile"
                ref="logoInput"
                type="file"
                class="form-control"
                accept="image/png,image/jpeg,image/webp"
                @change="onFileSelected"
              />
              <div class="form-text">Formati accettati: PNG, JPEG, WebP</div>
            </div>
            <div class="col-12 col-md-6 d-flex gap-2">
              <button
                class="btn btn-outline-primary"
                :disabled="!logoFile || uploadingLogo"
                @click="onUploadLogo"
              >
                <span
                  v-if="uploadingLogo"
                  class="spinner-border spinner-border-sm me-1"
                  role="status"
                ></span>
                <i class="bi bi-upload me-1"></i
                >{{ uploadingLogo ? 'Caricamento...' : 'Carica Logo' }}
              </button>
              <button
                v-if="logoUrl"
                class="btn btn-outline-danger"
                :disabled="deletingLogo"
                @click="onDeleteLogo"
              >
                <span
                  v-if="deletingLogo"
                  class="spinner-border spinner-border-sm me-1"
                  role="status"
                ></span>
                <i class="bi bi-trash me-1"></i
                >{{ deletingLogo ? 'Eliminazione...' : 'Elimina Logo' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

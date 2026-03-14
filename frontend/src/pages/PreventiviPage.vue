<script setup>
import { ref, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import AppPagination from '../components/AppPagination.vue';
import PreventivoFormModal from '../components/PreventivoFormModal.vue';
import {
  getPreventivi,
  searchPreventivi,
  cambiaStato,
  deletePreventivo,
  duplicaPreventivo,
  downloadPdf,
  exportPreventivo,
  importPreventivo,
} from '../services/preventivi';
import HelpIcon from '../components/HelpIcon.vue';

const router = useRouter();

// ── State ───────────────────────────────────────────────────────────

const preventivi = ref([]);
const pagination = ref({ page: 1, totalPages: 1 });
const loading = ref(false);
const error = ref('');

// Filters
const searchQuery = ref('');
const statoFilter = ref('');

// Modals
const showFormModal = ref(false);
const editPreventivo = ref(null);
const showActionsModal = ref(false);
const selectedPreventivo = ref(null);

// PDF download
const downloadingPdfId = ref(null);

// Export/Import
const exportingId = ref(null);
const importing = ref(false);
const importFileInput = ref(null);
const successMessage = ref('');

// Debounce
let searchTimeout = null;

// ── Status config ───────────────────────────────────────────────────

const statoBadgeClass = {
  bozza: 'bg-secondary',
  approvato: 'bg-success',
  rifiutato: 'bg-danger',
  scaduto: 'bg-warning text-dark',
  fatturato: 'bg-info',
  cancellato: 'bg-dark',
};

const statoLabel = {
  bozza: 'Bozza',
  approvato: 'Approvato',
  rifiutato: 'Rifiutato',
  scaduto: 'Scaduto',
  fatturato: 'Fatturato',
  cancellato: 'Cancellato',
};

// ── Data Loading ────────────────────────────────────────────────────

async function loadData(page = 1) {
  loading.value = true;
  error.value = '';

  try {
    const params = {
      page,
      per_page: 25,
    };

    if (statoFilter.value) {
      params.stato = statoFilter.value;
    }

    let result;

    if (searchQuery.value.trim()) {
      result = await searchPreventivi({ q: searchQuery.value.trim(), ...params });
    } else {
      result = await getPreventivi(params);
    }

    preventivi.value = result.data;
    pagination.value = {
      page: result.pagination.page,
      totalPages: result.pagination.totalPages,
    };
  } catch (err) {
    error.value = 'Errore nel caricamento dei preventivi.';
    console.error(err);
  } finally {
    loading.value = false;
  }
}

// ── Actions ─────────────────────────────────────────────────────────

function onSearchInput() {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    loadData(1);
  }, 300);
}

function onSearch() {
  clearTimeout(searchTimeout);
  loadData(1);
}

function onPageChange(page) {
  loadData(page);
}

// Watch filter changes
watch(statoFilter, () => {
  loadData(1);
});

function openCreate() {
  editPreventivo.value = null;
  showFormModal.value = true;
}

function openEdit(preventivo) {
  editPreventivo.value = { ...preventivo };
  showFormModal.value = true;
}

function openActionsModal(preventivo) {
  selectedPreventivo.value = preventivo;
  showActionsModal.value = true;
}

function closeActionsModal() {
  showActionsModal.value = false;
  selectedPreventivo.value = null;
}

async function runSelectedAction(actionFn) {
  const preventivo = selectedPreventivo.value;
  if (!preventivo) return;

  closeActionsModal();
  await actionFn(preventivo);
}

function onFormSaved() {
  loadData(pagination.value.page);
}

function goToDettaglio(preventivo) {
  router.push({ name: 'PreventivoDettaglio', params: { id: preventivo.id } });
}

async function onApprova(preventivo) {
  const ok = window.confirm(
    `Sei sicuro di voler approvare il preventivo ${preventivo.numero}?\n\n` +
      "Confermi l'approvazione?"
  );
  if (!ok) return;

  try {
    await cambiaStato(preventivo.id, 'approvato');
    loadData(pagination.value.page);
  } catch {
    alert("Errore durante l'approvazione del preventivo.");
  }
}

async function onRifiuta(preventivo) {
  const ok = window.confirm(`Sei sicuro di voler rifiutare il preventivo ${preventivo.numero}?`);
  if (!ok) return;

  try {
    await cambiaStato(preventivo.id, 'rifiutato');
    loadData(pagination.value.page);
  } catch {
    alert('Errore durante il rifiuto del preventivo.');
  }
}

async function onFattura(preventivo) {
  const ok = window.confirm(
    `Sei sicuro di voler segnare come fatturato il preventivo ${preventivo.numero}?`
  );
  if (!ok) return;

  try {
    await cambiaStato(preventivo.id, 'fatturato');
    loadData(pagination.value.page);
  } catch {
    alert('Errore durante il cambio stato a fatturato.');
  }
}

async function onCancella(preventivo) {
  const ok = window.confirm(
    `Sei sicuro di voler cancellare il preventivo ${preventivo.numero}?\n\nIl preventivo verr\u00E0 segnato come cancellato (non eliminato).`
  );
  if (!ok) return;

  try {
    await cambiaStato(preventivo.id, 'cancellato');
    loadData(pagination.value.page);
  } catch {
    alert('Errore durante la cancellazione del preventivo.');
  }
}

async function onDuplica(preventivo) {
  try {
    const result = await duplicaPreventivo(preventivo.id);
    successMessage.value = `Preventivo duplicato con successo! Nuovo numero: ${result.numero}`;
    loadData(1);
  } catch (err) {
    alert(err.response?.data?.error || 'Errore durante la duplicazione del preventivo.');
  }
}

async function onDelete(preventivo) {
  const ok = window.confirm(
    `Sei sicuro di voler eliminare il preventivo ${preventivo.numero}?\nQuesta azione non \u00E8 reversibile.`
  );
  if (!ok) return;

  try {
    await deletePreventivo(preventivo.id);
    loadData(pagination.value.page);
  } catch {
    alert("Errore durante l'eliminazione del preventivo.");
  }
}

async function onDownloadPdf(preventivo) {
  downloadingPdfId.value = preventivo.id;
  try {
    await downloadPdf(preventivo.id);
  } catch (err) {
    alert('Errore durante la generazione del PDF.');
    console.error(err);
  } finally {
    downloadingPdfId.value = null;
  }
}

async function onExport(preventivo) {
  exportingId.value = preventivo.id;
  try {
    await exportPreventivo(preventivo.id);
  } catch (err) {
    alert("Errore durante l'esportazione del preventivo.");
    console.error(err);
  } finally {
    exportingId.value = null;
  }
}

function triggerImport() {
  importFileInput.value?.click();
}

async function onImportFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  importing.value = true;
  successMessage.value = '';
  error.value = '';

  try {
    const text = await file.text();
    const jsonData = JSON.parse(text);
    const result = await importPreventivo(jsonData);
    successMessage.value = `Preventivo importato con successo! Numero: ${result.numero}`;
    loadData(1);
  } catch (err) {
    if (err instanceof SyntaxError) {
      error.value = 'Il file selezionato non contiene JSON valido.';
    } else if (err.response?.data?.error) {
      error.value = "Errore durante l'importazione: " + err.response.data.error;
    } else {
      error.value = "Errore durante l'importazione del preventivo.";
    }
    console.error(err);
  } finally {
    importing.value = false;
    // Reset file input so the same file can be re-selected
    if (importFileInput.value) {
      importFileInput.value.value = '';
    }
  }
}

function formatCurrency(value) {
  if (value === null || value === undefined) return '-';
  return Number(value).toFixed(2) + ' \u20AC';
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

// ── Init ────────────────────────────────────────────────────────────

onMounted(() => {
  loadData(1);
});
</script>

<template>
  <div>
    <div class="d-flex justify-content-between align-items-center mb-3">
      <h2 class="mb-0">
        <i class="bi bi-file-earmark-text me-2"></i>Gestione Preventivi
        <HelpIcon anchor="preventivi" />
      </h2>
      <div class="d-flex gap-2">
        <button class="btn btn-outline-secondary" :disabled="importing" @click="triggerImport">
          <span v-if="importing" class="spinner-border spinner-border-sm me-1" role="status"></span>
          <i class="bi bi-upload me-1"></i>{{ importing ? 'Importazione...' : 'Importa Preventivo' }}
        </button>
        <input
          ref="importFileInput"
          type="file"
          accept=".json"
          class="d-none"
          @change="onImportFile"
        />
        <button class="btn btn-primary" @click="openCreate"><i class="bi bi-plus-lg me-1"></i>Nuovo Preventivo</button>
      </div>
    </div>

    <!-- Toolbar -->
    <div class="row g-2 mb-3">
      <!-- Search -->
      <div class="col-12 col-md-5">
        <form @submit.prevent="onSearch" class="input-group">
          <input
            v-model="searchQuery"
            type="text"
            class="form-control"
            placeholder="Cerca per numero o nome cliente..."
            @input="onSearchInput"
          />
          <button class="btn btn-outline-secondary" type="submit"><i class="bi bi-search"></i></button>
        </form>
      </div>

      <!-- Stato filter -->
      <div class="col-6 col-md-3">
        <select v-model="statoFilter" class="form-select">
          <option value="">Tutti gli stati</option>
          <option value="bozza">Bozza</option>
          <option value="approvato">Approvato</option>
          <option value="rifiutato">Rifiutato</option>
          <option value="scaduto">Scaduto</option>
          <option value="fatturato">Fatturato</option>
          <option value="cancellato">Cancellato</option>
        </select>
      </div>
    </div>

    <!-- Success -->
    <div v-if="successMessage" class="alert alert-success alert-dismissible fade show">
      {{ successMessage }}
      <button type="button" class="btn-close" @click="successMessage = ''"></button>
    </div>

    <!-- Error -->
    <div v-if="error" class="alert alert-danger">{{ error }}</div>

    <!-- Loading -->
    <div v-if="loading" class="text-center py-4">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Caricamento...</span>
      </div>
    </div>

    <!-- Table -->
    <div v-else class="table-responsive">
      <table class="table table-striped table-hover align-middle">
        <thead class="table-dark">
          <tr>
            <th>Numero</th>
            <th>Cliente</th>
            <th class="d-none d-md-table-cell">Data</th>
            <th>Stato</th>
            <th class="text-end d-none d-sm-table-cell">Totale</th>
            <th class="text-end">Azioni</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="preventivi.length === 0">
            <td colspan="6" class="text-center text-muted py-4">Nessun preventivo trovato.</td>
          </tr>
          <tr v-for="p in preventivi" :key="p.id">
            <td>
              <a
                href="#"
                class="text-decoration-none fw-semibold"
                @click.prevent="goToDettaglio(p)"
              >
                {{ p.numero }}
              </a>
            </td>
            <td>{{ p.cliente_nome || '-' }}</td>
            <td class="d-none d-md-table-cell">{{ formatDate(p.data) }}</td>
            <td>
              <span class="badge" :class="statoBadgeClass[p.stato] || 'bg-secondary'">
                {{ statoLabel[p.stato] || p.stato }}
              </span>
            </td>
            <td class="text-end d-none d-sm-table-cell">{{ formatCurrency(p.totale) }}</td>
            <td class="text-end">
              <button class="btn btn-sm btn-outline-secondary" @click="openActionsModal(p)">
                <i class="bi bi-three-dots-vertical"></i>
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <AppPagination
      :page="pagination.page"
      :total-pages="pagination.totalPages"
      @update:page="onPageChange"
    />

    <!-- Modals -->
    <PreventivoFormModal
      :show="showFormModal"
      :preventivo="editPreventivo"
      @close="showFormModal = false"
      @saved="onFormSaved"
    />

    <div
      v-if="showActionsModal && selectedPreventivo"
      class="modal fade show d-block"
      tabindex="-1"
      role="dialog"
      style="background-color: rgba(0, 0, 0, 0.5)"
      @click.self="closeActionsModal"
    >
      <div class="modal-dialog modal-dialog-scrollable" style="max-height: 90vh">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Azioni preventivo {{ selectedPreventivo.numero }}</h5>
            <button type="button" class="btn-close" @click="closeActionsModal"></button>
          </div>

          <div class="modal-body">
            <div class="d-grid gap-2">
              <button
                class="btn btn-outline-primary text-start"
                @click="runSelectedAction(goToDettaglio)"
              >
                <i class="bi bi-clipboard me-2"></i>Dettaglio
              </button>

              <button
                class="btn btn-outline-primary text-start"
                :disabled="downloadingPdfId === selectedPreventivo.id"
                @click="runSelectedAction(onDownloadPdf)"
              >
                <span
                  v-if="downloadingPdfId === selectedPreventivo.id"
                  class="spinner-border spinner-border-sm me-1"
                  role="status"
                ></span>
                <i class="bi bi-file-pdf me-2"></i>Genera PDF
              </button>

              <hr class="my-1" />

              <button
                v-if="selectedPreventivo.stato === 'bozza'"
                class="btn btn-outline-success text-start"
                @click="runSelectedAction(onApprova)"
              >
                <i class="bi bi-check-circle me-2"></i>Approva
              </button>
              <button
                v-if="selectedPreventivo.stato === 'bozza'"
                class="btn btn-outline-danger text-start"
                @click="runSelectedAction(onRifiuta)"
              >
                <i class="bi bi-x-circle me-2"></i>Rifiuta
              </button>
              <button
                v-if="selectedPreventivo.stato === 'approvato'"
                class="btn btn-outline-info text-start"
                @click="runSelectedAction(onFattura)"
              >
                <i class="bi bi-receipt me-2"></i>Fattura
              </button>
              <button
                v-if="selectedPreventivo.stato === 'approvato'"
                class="btn btn-outline-dark text-start"
                @click="runSelectedAction(onCancella)"
              >
                <i class="bi bi-slash-circle me-2"></i>Cancella
              </button>

              <hr class="my-1" />

              <button
                v-if="selectedPreventivo.stato === 'bozza'"
                class="btn btn-outline-secondary text-start"
                @click="runSelectedAction(openEdit)"
              >
                <i class="bi bi-pencil me-2"></i>Modifica
              </button>
              <button
                class="btn btn-outline-secondary text-start"
                @click="runSelectedAction(onDuplica)"
              >
                <i class="bi bi-copy me-2"></i>Duplica
              </button>
              <button
                v-if="selectedPreventivo.stato === 'bozza'"
                class="btn btn-outline-danger text-start"
                @click="runSelectedAction(onDelete)"
              >
                <i class="bi bi-trash me-2"></i>Elimina
              </button>

              <hr class="my-1" />

              <button
                class="btn btn-outline-secondary text-start"
                :disabled="exportingId === selectedPreventivo.id"
                @click="runSelectedAction(onExport)"
              >
                <span
                  v-if="exportingId === selectedPreventivo.id"
                  class="spinner-border spinner-border-sm me-1"
                  role="status"
                ></span>
                <i class="bi bi-download me-2"></i>Export JSON
              </button>
            </div>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" @click="closeActionsModal">
              <i class="bi bi-x-lg me-1"></i>Chiudi
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

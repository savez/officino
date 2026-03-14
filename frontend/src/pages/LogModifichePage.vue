<script setup>
import { ref, onMounted } from 'vue';
import AppPagination from '../components/AppPagination.vue';
import { getLogs, countLogsBefore, purgeLogsBefore } from '../services/log';

// ── State ───────────────────────────────────────────────────────────

const logs = ref([]);
const pagination = ref({ page: 1, totalPages: 1 });
const loading = ref(false);
const error = ref('');
const successMsg = ref('');

// Purge logs
const purgeDate = ref('');
const purgeCount = ref(null);
const counting = ref(false);
const purging = ref(false);
const showConfirmModal = ref(false);

// Filters
const filterEntita = ref('');
const filterAzione = ref('');
const filterDataDa = ref('');
const filterDataA = ref('');

// Expanded detail rows (set of log IDs)
const expandedRows = ref(new Set());

// ── Options ─────────────────────────────────────────────────────────

const entitaOptions = [
  { value: '', label: 'Tutti' },
  { value: 'pezzo_magazzino', label: 'Pezzo Magazzino' },
  { value: 'cliente', label: 'Cliente' },
  { value: 'preventivo', label: 'Preventivo' },
  { value: 'impostazioni', label: 'Impostazioni' },
];

const azioneOptions = [
  { value: '', label: 'Tutte' },
  { value: 'creazione', label: 'Creazione' },
  { value: 'modifica', label: 'Modifica' },
  { value: 'eliminazione', label: 'Eliminazione' },
  { value: 'cambio_stato', label: 'Cambio Stato' },
  { value: 'scalatura', label: 'Scalatura' },
  { value: 'archiviazione', label: 'Archiviazione' },
  { value: 'ripristino', label: 'Ripristino' },
];

// ── Badge Maps ──────────────────────────────────────────────────────

const entitaBadgeMap = {
  pezzo_magazzino: 'bg-primary',
  cliente: 'bg-info',
  preventivo: 'bg-success',
  impostazioni: 'bg-secondary',
};

const azioneBadgeMap = {
  creazione: 'bg-success',
  modifica: 'bg-warning text-dark',
  eliminazione: 'bg-danger',
  cambio_stato: 'bg-info',
  scalatura: 'bg-primary',
  archiviazione: 'bg-secondary',
  ripristino: 'bg-light text-dark',
};

const entitaLabelMap = {
  pezzo_magazzino: 'Pezzo Magazzino',
  cliente: 'Cliente',
  preventivo: 'Preventivo',
  impostazioni: 'Impostazioni',
};

const azioneLabelMap = {
  creazione: 'Creazione',
  modifica: 'Modifica',
  eliminazione: 'Eliminazione',
  cambio_stato: 'Cambio Stato',
  scalatura: 'Scalatura',
  archiviazione: 'Archiviazione',
  ripristino: 'Ripristino',
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

    if (filterEntita.value) params.entita = filterEntita.value;
    if (filterAzione.value) params.azione = filterAzione.value;
    if (filterDataDa.value) params.data_da = filterDataDa.value;
    if (filterDataA.value) params.data_a = filterDataA.value;

    const result = await getLogs(params);

    logs.value = result.data;
    pagination.value = {
      page: result.pagination.page,
      totalPages: result.pagination.totalPages,
    };
  } catch (err) {
    error.value = 'Errore nel caricamento dei log.';
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

function onFilter() {
  expandedRows.value.clear();
  loadData(1);
}

function onReset() {
  filterEntita.value = '';
  filterAzione.value = '';
  filterDataDa.value = '';
  filterDataA.value = '';
  expandedRows.value.clear();
  loadData(1);
}

async function onCountPurgeCandidates() {
  clearMessages();

  if (!purgeDate.value) {
    error.value = 'Seleziona una data di soglia prima di continuare.';
    return;
  }

  counting.value = true;
  try {
    const result = await countLogsBefore(purgeDate.value);
    purgeCount.value = Number(result.count || 0);
    if (purgeCount.value === 0) {
      successMsg.value = 'Nessun log da eliminare prima della data selezionata.';
    }
  } catch (err) {
    error.value = 'Errore durante il conteggio dei log da eliminare.';
    console.error(err);
  } finally {
    counting.value = false;
  }
}

function openConfirmModal() {
  clearMessages();
  if (!purgeDate.value) {
    error.value = 'Seleziona una data di soglia prima di continuare.';
    return;
  }
  if (!purgeCount.value || purgeCount.value <= 0) {
    error.value = 'Nessun log selezionato per la cancellazione.';
    return;
  }
  showConfirmModal.value = true;
}

async function onConfirmPurge() {
  clearMessages();
  purging.value = true;

  try {
    const result = await purgeLogsBefore(purgeDate.value);
    const deleted = Number(result.deleted || 0);
    successMsg.value = `Eliminati ${deleted} log con successo.`;
    purgeCount.value = 0;
    showConfirmModal.value = false;
    expandedRows.value.clear();
    await loadData(1);
  } catch (err) {
    error.value = 'Errore durante la cancellazione dei log.';
    console.error(err);
  } finally {
    purging.value = false;
  }
}

function onPageChange(page) {
  expandedRows.value.clear();
  loadData(page);
}

function toggleDetail(logId) {
  if (expandedRows.value.has(logId)) {
    expandedRows.value.delete(logId);
  } else {
    expandedRows.value.add(logId);
  }
}

// ── Formatters ──────────────────────────────────────────────────────

function formatDateTime(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}

function getEntitaBadge(entita) {
  return entitaBadgeMap[entita] || 'bg-secondary';
}

function getEntitaLabel(entita) {
  return entitaLabelMap[entita] || entita;
}

function getAzioneBadge(azione) {
  return azioneBadgeMap[azione] || 'bg-secondary';
}

function getAzioneLabel(azione) {
  return azioneLabelMap[azione] || azione;
}

/**
 * Checks whether dettaglio contains a diff-style object
 * (keys with { prima, dopo } sub-objects)
 */
function isDiffFormat(dettaglio) {
  if (!dettaglio || typeof dettaglio !== 'object') return false;
  const values = Object.values(dettaglio);
  if (values.length === 0) return false;
  return values.some((v) => v && typeof v === 'object' && ('prima' in v || 'dopo' in v));
}

function formatValue(val) {
  if (val === null || val === undefined) return '(vuoto)';
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}

// ── Init ────────────────────────────────────────────────────────────

onMounted(() => {
  loadData(1);
});
</script>

<template>
  <div>
    <h2 class="mb-3">Log Modifiche</h2>

    <!-- Purge logs -->
    <div class="card mb-3 border-danger-subtle">
      <div class="card-header bg-danger-subtle">
        <h6 class="mb-0 text-danger-emphasis">Pulizia Log</h6>
      </div>
      <div class="card-body">
        <div class="row g-2 align-items-end">
          <div class="col-12 col-md-4">
            <label class="form-label form-label-sm mb-1">Elimina log precedenti al</label>
            <input v-model="purgeDate" type="date" class="form-control form-control-sm" />
          </div>
          <div class="col-12 col-md-8 d-flex gap-2 flex-wrap">
            <button
              class="btn btn-outline-primary btn-sm"
              :disabled="counting"
              @click="onCountPurgeCandidates"
            >
              <span
                v-if="counting"
                class="spinner-border spinner-border-sm me-1"
                role="status"
              ></span>
              Conta record
            </button>
            <span v-if="purgeCount !== null" class="badge text-bg-secondary align-self-center fs-6">
              {{ purgeCount }} record
            </span>
            <button
              class="btn btn-danger btn-sm"
              :disabled="!purgeCount || purgeCount <= 0 || purging"
              @click="openConfirmModal"
            >
              Elimina
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Filters -->
    <div class="card mb-3">
      <div class="card-body py-2">
        <div class="row g-2 align-items-end">
          <!-- Entita -->
          <div class="col-6 col-md-2">
            <label class="form-label form-label-sm mb-1">Entit&agrave;</label>
            <select v-model="filterEntita" class="form-select form-select-sm">
              <option v-for="opt in entitaOptions" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </option>
            </select>
          </div>

          <!-- Azione -->
          <div class="col-6 col-md-2">
            <label class="form-label form-label-sm mb-1">Azione</label>
            <select v-model="filterAzione" class="form-select form-select-sm">
              <option v-for="opt in azioneOptions" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </option>
            </select>
          </div>

          <!-- Data Da -->
          <div class="col-6 col-md-2">
            <label class="form-label form-label-sm mb-1">Data Da</label>
            <input v-model="filterDataDa" type="date" class="form-control form-control-sm" />
          </div>

          <!-- Data A -->
          <div class="col-6 col-md-2">
            <label class="form-label form-label-sm mb-1">Data A</label>
            <input v-model="filterDataA" type="date" class="form-control form-control-sm" />
          </div>

          <!-- Buttons -->
          <div class="col-12 col-md-4 d-flex gap-2">
            <button class="btn btn-primary btn-sm" @click="onFilter">
              <i class="bi bi-funnel me-1"></i>Filtra
            </button>
            <button class="btn btn-outline-secondary btn-sm" @click="onReset">
              <i class="bi bi-arrow-counterclockwise me-1"></i>Reset
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Error -->
    <div v-if="error" class="alert alert-danger">{{ error }}</div>
    <div v-if="successMsg" class="alert alert-success">{{ successMsg }}</div>

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
            <th>Data/Ora</th>
            <th>Utente</th>
            <th>Entit&agrave;</th>
            <th class="d-none d-md-table-cell">ID Entit&agrave;</th>
            <th>Azione</th>
            <th class="text-end">Dettaglio</th>
          </tr>
        </thead>
        <tbody v-if="logs.length === 0">
          <tr>
            <td colspan="6" class="text-center text-muted py-4">Nessun log trovato.</td>
          </tr>
        </tbody>
        <tbody v-for="log in logs" :key="log.id">
          <tr>
            <td class="text-nowrap">{{ formatDateTime(log.created_at) }}</td>
            <td>{{ log.utente_nome || '-' }}</td>
            <td>
              <span class="badge" :class="getEntitaBadge(log.entita)">
                {{ getEntitaLabel(log.entita) }}
              </span>
            </td>
            <td class="d-none d-md-table-cell">{{ log.entita_id }}</td>
            <td>
              <span class="badge" :class="getAzioneBadge(log.azione)">
                {{ getAzioneLabel(log.azione) }}
              </span>
            </td>
            <td class="text-end">
              <button
                v-if="log.dettaglio"
                class="btn btn-outline-secondary btn-sm"
                @click="toggleDetail(log.id)"
              >
                <i class="bi me-1" :class="expandedRows.has(log.id) ? 'bi-eye-slash' : 'bi-eye'"></i
                >{{ expandedRows.has(log.id) ? 'Nascondi' : 'Mostra' }}
              </button>
              <span v-else class="text-muted">-</span>
            </td>
          </tr>
          <!-- Expanded detail row -->
          <tr v-if="log.dettaglio && expandedRows.has(log.id)">
            <td colspan="6" class="bg-light p-3">
              <!-- Diff format -->
              <div v-if="isDiffFormat(log.dettaglio)">
                <table class="table table-sm table-bordered mb-0">
                  <thead>
                    <tr>
                      <th>Campo</th>
                      <th>Prima</th>
                      <th>Dopo</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(val, campo) in log.dettaglio" :key="campo">
                      <td class="fw-semibold">{{ campo }}</td>
                      <td v-if="val && typeof val === 'object' && 'prima' in val">
                        <span class="text-danger">{{ formatValue(val.prima) }}</span>
                      </td>
                      <td v-else>
                        <span>{{ formatValue(val) }}</span>
                      </td>
                      <td v-if="val && typeof val === 'object' && 'dopo' in val">
                        <span class="text-success">{{ formatValue(val.dopo) }}</span>
                      </td>
                      <td v-else>-</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <!-- Generic JSON -->
              <pre v-else class="mb-0" style="white-space: pre-wrap; word-break: break-word">{{
                JSON.stringify(log.dettaglio, null, 2)
              }}</pre>
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

    <!-- Confirm purge modal -->
    <div
      v-if="showConfirmModal"
      class="modal fade show d-block"
      tabindex="-1"
      aria-modal="true"
      role="dialog"
    >
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Conferma cancellazione log</h5>
            <button
              type="button"
              class="btn-close"
              aria-label="Close"
              @click="showConfirmModal = false"
            ></button>
          </div>
          <div class="modal-body">
            <p class="mb-0">
              Stai per eliminare <strong>{{ purgeCount }}</strong> log precedenti al
              <strong>{{ purgeDate }}</strong
              >. Questa operazione è irreversibile.
            </p>
          </div>
          <div class="modal-footer">
            <button
              type="button"
              class="btn btn-outline-secondary"
              :disabled="purging"
              @click="showConfirmModal = false"
            >
              Annulla
            </button>
            <button
              type="button"
              class="btn btn-danger"
              :disabled="purging"
              @click="onConfirmPurge"
            >
              <span
                v-if="purging"
                class="spinner-border spinner-border-sm me-1"
                role="status"
              ></span>
              {{ purging ? 'Eliminazione...' : 'Conferma eliminazione' }}
            </button>
          </div>
        </div>
      </div>
    </div>
    <div v-if="showConfirmModal" class="modal-backdrop fade show"></div>
  </div>
</template>

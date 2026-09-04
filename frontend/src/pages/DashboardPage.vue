<script setup>
import { ref, computed, onMounted } from 'vue';
import { getCurrentUser, isAdmin } from '../services/auth';
import { getDashboardStats, exportOreExcel } from '../services/dashboard';
import HelpIcon from '../components/HelpIcon.vue';
import FiltroPeriodo from '../components/FiltroPeriodo.vue';
import BloccoFiltri from '../components/BloccoFiltri.vue';
import PannelloOreMancanti from '../components/PannelloOreMancanti.vue';
import MetricheRapportini from '../components/MetricheRapportini.vue';
import MetricheNote from '../components/MetricheNote.vue';
import OrePerClienteBarChart from '../components/charts/OrePerClienteBarChart.vue';
import OrePerOperaioBarChart from '../components/charts/OrePerOperaioBarChart.vue';
import OreGestiteBarChart from '../components/charts/OreGestiteBarChart.vue';

const user = computed(() => getCurrentUser());
const admin = computed(() => isAdmin());
const loading = ref(true);
const error = ref('');

// Filtro per intervallo di date. Il periodo iniziale e' il mese corrente;
// il server rimane comunque l'autorita' e restituisce le date che ha risolto,
// necessario quando si usa una scorciatoia.
const now = new Date();
const primoDelMese = new Date(now.getFullYear(), now.getMonth(), 1);
const ultimoDelMese = new Date(now.getFullYear(), now.getMonth() + 1, 0);

function formattaData(d) {
  const anno = d.getFullYear();
  const mese = String(d.getMonth() + 1).padStart(2, '0');
  const giorno = String(d.getDate()).padStart(2, '0');
  return `${anno}-${mese}-${giorno}`;
}

const periodo = ref({ da: formattaData(primoDelMese), a: formattaData(ultimoDelMese) });

// Il periodo di partenza e' il mese corrente, quindi c'e' SEMPRE un intervallo
// impostato: contarlo come filtro attivo direbbe «1 attivi» all'apertura, ogni
// volta, e il conteggio smetterebbe di significare qualcosa. Conta solo se e'
// stato cambiato rispetto a quel valore iniziale.
const periodoIniziale = { ...periodo.value };
const filtriAttivi = computed(() => {
  let n = operaioSelezionato.value ? 1 : 0;
  if (periodo.value.da !== periodoIniziale.da || periodo.value.a !== periodoIniziale.a) n += 1;
  return n;
});

const stats = ref(null);

const oreTotali = computed(() => {
  const perCliente = stats.value?.ore?.per_cliente ?? [];
  return perCliente.reduce((acc, c) => acc + c.ore_totali, 0).toFixed(1);
});
const perCliente = computed(() => stats.value?.ore?.per_cliente ?? []);
const perOperaio = computed(() => stats.value?.ore?.per_operaio ?? []);

// Le due chiavi arrivano soltanto all'amministratore. Assenti significa «non ti
// riguarda», che e' diverso da zero: per questo i componenti non si montano
// invece di mostrare quattro zeri a chi non li deve vedere.
const metricheRapportini = computed(() => stats.value?.rapportini ?? null);
const metricheNote = computed(() => stats.value?.note ?? null);

// Filtro operaio, riservato all'amministratore. Il vincolo vero e' lato
// server: qui si nasconde solo il controllo a chi non puo' usarlo.
const operaioSelezionato = ref('');
const operai = computed(() => stats.value?.operai ?? []);
const oreMancanti = computed(() => stats.value?.ore_mancanti ?? []);

// Cambiando filtro in fretta le risposte possono tornare fuori ordine: senza
// questo contatore vincerebbe l'ultima ARRIVATA invece dell'ultima CHIESTA, e
// la dashboard mostrerebbe i dati di un periodo che l'utente ha gia' lasciato.
let richiestaCorrente = 0;

async function loadStats() {
  const miaRichiesta = ++richiestaCorrente;
  loading.value = true;
  error.value = '';
  try {
    const parametri = { ...periodo.value };
    if (admin.value && operaioSelezionato.value) {
      parametri.operaio_id = operaioSelezionato.value;
    }
    const risposta = await getDashboardStats(parametri);
    if (miaRichiesta !== richiestaCorrente) return;

    stats.value = risposta;
    // Il server risolve le scorciatoie: si riallinea il filtro alle date vere.
    if (risposta.periodo) periodo.value = { ...risposta.periodo };
  } catch (err) {
    if (miaRichiesta !== richiestaCorrente) return;
    console.error('Errore caricamento dashboard:', err);
    error.value = err?.response?.data?.error || 'Errore nel caricamento dei dati. Riprova.';
  } finally {
    if (miaRichiesta === richiestaCorrente) loading.value = false;
  }
}

function onPeriodoChange(nuovo) {
  periodo.value = nuovo;
  loadStats();
}

// Il filtro operaio sopravvive al cambio di intervallo e viceversa: entrambi
// passano da loadStats, che li legge sempre entrambi.
function onOperaioChange() {
  loadStats();
}

async function onExportExcel() {
  try {
    const parametri = { ...periodo.value };
    if (admin.value && operaioSelezionato.value) {
      parametri.operaio_id = operaioSelezionato.value;
    }
    await exportOreExcel(parametri);
  } catch (err) {
    console.error('Errore export:', err);
    error.value = 'Errore nel download del file. Riprova.';
  }
}

onMounted(() => {
  loadStats();
});
</script>

<template>
  <div>
    <!-- Intestazione -->
    <h2 class="mb-1">
      <i class="bi bi-speedometer2 me-2"></i>Dashboard
      <HelpIcon anchor="dashboard" />
    </h2>
    <p class="text-muted mb-4">
      Ciao{{ user?.nome ? ' ' + user.nome : '' }}, ecco il riepilogo dell'attivita.
    </p>

    <BloccoFiltri :attivi="filtriAttivi">
      <FiltroPeriodo
        :da="periodo.da"
        :a="periodo.a"
        :disabled="loading"
        @update:periodo="onPeriodoChange"
      >
        <div v-if="admin">
          <label class="of-etichetta d-block mb-1">Operaio</label>
          <select
            v-model="operaioSelezionato"
            class="form-select"
            :disabled="loading"
            aria-label="Filtra per operaio"
            @change="onOperaioChange"
          >
            <option value="">Tutti gli operai</option>
            <option v-for="o in operai" :key="o.id" :value="o.id">{{ o.nome }}</option>
          </select>
        </div>
      </FiltroPeriodo>
    </BloccoFiltri>

    <!-- Caricamento ed esportazione stanno FUORI dall'accordion: il primo e'
         uno stato da vedere sempre, la seconda e' un'azione. Chiuderli dentro
         un pannello di filtri li renderebbe irraggiungibili sul telefono
         proprio mentre servono. -->
    <div class="d-flex align-items-center gap-2 mb-3">
      <div v-if="loading" class="spinner-border spinner-border-sm text-primary" role="status">
        <span class="visually-hidden">Caricamento...</span>
      </div>
      <button
        v-if="admin"
        class="btn btn-success btn-sm ms-auto"
        :disabled="loading"
        @click="onExportExcel"
      >
        <i class="bi bi-file-earmark-excel me-1"></i>Esporta Excel
      </button>
    </div>

    <!-- Errore -->
    <div v-if="error" class="alert alert-danger">{{ error }}</div>

    <!-- Contenuto -->
    <div v-if="!loading || stats">
      <!-- Ore mancanti: primo contenuto per entrambi i ruoli. E' l'unica voce
           della dashboard su cui si deve agire; tutto il resto descrive. -->
      <PannelloOreMancanti :ore-mancanti="oreMancanti" :admin="admin" />

      <!-- Metriche del lavoro, subito dopo: numeri prima dei grafici, che
           chiedono piu' spazio e piu' tempo per essere letti. -->
      <MetricheRapportini v-if="metricheRapportini" :conteggi="metricheRapportini" />
      <MetricheNote v-if="metricheNote" :note="metricheNote" />

      <!-- KPI Card -->
      <div class="row g-3 mb-4">
        <div class="col-12 col-md-4">
          <div class="card text-white bg-primary shadow-sm h-100">
            <div class="card-body text-center py-3">
              <div class="fs-1 fw-bold">
                {{ oreTotali }}<span class="fs-5 ms-1 opacity-75">h</span>
              </div>
              <div class="small opacity-75">Ore lavorate</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Grafico ore per operaio (solo admin) -->
      <div v-if="admin && stats" class="row g-4 mb-4">
        <div class="col-12">
          <div class="card shadow-sm">
            <div class="card-header bg-white">
              <strong><i class="bi bi-person-check me-2 text-success"></i>Ore per operaio</strong>
            </div>
            <div class="card-body">
              <OrePerOperaioBarChart :per-operaio="perOperaio" />
            </div>
          </div>
        </div>
      </div>

      <!-- Grafici riga 1: Doughnut + Barre ore per cliente -->
      <div class="row g-4 mb-4">
        <!-- Barre orizzontali ore per cliente -->
        <div class="col-12">
          <div class="card shadow-sm h-100">
            <div class="card-header bg-white">
              <strong><i class="bi bi-clock me-2 text-primary"></i>Ore per cliente</strong>
            </div>
            <div class="card-body">
              <OrePerClienteBarChart :per-cliente="perCliente" />
            </div>
          </div>
        </div>
      </div>

      <!-- Grafico riga 2: Ore gestite vs non gestite (solo admin) -->
      <div v-if="admin" class="row g-4 mb-4">
        <div class="col-12">
          <div class="card shadow-sm">
            <div class="card-header bg-white">
              <strong>
                <i class="bi bi-bar-chart-steps me-2 text-success"></i>Ore: in nota di lavorazione
                vs non gestite
              </strong>
            </div>
            <div class="card-body">
              <OreGestiteBarChart :per-cliente="perCliente" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Placeholder loading iniziale -->
    <div v-else-if="loading" class="text-center py-5">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Caricamento...</span>
      </div>
    </div>
  </div>
</template>

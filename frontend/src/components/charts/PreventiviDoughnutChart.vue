<script setup>
import { computed } from 'vue'
import { Doughnut } from 'vue-chartjs'
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js'

ChartJS.register(ArcElement, Tooltip, Legend)

const props = defineProps({
  perStato: {
    type: Object,
    required: true,
  },
})

const COLORI_STATO = {
  bozza: '#6c757d',
  approvato: '#0d6efd',
  rifiutato: '#dc3545',
  scaduto: '#fd7e14',
  fatturato: '#198754',
  cancellato: '#adb5bd',
}

const LABEL_STATO = {
  bozza: 'Bozza',
  approvato: 'Approvato',
  rifiutato: 'Rifiutato',
  scaduto: 'Scaduto',
  fatturato: 'Fatturato',
  cancellato: 'Cancellato',
}

const hasData = computed(() => {
  return Object.values(props.perStato).some((v) => v > 0)
})

const chartData = computed(() => {
  const stati = Object.keys(props.perStato).filter((s) => props.perStato[s] > 0)
  return {
    labels: stati.map((s) => LABEL_STATO[s] || s),
    datasets: [
      {
        data: stati.map((s) => props.perStato[s]),
        backgroundColor: stati.map((s) => COLORI_STATO[s] || '#999'),
        borderWidth: 2,
        borderColor: '#fff',
      },
    ],
  }
})

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'bottom',
      labels: {
        padding: 16,
        font: { size: 13 },
      },
    },
    tooltip: {
      callbacks: {
        label: (ctx) => ` ${ctx.label}: ${ctx.parsed} preventivi`,
      },
    },
  },
}
</script>

<template>
  <div>
    <div v-if="!hasData" class="text-center text-muted py-4">
      <i class="bi bi-inbox fs-3 d-block mb-2"></i>
      Nessun preventivo nel periodo
    </div>
    <div v-else style="position: relative; height: 280px;">
      <Doughnut :data="chartData" :options="chartOptions" />
    </div>
  </div>
</template>

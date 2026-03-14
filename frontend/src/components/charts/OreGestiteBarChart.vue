<script setup>
import { computed } from 'vue'
import { Bar } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend)

const props = defineProps({
  perCliente: {
    type: Array,
    required: true,
  },
})

const TOP_N = 10

const hasData = computed(() => props.perCliente.length > 0)

const top = computed(() =>
  [...props.perCliente]
    .sort((a, b) => b.ore_totali - a.ore_totali)
    .slice(0, TOP_N)
)

const chartData = computed(() => ({
  labels: top.value.map((c) => c.cliente_nome),
  datasets: [
    {
      label: 'In nota di lavorazione',
      data: top.value.map((c) => c.ore_in_nota),
      backgroundColor: '#198754',
      borderRadius: 4,
    },
    {
      label: 'Non gestite',
      data: top.value.map((c) => c.ore_non_gestite),
      backgroundColor: '#fd7e14',
      borderRadius: 4,
    },
  ],
}))

const chartOptions = {
  indexAxis: 'y',
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'bottom',
      labels: { padding: 16, font: { size: 13 } },
    },
    tooltip: {
      callbacks: {
        label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.x.toFixed(1)} h`,
      },
    },
  },
  scales: {
    x: {
      beginAtZero: true,
      stacked: false,
      ticks: { callback: (v) => `${v}h` },
    },
    y: { stacked: false },
  },
}
</script>

<template>
  <div>
    <div v-if="!hasData" class="text-center text-muted py-4">
      <i class="bi bi-clock fs-3 d-block mb-2"></i>
      Nessuna ora registrata nel periodo
    </div>
    <div v-else :style="{ position: 'relative', height: Math.max(200, top.length * 36 + 60) + 'px' }">
      <Bar :data="chartData" :options="chartOptions" />
    </div>
  </div>
</template>

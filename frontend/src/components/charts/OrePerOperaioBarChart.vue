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
  perOperaio: {
    type: Array,
    required: true,
  },
})

const hasData = computed(() => props.perOperaio.length > 0)

const sorted = computed(() =>
  [...props.perOperaio]
    .sort((a, b) => b.ore_totali - a.ore_totali)
)

const chartData = computed(() => ({
  labels: sorted.value.map((o) => o.utente_nome),
  datasets: [
    {
      label: 'Ore totali',
      data: sorted.value.map((o) => o.ore_totali),
      backgroundColor: '#6f42c1',
      borderRadius: 4,
    },
  ],
}))

const chartOptions = {
  indexAxis: 'y',
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        label: (ctx) => ` ${ctx.parsed.x.toFixed(1)} h`,
      },
    },
  },
  scales: {
    x: {
      beginAtZero: true,
      ticks: { callback: (v) => `${v}h` },
    },
  },
}
</script>

<template>
  <div>
    <div v-if="!hasData" class="text-center text-muted py-4">
      <i class="bi bi-clock fs-3 d-block mb-2"></i>
      Nessuna ora registrata nel periodo
    </div>
    <div v-else :style="{ position: 'relative', height: Math.max(200, sorted.length * 36 + 40) + 'px' }">
      <Bar :data="chartData" :options="chartOptions" />
    </div>
  </div>
</template>

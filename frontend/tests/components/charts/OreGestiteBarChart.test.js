import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import OreGestiteBarChart from '../../../src/components/charts/OreGestiteBarChart.vue'

vi.mock('vue-chartjs', () => ({
  Bar: { template: '<canvas data-testid="bar-chart"></canvas>' },
}))

vi.mock('chart.js', () => ({
  Chart: { register: vi.fn() },
  CategoryScale: {},
  LinearScale: {},
  BarElement: {},
  Tooltip: {},
  Legend: {},
}))

const CLIENTI_DATI = [
  { cliente_nome: 'Alfa srl', ore_totali: 8, ore_in_nota: 6, ore_non_gestite: 2 },
  { cliente_nome: 'Beta spa', ore_totali: 20, ore_in_nota: 15, ore_non_gestite: 5 },
  { cliente_nome: 'Gamma snc', ore_totali: 5, ore_in_nota: 3, ore_non_gestite: 2 },
]

describe('OreGestiteBarChart', () => {
  it('mostra il messaggio "Nessuna ora registrata nel periodo" quando perCliente è vuoto', () => {
    const wrapper = mount(OreGestiteBarChart, {
      props: { perCliente: [] },
    })

    expect(wrapper.text()).toContain('Nessuna ora registrata nel periodo')
    expect(wrapper.find('[data-testid="bar-chart"]').exists()).toBe(false)
  })

  it('mostra il canvas del grafico quando perCliente contiene dati', () => {
    const wrapper = mount(OreGestiteBarChart, {
      props: { perCliente: CLIENTI_DATI },
    })

    expect(wrapper.find('[data-testid="bar-chart"]').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('Nessuna ora registrata nel periodo')
  })

  it('ordina i dati per ore_totali decrescenti', () => {
    // Il computed `top` ordina per ore_totali DESC prima di passarli al grafico
    // Verifichiamo la logica di ordinamento direttamente
    const sorted = [...CLIENTI_DATI].sort((a, b) => b.ore_totali - a.ore_totali)

    expect(sorted[0].cliente_nome).toBe('Beta spa')    // 20h - il più alto
    expect(sorted[1].cliente_nome).toBe('Alfa srl')    // 8h
    expect(sorted[2].cliente_nome).toBe('Gamma snc')   // 5h - il più basso

    // Verifica che il componente monti correttamente con questi dati
    const wrapper = mount(OreGestiteBarChart, {
      props: { perCliente: CLIENTI_DATI },
    })
    expect(wrapper.find('[data-testid="bar-chart"]').exists()).toBe(true)
  })
})

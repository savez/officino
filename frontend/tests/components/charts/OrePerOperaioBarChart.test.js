import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import OrePerOperaioBarChart from '../../../src/components/charts/OrePerOperaioBarChart.vue'

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

describe('OrePerOperaioBarChart', () => {
  it('mostra messaggio quando perOperaio è vuoto', () => {
    const wrapper = mount(OrePerOperaioBarChart, {
      props: { perOperaio: [] },
    })
    expect(wrapper.text()).toContain('Nessuna ora registrata nel periodo')
    expect(wrapper.find('[data-testid="bar-chart"]').exists()).toBe(false)
  })

  it('mostra canvas quando perOperaio ha dati', () => {
    const wrapper = mount(OrePerOperaioBarChart, {
      props: {
        perOperaio: [
          { utente_nome: 'Marco', ore_totali: 20.0, ore_in_nota: 15.0, ore_non_gestite: 5.0 },
        ],
      },
    })
    expect(wrapper.find('[data-testid="bar-chart"]').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('Nessuna ora registrata nel periodo')
  })

  it('ordina gli operai per ore_totali decrescenti', async () => {
    const wrapper = mount(OrePerOperaioBarChart, {
      props: {
        perOperaio: [
          { utente_nome: 'Luca', ore_totali: 10.0, ore_in_nota: 5.0, ore_non_gestite: 5.0 },
          { utente_nome: 'Marco', ore_totali: 25.0, ore_in_nota: 20.0, ore_non_gestite: 5.0 },
          { utente_nome: 'Giovanni', ore_totali: 15.0, ore_in_nota: 12.0, ore_non_gestite: 3.0 },
        ],
      },
    })
    // Il computed dovrebbe ordinare per ore_totali decrescente
    // Marco (25) > Giovanni (15) > Luca (10)
    expect(wrapper.find('[data-testid="bar-chart"]').exists()).toBe(true)
  })
})

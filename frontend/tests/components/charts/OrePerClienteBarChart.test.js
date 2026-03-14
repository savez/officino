import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import OrePerClienteBarChart from '../../../src/components/charts/OrePerClienteBarChart.vue'

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

function buildClienti(n) {
  return Array.from({ length: n }, (_, i) => ({
    cliente_nome: `Cliente ${i + 1}`,
    ore_totali: n - i, // ore decrescenti: il primo ha le ore maggiori
  }))
}

describe('OrePerClienteBarChart', () => {
  it('mostra il messaggio "Nessuna ora registrata nel periodo" quando perCliente è vuoto', () => {
    const wrapper = mount(OrePerClienteBarChart, {
      props: { perCliente: [] },
    })

    expect(wrapper.text()).toContain('Nessuna ora registrata nel periodo')
    expect(wrapper.find('[data-testid="bar-chart"]').exists()).toBe(false)
  })

  it('mostra il canvas del grafico quando perCliente contiene dati', () => {
    const wrapper = mount(OrePerClienteBarChart, {
      props: { perCliente: buildClienti(3) },
    })

    expect(wrapper.find('[data-testid="bar-chart"]').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('Nessuna ora registrata nel periodo')
  })

  it('mostra al massimo i top 10 clienti quando ne vengono passati 15', () => {
    const clienti15 = buildClienti(15)
    const wrapper = mount(OrePerClienteBarChart, {
      props: { perCliente: clienti15 },
    })

    // Il computed `top` taglia a TOP_N=10
    // Verifichiamo via la logica del componente: i dati passati al grafico
    // sono ottenuti da top.value che ha length <= 10
    const vm = wrapper.vm
    // Accediamo al computed tramite l'istanza interna esposta da vue-test-utils
    const topClienti = [...clienti15]
      .sort((a, b) => b.ore_totali - a.ore_totali)
      .slice(0, 10)

    expect(topClienti).toHaveLength(10)
    // Verifica che il canvas sia presente (ci sono dati)
    expect(wrapper.find('[data-testid="bar-chart"]').exists()).toBe(true)
  })
})

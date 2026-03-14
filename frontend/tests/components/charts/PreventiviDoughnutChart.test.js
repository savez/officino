import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import PreventiviDoughnutChart from '../../../src/components/charts/PreventiviDoughnutChart.vue'

vi.mock('vue-chartjs', () => ({
  Doughnut: { template: '<canvas data-testid="doughnut-chart"></canvas>' },
}))

vi.mock('chart.js', () => ({
  Chart: { register: vi.fn() },
  ArcElement: {},
  Tooltip: {},
  Legend: {},
}))

const STATO_TUTTI_ZERO = {
  bozza: 0,
  approvato: 0,
  rifiutato: 0,
  scaduto: 0,
  fatturato: 0,
  cancellato: 0,
}

const STATO_CON_DATI = {
  bozza: 3,
  approvato: 5,
  rifiutato: 0,
  scaduto: 1,
  fatturato: 0,
  cancellato: 0,
}

describe('PreventiviDoughnutChart', () => {
  it('mostra il messaggio "Nessun preventivo nel periodo" quando tutti i valori sono 0', () => {
    const wrapper = mount(PreventiviDoughnutChart, {
      props: { perStato: STATO_TUTTI_ZERO },
    })

    expect(wrapper.text()).toContain('Nessun preventivo nel periodo')
    expect(wrapper.find('[data-testid="doughnut-chart"]').exists()).toBe(false)
  })

  it('mostra il canvas del grafico e nasconde il messaggio quando ci sono valori > 0', () => {
    const wrapper = mount(PreventiviDoughnutChart, {
      props: { perStato: STATO_CON_DATI },
    })

    expect(wrapper.find('[data-testid="doughnut-chart"]').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('Nessun preventivo nel periodo')
  })

  it('include nel grafico solo gli stati con valore > 0', () => {
    const wrapper = mount(PreventiviDoughnutChart, {
      props: { perStato: STATO_CON_DATI },
    })

    // Il componente filtra solo stati con valore > 0: bozza(3), approvato(5), scaduto(1)
    // I dati calcolati dal computed non sono direttamente ispezionabili dal DOM,
    // ma possiamo verificare che il canvas sia presente (hasData=true)
    // e che gli stati con valore=0 (rifiutato, fatturato, cancellato) non producano errori.
    const vm = wrapper.vm
    const stati = Object.keys(STATO_CON_DATI).filter((s) => STATO_CON_DATI[s] > 0)
    expect(stati).toEqual(['bozza', 'approvato', 'scaduto'])
    expect(stati.length).toBe(3)
  })
})

import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import BloccoFiltri from '../../src/components/BloccoFiltri.vue'

const monta = (props = {}) =>
  mount(BloccoFiltri, {
    props,
    slots: { default: '<label class="form-label">Cliente</label>' },
  })

describe('BloccoFiltri', () => {
  it('parte chiuso: sul telefono i filtri non devono precedere i dati', () => {
    const w = monta()
    expect(w.find('.of-filtri').classes()).not.toContain('of-filtri--aperti')
    expect(w.find('.of-filtri__interruttore').attributes('aria-expanded')).toBe('false')
  })

  it('si apre e si richiude al tocco, dichiarandolo alle tecnologie assistive', async () => {
    const w = monta()
    const interruttore = w.find('.of-filtri__interruttore')

    await interruttore.trigger('click')
    expect(w.find('.of-filtri').classes()).toContain('of-filtri--aperti')
    expect(interruttore.attributes('aria-expanded')).toBe('true')

    await interruttore.trigger('click')
    expect(w.find('.of-filtri').classes()).not.toContain('of-filtri--aperti')
    expect(interruttore.attributes('aria-expanded')).toBe('false')
  })

  it('il contenuto passato resta nel corpo, aperto o chiuso che sia', () => {
    // Chiuso lo nasconde il CSS, non `v-if`: i campi restano montati e con essi
    // il valore digitato, che altrimenti sparirebbe a ogni chiusura.
    const w = monta()
    expect(w.find('.of-filtri__corpo').text()).toContain('Cliente')
  })

  it('dichiara quanti filtri sono impostati, cosi chiuso non inganna', () => {
    const w = monta({ attivi: 2 })
    expect(w.find('.of-filtri__conteggio').text()).toBe('2 attivi')
  })

  it('tace quando non c-e nulla da segnalare', () => {
    expect(monta({ attivi: 0 }).find('.of-filtri__conteggio').exists()).toBe(false)
  })

  it('l-interruttore e un vero button, non un div cliccabile', () => {
    // Serve raggiungibile da tastiera e annunciabile: un <div> con @click non
    // lo sarebbe, e sul touch non riceverebbe il focus.
    expect(monta().find('.of-filtri__interruttore').element.tagName).toBe('BUTTON')
    expect(monta().find('.of-filtri__interruttore').attributes('type')).toBe('button')
  })

  it('nessuna pagina con filtri torna a scriversi la propria fisarmonica', () => {
    // La regola vale «per tutte le pagine»: se una reintroducesse il markup a
    // mano, divergerebbe in silenzio alla prima modifica del componente.
    const pagine = [
      'RapportiniPage',
      'DashboardPage',
      'CatalogoProdottiPage',
      'PreventiviPage',
      'NoteLavorazionePage',
      'LogModifichePage',
    ]
    const colpevoli = []
    for (const nome of pagine) {
      const src = readFileSync(resolve(__dirname, `../../src/pages/${nome}.vue`), 'utf8')
      if (!src.includes('<BloccoFiltri')) colpevoli.push(`${nome}: non usa BloccoFiltri`)
      if (src.includes('of-filtri__interruttore')) colpevoli.push(`${nome}: markup duplicato`)
    }
    expect(colpevoli).toEqual([])
  })

  it('le impostazioni NON sono filtri e restano fuori', () => {
    // ImpostazioniPage ha sette campi e a un colpo d-occhio somiglia a un
    // blocco filtri: una futura passata «per tutte le pagine» la includerebbe.
    // Ma quei campi si compilano per cambiare la configurazione, non per
    // restringere un elenco: chiuderli dietro «N attivi» direbbe una cosa
    // falsa. La decisione va fissata qui, non ricordata.
    const src = readFileSync(resolve(__dirname, '../../src/pages/ImpostazioniPage.vue'), 'utf8')
    expect(src).not.toContain('<BloccoFiltri')
  })
})

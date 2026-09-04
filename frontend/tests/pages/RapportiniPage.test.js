import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

const getRapportini = vi.fn()
const cancellaRapportino = vi.fn().mockResolvedValue({})
const chiudiRapportino = vi.fn().mockResolvedValue({})
const riapriRapportino = vi.fn().mockResolvedValue({})
const stampaRapportini = vi.fn().mockResolvedValue({})

vi.mock('../../src/services/rapportini', () => ({
  getRapportini: (...a) => getRapportini(...a),
  cancellaRapportino: (...a) => cancellaRapportino(...a),
  chiudiRapportino: (...a) => chiudiRapportino(...a),
  riapriRapportino: (...a) => riapriRapportino(...a),
  stampaRapportini: (...a) => stampaRapportini(...a),
}))

let ruoloCorrente = 'admin'
let idUtenteCorrente = 1
vi.mock('../../src/services/auth', () => ({
  isAdmin: () => ruoloCorrente === 'admin',
  getCurrentUser: () => ({ id: idUtenteCorrente, ruolo: ruoloCorrente }),
}))

vi.mock('../../src/services/api', () => ({
  default: { get: vi.fn().mockResolvedValue({ data: [] }) },
}))

// vi.mock viene sollevato in cima al file: un ciclo non funziona, perche' la
// variabile non esiste ancora quando la chiamata viene eseguita.
vi.mock('../../src/components/RapportinoFormModal.vue', () => ({
  default: { name: 'RapportinoFormModal', template: '<div />' },
}))
vi.mock('../../src/components/LavorazioneFormModal.vue', () => ({
  default: { name: 'LavorazioneFormModal', template: '<div />' },
}))
vi.mock('../../src/components/RapportinoDettaglioModal.vue', () => ({
  default: { name: 'RapportinoDettaglioModal', template: '<div />' },
}))
vi.mock('../../src/components/NotaLavorazioneFormModal.vue', () => ({
  default: { name: 'NotaLavorazioneFormModal', template: '<div />' },
}))
vi.mock('../../src/components/HelpIcon.vue', () => ({
  default: { name: 'HelpIcon', template: '<span />' },
}))
vi.mock('../../src/components/FiltroPeriodo.vue', () => ({
  default: { name: 'FiltroPeriodo', template: '<div />' },
}))

import RapportiniPage from '../../src/pages/RapportiniPage.vue'

/**
 * Costruisce una risposta paginata con i rapportini indicati.
 * @param {object[]} righe - rapportini da restituire
 * @returns {object} risposta con la stessa forma dell'API
 */
function risposta(righe) {
  return {
    data: righe,
    pagination: { page: 1, per_page: 20, total: righe.length, totalPages: 1 },
    ore_totali_filtrate: righe.reduce((acc, r) => acc + (r.totale_ore || 0), 0),
  }
}

const rapportino = (campi = {}) => ({
  id: 1,
  utente_id: 2,
  utente_nome: 'Mario Bianchi',
  cliente_id: 5,
  cliente_nome: 'Azienda Rossi',
  macchina: 'Trattore JD 6130R',
  stato: 'aperto',
  periodo: { da: '2026-08-31', a: '2026-09-02' },
  totale_ore: 7.5,
  numero_lavorazioni: 2,
  ...campi,
})

async function monta() {
  const wrapper = mount(RapportiniPage)
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  vi.clearAllMocks()
  ruoloCorrente = 'admin'
  idUtenteCorrente = 1
  getRapportini.mockResolvedValue(risposta([rapportino()]))
})

describe('RapportiniPage — elenco per macchinario', () => {
  it('mostra periodo, macchinario, operaio e totale ore', async () => {
    const w = await monta()
    const testo = w.text()
    expect(testo).toContain('Trattore JD 6130R')
    expect(testo).toContain('Mario Bianchi')
    expect(testo).toContain('31/08/2026 — 02/09/2026')
    expect(testo).toContain('7,50')
  })

  // Una cella vuota si legge come un difetto di caricamento, non come un
  // rapportino appena creato.
  it('un rapportino senza lavorazioni dichiara "nessuna lavorazione"', async () => {
    getRapportini.mockResolvedValue(
      risposta([rapportino({ periodo: null, totale_ore: 0, numero_lavorazioni: 0 })]),
    )
    const w = await monta()
    expect(w.text()).toContain('nessuna lavorazione')
  })

  it('un rapportino di un solo giorno mostra quel giorno, non un intervallo', async () => {
    getRapportini.mockResolvedValue(
      risposta([rapportino({ periodo: { da: '2026-09-01', a: '2026-09-01' } })]),
    )
    const w = await monta()
    // Cercata per CONTENUTO e non per indice: la posizione della colonna e'
    // cambiata quando la striscia di stato e' diventata la prima cella, e un
    // test legato all'indice si rompe a ogni ritocco della tabella senza dire
    // nulla di utile.
    const celle = w.findAll('tbody td').map((c) => c.text())
    expect(celle).toContain('01/09/2026')
    // E il trattino lungo non compare: e' un giorno solo, non un intervallo.
    expect(celle.some((t) => t.includes('—'))).toBe(false)
  })

  // Senza questa spiegazione un rapportino che copre gennaio e marzo,
  // comparendo con il filtro di febbraio, sembra un errore.
  // La spiegazione e' passata da paragrafo a suggerimento su richiesta
  // dell'utente: da paragrafo occupava quattro righe in cima alla schermata del
  // telefono. Resta raggiungibile, ma non e' piu' testo visibile — quindi si
  // verifica nel markup e non in `text()`.
  it('spiega il significato del filtro per periodo, come suggerimento', async () => {
    const w = await monta()
    expect(w.html()).toMatch(/almeno una lavorazione/i)
  })
})

describe('RapportiniPage — azioni disponibili per stato', () => {
  it('su un rapportino aperto compaiono aggiungi lavorazione e dettaglio', async () => {
    const w = await monta()
    const testo = w.text()
    expect(testo).toContain('Aggiungi lavorazione')
    expect(testo).toContain('Dettaglio')
  })

  it("su un rapportino chiuso l'amministratore vede Riapri, non Aggiungi", async () => {
    getRapportini.mockResolvedValue(risposta([rapportino({ stato: 'chiuso' })]))
    const w = await monta()
    expect(w.text()).toContain('Riapri')
    expect(w.text()).not.toContain('Aggiungi lavorazione')
  })

  it("un operaio non vede Riapri: è riservato all'amministratore", async () => {
    ruoloCorrente = 'user'
    idUtenteCorrente = 2
    getRapportini.mockResolvedValue(risposta([rapportino({ stato: 'chiuso' })]))
    const w = await monta()
    expect(w.text()).not.toContain('Riapri')
  })

  it('solo l autore vede Concludi, e solo con almeno una lavorazione', async () => {
    ruoloCorrente = 'user'
    idUtenteCorrente = 2
    const w = await monta()
    expect(w.text()).toContain('Concludi')
  })

  it('un rapportino vuoto non si può concludere', async () => {
    ruoloCorrente = 'user'
    idUtenteCorrente = 2
    getRapportini.mockResolvedValue(
      risposta([rapportino({ numero_lavorazioni: 0, periodo: null, totale_ore: 0 })]),
    )
    const w = await monta()
    expect(w.text()).not.toContain('Concludi')
  })

  it('l operaio non vede Elimina su un rapportino con lavorazioni', async () => {
    ruoloCorrente = 'user'
    idUtenteCorrente = 2
    const w = await monta()
    expect(w.text()).not.toContain('Elimina')
  })

  it('l operaio vede Elimina su un rapportino vuoto: è la via d uscita da un macchinario scritto male', async () => {
    ruoloCorrente = 'user'
    idUtenteCorrente = 2
    getRapportini.mockResolvedValue(
      risposta([rapportino({ numero_lavorazioni: 0, periodo: null, totale_ore: 0 })]),
    )
    const w = await monta()
    expect(w.text()).toContain('Elimina')
  })
})

describe('RapportiniPage — selezione per la nota di lavorazione', () => {
  it('solo i rapportini conclusi sono selezionabili', async () => {
    getRapportini.mockResolvedValue(
      risposta([rapportino({ id: 1, stato: 'aperto' }), rapportino({ id: 2, stato: 'chiuso' })]),
    )
    const w = await monta()
    expect(w.findAll('input[type="checkbox"]')).toHaveLength(1)
  })

  it('un operaio non vede la selezione né il pulsante della nota', async () => {
    ruoloCorrente = 'user'
    idUtenteCorrente = 2
    getRapportini.mockResolvedValue(risposta([rapportino({ stato: 'chiuso' })]))
    const w = await monta()
    expect(w.findAll('input[type="checkbox"]')).toHaveLength(0)
    expect(w.text()).not.toContain('Crea nota di lavorazione')
  })

  it('selezionando clienti diversi compare un avviso', async () => {
    getRapportini.mockResolvedValue(
      risposta([
        rapportino({ id: 1, stato: 'chiuso', cliente_id: 5 }),
        rapportino({ id: 2, stato: 'chiuso', cliente_id: 9 }),
      ]),
    )
    const w = await monta()
    const caselle = w.findAll('input[type="checkbox"]')
    await caselle[0].trigger('change')
    await caselle[1].trigger('change')
    expect(w.text()).toMatch(/clienti diversi/i)
  })
})

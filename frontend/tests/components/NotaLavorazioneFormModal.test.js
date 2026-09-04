import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import NotaLavorazioneFormModal from '../../src/components/NotaLavorazioneFormModal.vue'

const creaNota = vi.fn().mockResolvedValue({})
const aggiornaNota = vi.fn().mockResolvedValue({})

const getRiassunto = vi.fn().mockResolvedValue('')
vi.mock('../../src/services/note-lavorazione', () => ({
  creaNota: (...args) => creaNota(...args),
  aggiornaNota: (...args) => aggiornaNota(...args),
  getRiassunto: (...args) => getRiassunto(...args),
}))

// Il modale chiede il dettaglio dei rapportini selezionati: l'elenco non porta
// con se' le lavorazioni.
const getRapportino = vi.fn()
vi.mock('../../src/services/rapportini', () => ({
  getRapportino: (...args) => getRapportino(...args),
}))

/**
 * Due rapportini, ciascuno con una lavorazione. Gli stessi valori di prima —
 * 3h a 20 con 13 di materiali, 2h a 25 con 2 di materiali — cosi' i totali
 * attesi restano confrontabili.
 * @returns {object[]} rapportini come li restituisce l'elenco
 */
function makeRapportini() {
  return [
    { id: 1, cliente_id: 1, cliente_nome: 'ACME', macchina: 'Trattore', utente_nome: 'Mario' },
    { id: 2, cliente_id: 1, cliente_nome: 'ACME', macchina: 'Mietitrebbia', utente_nome: 'Anna' },
  ]
}

/**
 * Il dettaglio che il modale carica per ciascun rapportino.
 * @param {number} id - identificatore del rapportino
 * @returns {object} dettaglio con le lavorazioni
 */
function dettaglioDi(id) {
  if (id === 1) {
    return {
      id: 1,
      macchina: 'Trattore',
      utente_nome: 'Mario',
      lavorazioni: [
        {
          id: 10,
          giorno: '2026-05-19',
          ore: 3,
          costo_orario_applicato: 20,
          materiali: [
            { id: 101, nome: 'Vite', quantita: 4, fuori_catalogo: false, prezzo_unitario: 2 },
            { id: 102, nome: 'Cavo libero', quantita: 1, fuori_catalogo: true, prezzo_unitario: 5 },
          ],
        },
      ],
    }
  }
  return {
    id: 2,
    macchina: 'Mietitrebbia',
    utente_nome: 'Anna',
    lavorazioni: [
      {
        id: 11,
        giorno: '2026-05-19',
        ore: 2,
        costo_orario_applicato: 25,
        materiali: [
          { id: 103, nome: 'Dado', quantita: 2, fuori_catalogo: false, prezzo_unitario: 1 },
        ],
      },
    ],
  }
}

describe('NotaLavorazioneFormModal — costi (feature 010 / US5)', () => {
  beforeEach(() => {
    creaNota.mockClear()
    aggiornaNota.mockClear()
    getRapportino.mockClear()
    getRapportino.mockImplementation((id) => Promise.resolve(dettaglioDi(Number(id))))
    getRiassunto.mockClear()
    getRiassunto.mockResolvedValue('01/09/2026\nNota generata')
  })

  it('mostra il pannello costi con i totali calcolati iniziali', async () => {
    const wrapper = mount(NotaLavorazioneFormModal, {
      props: { show: true, rapportini: makeRapportini(), nota: null },
    })
    await flushPromises()

    // riga 10: materiali = 4*2 + 1*5 = 13; manodopera = 3*20 = 60; tot = 73
    expect(wrapper.find('[data-testid="riga-10-subtotale-materiali"]').text()).toContain('13.00')
    expect(wrapper.find('[data-testid="riga-10-manodopera"]').text()).toContain('60.00')
    expect(wrapper.find('[data-testid="riga-10-totale"]').text()).toContain('73.00')

    // totali globali: materiali = 13 + 2 = 15; manodopera = 60 + 50 = 110; tot = 125
    expect(wrapper.find('[data-testid="totale-materiali"]').text()).toContain('15.00')
    expect(wrapper.find('[data-testid="totale-manodopera"]').text()).toContain('110.00')
    expect(wrapper.find('[data-testid="totale-calcolato"]').text()).toContain('125.00')
  })

  it('aggiorna i totali quando cambia il prezzo di un materiale', async () => {
    const wrapper = mount(NotaLavorazioneFormModal, {
      props: { show: true, rapportini: makeRapportini(), nota: null },
    })
    await flushPromises()

    // Cambia prezzo della Vite (id 101) da 2 a 10 → subtotale materiali riga 10 = 4*10 + 1*5 = 45
    const input = wrapper.find('[data-testid="materiale-101-prezzo"]')
    await input.setValue('10')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="riga-10-subtotale-materiali"]').text()).toContain('45.00')
    // tot calcolato globale = 45 + 60 + 2 + 50 = 157
    expect(wrapper.find('[data-testid="totale-calcolato"]').text()).toContain('157.00')
  })

  it('aggiorna il totale manodopera quando cambia il costo orario riga', async () => {
    const wrapper = mount(NotaLavorazioneFormModal, {
      props: { show: true, rapportini: makeRapportini(), nota: null },
    })
    await flushPromises()

    const input = wrapper.find('[data-testid="riga-10-costo-orario"]')
    await input.setValue('40')
    await wrapper.vm.$nextTick()

    // manodopera riga 10 = 3*40 = 120; tot manodopera = 120 + 50 = 170
    expect(wrapper.find('[data-testid="riga-10-manodopera"]').text()).toContain('120.00')
    expect(wrapper.find('[data-testid="totale-manodopera"]').text()).toContain('170.00')
  })

  it('mostra "Override attivo" e "Discrepanza" quando totale_override differisce dal calcolato', async () => {
    const wrapper = mount(NotaLavorazioneFormModal, {
      props: { show: true, rapportini: makeRapportini(), nota: null },
    })
    await flushPromises()

    // tot calcolato = 125; set override = 200 → discrepanza
    await wrapper.find('[data-testid="totale-override"]').setValue('200')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="override-attivo-badge"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="override-discrepanza-badge"]').exists()).toBe(true)

    // Se l'override coincide col calcolato: niente discrepanza
    await wrapper.find('[data-testid="totale-override"]').setValue('125')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="override-attivo-badge"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="override-discrepanza-badge"]').exists()).toBe(false)
  })

  it('i due dettagli sono interruttori indipendenti', async () => {
    const wrapper = mount(NotaLavorazioneFormModal, {
      props: { show: true, rapportini: makeRapportini(), nota: null },
    })
    await flushPromises()

    await wrapper.find('[data-testid="dettaglio-materiali"]').setValue(false)
    await wrapper.find('[data-testid="dettaglio-manodopera"]').setValue(true)
    await wrapper.vm.$nextTick()

    expect(wrapper.vm.form.mostra_dettaglio_materiali).toBe(false)
    expect(wrapper.vm.form.mostra_dettaglio_manodopera).toBe(true)
  })

  it('al submit in edit invia modifiche_costi con prezzi/costi modificati', async () => {
    const nota = {
      id: 99,
      cliente_id: 1,
      cliente_nome: 'ACME',
      testo: '',
      mostra_dettagli: true,
      modalita_pdf: 'dettaglio_materiali',
      totale_override: null,
    }
    const wrapper = mount(NotaLavorazioneFormModal, {
      props: { show: true, rapportini: makeRapportini(), nota },
    })
    await flushPromises()

    // Cambia prezzo materiale 101 da 2 a 3 e costo orario riga 11 da 25 a 30.
    await wrapper.find('[data-testid="materiale-101-prezzo"]').setValue('3')
    await wrapper.find('[data-testid="riga-11-costo-orario"]').setValue('30')
    await wrapper.vm.$nextTick()

    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(aggiornaNota).toHaveBeenCalledTimes(1)
    const [id, payload] = aggiornaNota.mock.calls[0]
    expect(id).toBe(99)
    expect(payload.modifiche_costi).toEqual(
      expect.arrayContaining([
        { tipo: 'materiale_prezzo', materiale_id: 101, prezzo_unitario: 3 },
        { tipo: 'lavorazione_costo_orario', lavorazione_id: 11, costo_orario_applicato: 30 },
      ]),
    )
    expect(payload.modifiche_costi.length).toBe(2)
  })

  it('l invio porta data, interruttori e divisione', async () => {
    const wrapper = mount(NotaLavorazioneFormModal, {
      props: { show: true, rapportini: makeRapportini(), nota: null },
    })
    await flushPromises()

    await wrapper.find('[data-testid="data-riferimento"]').setValue('2026-07-15')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    const [payload] = creaNota.mock.calls[0]
    expect(payload.data_riferimento).toBe('2026-07-15')
    expect(payload).toHaveProperty('mostra_dettaglio_materiali')
    expect(payload).toHaveProperty('mostra_dettaglio_manodopera')
    expect(payload).toHaveProperty('divisione')
  })

  it('totale_override < 0 produce errore di validazione e blocca il submit', async () => {
    const wrapper = mount(NotaLavorazioneFormModal, {
      props: { show: true, rapportini: makeRapportini(), nota: null },
    })
    await flushPromises()

    await wrapper.find('[data-testid="totale-override"]').setValue('-5')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(creaNota).not.toHaveBeenCalled()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('NotaLavorazioneFormModal — riassunto precompilato', () => {
  beforeEach(() => {
    creaNota.mockClear()
    aggiornaNota.mockClear()
    getRapportino.mockClear()
    getRapportino.mockImplementation((id) => Promise.resolve(dettaglioDi(Number(id))))
    getRiassunto.mockClear()
    getRiassunto.mockResolvedValue('01/09/2026\nNota generata')
  })

  it('in creazione parte compilato col testo generato', async () => {
    const wrapper = mount(NotaLavorazioneFormModal, {
      props: { show: true, rapportini: makeRapportini(), nota: null },
    })
    await flushPromises()
    expect(wrapper.vm.form.testo).toBe('01/09/2026\nNota generata')
  })

  it('un testo NON toccato si rigenera al cambio di selezione', async () => {
    const wrapper = mount(NotaLavorazioneFormModal, {
      props: { show: true, rapportini: makeRapportini(), nota: null },
    })
    await flushPromises()

    getRiassunto.mockResolvedValue('02/09/2026\nAltra nota')
    await wrapper.setProps({ rapportini: [makeRapportini()[0]] })
    await flushPromises()

    expect(wrapper.vm.form.testo).toBe('02/09/2026\nAltra nota')
  })

  // Perdere un testo scritto a mano e' un danno silenzioso: si scopre a
  // documento gia' consegnato.
  it('un testo MODIFICATO resta intatto al cambio di selezione', async () => {
    const wrapper = mount(NotaLavorazioneFormModal, {
      props: { show: true, rapportini: makeRapportini(), nota: null },
    })
    await flushPromises()

    wrapper.vm.form.testo = 'Testo scritto a mano'
    await wrapper.vm.$nextTick()

    getRiassunto.mockResolvedValue('02/09/2026\nAltra nota')
    await wrapper.setProps({ rapportini: [makeRapportini()[0]] })
    await flushPromises()

    expect(wrapper.vm.form.testo).toBe('Testo scritto a mano')
  })

  it('segnala che il testo e stato modificato', async () => {
    const wrapper = mount(NotaLavorazioneFormModal, {
      props: { show: true, rapportini: makeRapportini(), nota: null },
    })
    await flushPromises()
    expect(wrapper.find('[data-testid="riassunto-modificato"]').exists()).toBe(false)

    wrapper.vm.form.testo = 'Testo mio'
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="riassunto-modificato"]').exists()).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// La regola "un totale imposto spegne il dettaglio corrispondente" e' duplicata
// nell'interfaccia, perche' durante la composizione la nota non e' ancora
// salvata e non c'e' una risposta del server da usare. Questi casi sono gli
// stessi del controllo lato server: se le due divergessero, l'interfaccia
// manderebbe richieste che il server respinge, oppure spegnerebbe interruttori
// che potevano restare accesi.
describe('NotaLavorazioneFormModal — i dettagli seguono i totali imposti', () => {
  beforeEach(() => {
    getRapportino.mockImplementation((id) => Promise.resolve(dettaglioDi(Number(id))))
    getRiassunto.mockResolvedValue('')
  })

  async function monta() {
    const w = mount(NotaLavorazioneFormModal, {
      props: { show: true, rapportini: makeRapportini(), nota: null },
    })
    await flushPromises()
    return w
  }

  it('il totale materiali imposto disabilita e spegne il suo dettaglio', async () => {
    const w = await monta()
    await w.find('[data-testid="override-materiali"]').setValue('300')
    await w.vm.$nextTick()

    expect(w.find('[data-testid="dettaglio-materiali"]').attributes('disabled')).toBeDefined()
    expect(w.vm.form.mostra_dettaglio_materiali).toBe(false)
    expect(w.find('[data-testid="dettaglio-manodopera"]').attributes('disabled')).toBeUndefined()
  })

  it('il totale complessivo imposto disabilita entrambi', async () => {
    const w = await monta()
    await w.find('[data-testid="totale-override"]').setValue('900')
    await w.vm.$nextTick()

    expect(w.find('[data-testid="dettaglio-materiali"]').attributes('disabled')).toBeDefined()
    expect(w.find('[data-testid="dettaglio-manodopera"]').attributes('disabled')).toBeDefined()
  })

  it('togliendo l override il dettaglio torna selezionabile', async () => {
    const w = await monta()
    await w.find('[data-testid="override-materiali"]').setValue('300')
    await w.vm.$nextTick()
    await w.find('[data-testid="override-materiali"]').setValue('')
    await w.vm.$nextTick()

    expect(w.find('[data-testid="dettaglio-materiali"]').attributes('disabled')).toBeUndefined()
  })

  // Zero e un totale imposto: un intervento in garanzia.
  it('zero spegne il dettaglio come qualunque altro valore', async () => {
    const w = await monta()
    await w.find('[data-testid="override-materiali"]').setValue('0')
    await w.vm.$nextTick()
    expect(w.find('[data-testid="dettaglio-materiali"]').attributes('disabled')).toBeDefined()
  })

  it('viene spiegato perche un dettaglio e spento', async () => {
    const w = await monta()
    expect(w.find('[data-testid="motivo-dettagli-spenti"]').exists()).toBe(false)
    await w.find('[data-testid="override-materiali"]').setValue('300')
    await w.vm.$nextTick()
    expect(w.find('[data-testid="motivo-dettagli-spenti"]').exists()).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('NotaLavorazioneFormModal — unione o divisione', () => {
  beforeEach(() => {
    getRapportino.mockImplementation((id) => Promise.resolve(dettaglioDi(Number(id))))
    getRiassunto.mockResolvedValue('')
  })

  it('con piu di un rapportino la domanda compare', async () => {
    const w = mount(NotaLavorazioneFormModal, {
      props: { show: true, rapportini: makeRapportini(), nota: null },
    })
    await flushPromises()
    expect(w.find('[data-testid="scelta-divisione"]').exists()).toBe(true)
  })

  // Con uno solo, unione e divisione danno lo stesso documento: chiederlo
  // sarebbe una domanda senza conseguenze.
  it('con un solo rapportino la domanda NON compare', async () => {
    const w = mount(NotaLavorazioneFormModal, {
      props: { show: true, rapportini: [makeRapportini()[0]], nota: null },
    })
    await flushPromises()
    expect(w.find('[data-testid="scelta-divisione"]').exists()).toBe(false)
  })
})

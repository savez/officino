import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ElencoRapportini from '../../src/components/ElencoRapportini.vue'

vi.mock('../../src/services/auth', () => ({ isAdmin: () => true }))

const rapportino = (campi = {}) => ({
  id: 1,
  utente_id: 2,
  utente_nome: 'Mario Bianchi',
  cliente_id: 5,
  cliente_nome: 'Azienda Rossi',
  macchina: 'Trattore JD 6130R',
  stato: 'aperto',
  periodo: { da: '2026-08-31', a: '2026-09-02' },
  totale_ore: 14.5,
  numero_lavorazioni: 2,
  ...campi,
})

const vero = () => true
const falso = () => false

function monta(rapportini, opzioni = {}) {
  return mount(ElencoRapportini, {
    props: {
      rapportini,
      admin: false,
      selezionati: [],
      puoAggiungere: vero,
      puoConcludere: falso,
      puoRiaprire: falso,
      puoEliminare: falso,
      selezionabile: falso,
      periodoLeggibile: (r) => (r.periodo ? `${r.periodo.da} — ${r.periodo.a}` : 'nessuna lavorazione'),
      formattaOre: (n) => (Number(n) || 0).toFixed(2).replace('.', ','),
      ...opzioni,
    },
    global: { stubs: { StatoRapportino: { props: ['stato', 'forma'], template: '<span :data-stato="stato" :data-forma="forma"></span>' } } },
  })
}

const schede = (w) => w.find('.d-lg-none')
const tabella = (w) => w.find('.d-none.d-lg-block')

// ─────────────────────────────────────────────────────────────────────────────
// È il controllo che tiene insieme la scelta di avere DUE impaginazioni invece
// di una che si adatta. Sono due blocchi di marcatura distinti, e due blocchi
// divergono: basta aggiungere una colonna da una parte e dimenticarla
// dall'altra. Senza questo, la divergenza si scoprirebbe quando un operaio vede
// una riga che al PC non c'è — e a quel punto nessuno saprebbe quale delle due
// sia giusta.
describe('le due forme mostrano gli STESSI record', () => {
  const elenco = [
    rapportino({ id: 1, macchina: 'Trattore JD 6130R', totale_ore: 14.5 }),
    rapportino({ id: 2, macchina: 'Mietitrebbia CX', totale_ore: 6, stato: 'chiuso' }),
    rapportino({ id: 3, macchina: 'Escavatore CAT 320', totale_ore: 22.25, stato: 'gestito' }),
  ]

  it('ogni macchinario compare in entrambe', () => {
    const w = monta(elenco)
    for (const r of elenco) {
      expect(schede(w).text()).toContain(r.macchina)
      expect(tabella(w).text()).toContain(r.macchina)
    }
  })

  it('ogni valore di ore compare in entrambe', () => {
    const w = monta(elenco)
    for (const atteso of ['14,50', '6,00', '22,25']) {
      expect(schede(w).text()).toContain(atteso)
      expect(tabella(w).text()).toContain(atteso)
    }
  })

  it('il numero di voci coincide', () => {
    const w = monta(elenco)
    expect(schede(w).findAll('.of-targhetta')).toHaveLength(elenco.length)
    expect(tabella(w).findAll('tbody tr')).toHaveLength(elenco.length)
  })

  it('gli stati coincidono, nello stesso ordine', () => {
    const w = monta(elenco)
    const daScheda = schede(w).findAll('[data-forma="striscia"]').map((n) => n.attributes('data-stato'))
    const daTabella = tabella(w).findAll('[data-forma="striscia"]').map((n) => n.attributes('data-stato'))
    expect(daScheda).toEqual(['aperto', 'chiuso', 'gestito'])
    expect(daTabella).toEqual(daScheda)
  })

  it('un elenco vuoto non rende voci in nessuna delle due', () => {
    const w = monta([])
    expect(schede(w).findAll('.of-targhetta')).toHaveLength(0)
    expect(tabella(w).findAll('tbody tr')).toHaveLength(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('il vocabolario sopravvive alla soglia', () => {
  it('la striscia di stato c è in entrambe', () => {
    const w = monta([rapportino()])
    expect(schede(w).find('[data-forma="striscia"]').exists()).toBe(true)
    expect(tabella(w).find('[data-forma="striscia"]').exists()).toBe(true)
  })

  it('nessuna delle due decide il colore da sé: passa da StatoRapportino', () => {
    const w = monta([rapportino()])
    expect(w.html()).not.toMatch(/--of-ottone|--of-abete|--of-ardesia/)
  })

  it('le ore sono tabulari in entrambe', () => {
    const w = monta([rapportino()])
    expect(schede(w).find('.of-ore').exists()).toBe(true)
    expect(tabella(w).find('.of-ore').exists()).toBe(true)
  })

  it('le ore sono allineate a destra nella tabella', () => {
    const w = monta([rapportino()])
    expect(tabella(w).find('td.text-end.of-ore').exists()).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('la scheda, sul telefono', () => {
  it("l'azione principale è a tutta larghezza", () => {
    const w = monta([rapportino()])
    const primaria = schede(w).find('.of-azione-primaria')
    expect(primaria.exists()).toBe(true)
    expect(primaria.text()).toBe('Aggiungi lavorazione')
  })

  // Con una mano sola il pollice arriva in fondo, non in cima: è il vincolo
  // dominante, più della dimensione dei comandi.
  it("l'azione principale sta DOPO il contenuto, non prima", () => {
    const w = monta([rapportino()])
    const html = schede(w).html()
    expect(html.indexOf('of-targhetta__macchina')).toBeLessThan(html.indexOf('of-azione-primaria'))
  })

  // Un comando distruttivo non confina con quello che si usa più spesso.
  it("l'eliminazione non sta nello stesso gruppo delle azioni frequenti", () => {
    const w = monta([rapportino()], { puoEliminare: vero })
    const gruppo = schede(w).find('.of-azioni-frequenti')
    expect(gruppo.text()).not.toContain('Elimina')
    expect(schede(w).text()).toContain('Elimina rapportino')
  })

  it('un rapportino senza lavorazioni lo dichiara invece di lasciare vuoto', () => {
    const w = monta([rapportino({ periodo: null, totale_ore: 0 })])
    expect(schede(w).text()).toContain('nessuna lavorazione')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('la tabella, sul monitor', () => {
  it('la selezione compare solo per l amministratore', () => {
    expect(monta([rapportino()], { admin: false }).findAll('input[type="checkbox"]')).toHaveLength(0)
    const w = monta([rapportino()], { admin: true, selezionabile: vero })
    expect(tabella(w).findAll('input[type="checkbox"]')).toHaveLength(1)
  })

  it('la striscia di stato è la PRIMA cella della riga', () => {
    const w = monta([rapportino()])
    const prima = tabella(w).find('tbody tr td')
    expect(prima.classes()).toContain('of-cella-stato')
    expect(prima.find('[data-forma="striscia"]').exists()).toBe(true)
  })
})

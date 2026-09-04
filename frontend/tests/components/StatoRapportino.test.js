import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import StatoRapportino from '../../src/components/StatoRapportino.vue'

const monta = (props) => mount(StatoRapportino, { props })

describe('StatoRapportino — i tre stati', () => {
  it.each([
    ['aperto', 'var(--of-ottone)', 'Aperto'],
    ['chiuso', 'var(--of-abete)', 'Concluso'],
    ['gestito', 'var(--of-ardesia)', 'In nota di lavorazione'],
  ])('%s usa %s e dice «%s»', (stato, colore, testo) => {
    const w = monta({ stato })
    expect(w.text()).toBe(testo)
    expect(w.attributes('style')).toContain(colore)
  })

  // Un colore sbagliato significherebbe un'altra cosa; un'etichetta strana no.
  it('uno stato sconosciuto non rende nulla di colorato', () => {
    const w = monta({ stato: 'inventato' })
    expect(w.text()).toBe('inventato')
    expect(w.attributes('style')).not.toContain('--of-ottone')
    expect(w.attributes('style')).not.toContain('--of-abete')
    expect(w.attributes('style')).not.toContain('--of-ardesia')
  })
})

// È ciò che rende lo stato leggibile a chi non distingue i colori. Nella forma
// a striscia il testo non è visibile, ma dev'essere annunciato: altrimenti lo
// stato dipenderebbe dal solo colore.
describe('StatoRapportino — lo stato non dipende dal solo colore', () => {
  it("nella forma a etichetta la parola c'è, scritta", () => {
    expect(monta({ stato: 'aperto', forma: 'etichetta' }).text()).toBe('Aperto')
  })

  it('nella forma a striscia la parola è comunque annunciata', () => {
    const w = monta({ stato: 'aperto', forma: 'striscia' })
    expect(w.attributes('aria-label')).toContain('Aperto')
    expect(w.attributes('role')).toBe('img')
  })

  it.each([['aperto'], ['chiuso'], ['gestito']])(
    'la striscia di %s porta sempre la sua etichetta',
    (stato) => {
      expect(monta({ stato, forma: 'striscia' }).attributes('aria-label')).toMatch(/Stato: \S/)
    },
  )
})

describe('StatoRapportino — forma', () => {
  it('la striscia usa la classe della striscia', () => {
    expect(monta({ stato: 'aperto', forma: 'striscia' }).classes()).toContain('of-striscia')
  })

  it("l'etichetta è il valore predefinito", () => {
    expect(monta({ stato: 'aperto' }).classes()).toContain('of-stato-testo')
  })
})

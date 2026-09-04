import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MetricheNote from '../../src/components/MetricheNote.vue'

const monta = (note) => mount(MetricheNote, { props: { note } })

describe('MetricheNote', () => {
  it('mostra numero e importo', () => {
    const t = monta({ numero: 7, importo: 4820 }).text()
    expect(t).toContain('7')
    expect(t).toMatch(/4820,00/)
    expect(t).toMatch(/€/)
  })

  it('formatta in italiano: virgola decimale, e migliaia solo da cinque cifre', () => {
    // In italiano il separatore delle migliaia compare solo a partire da cinque
    // cifre: 4820 resta «4820,00», 48200 diventa «48.200,00». Non e' una
    // stranezza dell'ambiente ma la regola della lingua, ed e' scritta qui
    // perche' il prossimo che legge «4820,00» non la corregga credendola un
    // difetto.
    expect(monta({ numero: 1, importo: 4820 }).text()).toMatch(/4820,00/)
    expect(monta({ numero: 1, importo: 48200 }).text()).toMatch(/48\.200,00/)
  })

  it('accorda il singolare', () => {
    expect(monta({ numero: 1, importo: 100 }).text()).toContain('emessa nel periodo')
    expect(monta({ numero: 2, importo: 100 }).text()).toContain('emesse nel periodo')
  })

  it('un periodo senza note dichiara zero invece di tacere', () => {
    const t = monta({ numero: 0, importo: 0 }).text()
    expect(t).toContain('0')
    expect(t).toMatch(/0,00/)
  })

  it('con importo null NON mostra una cifra', () => {
    // `null` non e' zero: significa «non attribuibile». Mostrare 0,00 € sarebbe
    // una cifra falsa, e ometterla senza dirlo si leggerebbe come un guasto.
    const w = monta({ numero: 3, importo: null })
    expect(w.text()).toContain('3')
    expect(w.text()).not.toMatch(/€/)
    expect(w.find('.of-metriche__numero--importo').exists()).toBe(false)
  })

  it('spiega perche l importo non compare', () => {
    const t = monta({ numero: 3, importo: null }).text()
    expect(t).toMatch(/filtro per operaio/i)
    expect(t).toMatch(/più persone/i)
  })

  it('distingue null da zero', () => {
    expect(monta({ numero: 0, importo: 0 }).text()).toMatch(/€/)
    expect(monta({ numero: 0, importo: null }).text()).not.toMatch(/€/)
  })
})

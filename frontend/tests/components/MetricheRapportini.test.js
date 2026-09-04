import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import MetricheRapportini from '../../src/components/MetricheRapportini.vue'

const PIENI = { aperti: 12, chiusi: 5, gestiti: 9, senza_lavorazioni: 2 }

const monta = (conteggi = PIENI) => mount(MetricheRapportini, { props: { conteggi } })

describe('MetricheRapportini', () => {
  it('mostra i tre stati con i loro numeri', () => {
    const t = monta().text()
    expect(t).toContain('12')
    expect(t).toContain('5')
    expect(t).toContain('9')
  })

  it('mostra i rapportini senza lavorazioni come voce distinta', () => {
    const w = monta()
    expect(w.find('.of-metriche__voce--vuoti').exists()).toBe(true)
    expect(w.find('.of-metriche__voce--vuoti').text()).toContain('2')
  })

  it('mostra la voce «senza lavorazioni» anche quando vale zero', () => {
    // E' il modo in cui lo scarto con l'elenco dei rapportini si dichiara.
    // Nasconderla a zero lo renderebbe scopribile solo per caso.
    const w = monta({ aperti: 3, chiusi: 0, gestiti: 0, senza_lavorazioni: 0 })
    const vuoti = w.find('.of-metriche__voce--vuoti')
    expect(vuoti.exists()).toBe(true)
    expect(vuoti.text()).toContain('0')
  })

  it('dichiara a parole un periodo senza rapportini', () => {
    // Uno spazio vuoto non si distingue da un guasto.
    const w = monta({ aperti: 0, chiusi: 0, gestiti: 0, senza_lavorazioni: 0 })
    expect(w.text()).toMatch(/nessun rapportino/i)
  })

  it('spiega perche i vuoti sono contati a parte', () => {
    // A schermo la somma sembra un'incoerenza finche' non la si legge.
    expect(monta().text()).toMatch(/nessun periodo può escluderli/i)
  })

  it('regge conteggi mancanti senza rompersi', () => {
    expect(monta({}).text()).toMatch(/nessun rapportino/i)
  })

  it('non decide da se i colori degli stati', () => {
    // I tre stati hanno gia' un colore, deciso in `StatoRapportino`. Un secondo
    // punto di decisione e' il modo in cui due schermate finiscono per mostrare
    // lo stesso stato in due modi.
    const src = readFileSync(
      resolve(__dirname, '../../src/components/MetricheRapportini.vue'),
      'utf8',
    )
    expect(src).toContain('StatoRapportino')
    expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(src).not.toMatch(/--of-(ottone|abete|ardesia)/)
  })
})

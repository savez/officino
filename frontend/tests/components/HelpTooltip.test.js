import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { Tooltip } from '../../src/bootstrap-js'
import HelpTooltip from '../../src/components/HelpTooltip.vue'

const TESTO = 'I rapportini senza lavorazioni compaiono sempre.'

describe('HelpTooltip', () => {
  it('registra davvero un tooltip di Bootstrap sull-elemento', () => {
    // Il difetto originale: il componente cercava `window.bootstrap.Tooltip`,
    // che sotto Vite non esiste, e una guardia `?.` faceva passare l-assenza
    // in silenzio. Nessun tooltip si apriva, in nessuna pagina, e nessun test
    // se ne accorgeva. Qui si verifica l-istanza, non il markup.
    const w = mount(HelpTooltip, { props: { text: TESTO }, attachTo: document.body })
    expect(Tooltip.getInstance(w.element)).not.toBeNull()
    w.unmount()
  })

  it('smonta l-istanza insieme al componente', () => {
    const w = mount(HelpTooltip, { props: { text: TESTO }, attachTo: document.body })
    const el = w.element
    w.unmount()
    expect(Tooltip.getInstance(el)).toBeNull()
  })

  it('e un button: sul touch il focus arriva solo cosi', () => {
    // `hover` non esiste sul telefono, che e' il dispositivo principale. Un
    // <span tabindex="0"> non riceve il focus al tocco su iOS Safari; un
    // <button> si.
    const w = mount(HelpTooltip, { props: { text: TESTO } })
    expect(w.element.tagName).toBe('BUTTON')
    expect(w.attributes('type')).toBe('button')
  })

  it('resta leggibile da chi non vede l-icona', () => {
    const w = mount(HelpTooltip, { props: { text: TESTO } })
    expect(w.attributes('aria-label')).toBe(TESTO)
  })
})

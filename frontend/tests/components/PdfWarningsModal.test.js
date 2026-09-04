import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PdfWarningsModal from '../../src/components/PdfWarningsModal.vue'

const warningsSample = {
  has_warnings: true,
  lavorazioni_costo_orario_zero: [
    {
      lavorazione_id: 1,
      giorno: '2026-05-19',
      ore: 4,
      macchina: 'Trattore JD',
      utente_nome: 'Mario',
    },
  ],
  materiali_prezzo_zero: [
    { lavorazione_id: 1, materiale_id: 10, nome: 'Cavo libero', fuori_catalogo: true },
    { lavorazione_id: 2, materiale_id: 11, nome: 'Vite', fuori_catalogo: false },
  ],
}

describe('PdfWarningsModal', () => {
  it('non viene renderizzato se show=false', () => {
    const wrapper = mount(PdfWarningsModal, {
      props: { show: false, warnings: warningsSample },
    })
    expect(wrapper.find('.modal.d-block').exists()).toBe(false)
  })

  it('mostra le righe con costo orario zero e i materiali a prezzo zero', () => {
    const wrapper = mount(PdfWarningsModal, {
      props: { show: true, warnings: warningsSample },
    })
    expect(wrapper.find('[data-testid="lavorazioni-zero-section"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="lavorazione-zero-item"]')).toHaveLength(1)
    expect(wrapper.findAll('[data-testid="materiale-zero-item"]')).toHaveLength(2)
  })

  it('emette confirm cliccando "Genera comunque"', async () => {
    const wrapper = mount(PdfWarningsModal, {
      props: { show: true, warnings: warningsSample },
    })
    await wrapper.find('[data-testid="pdf-warnings-confirm"]').trigger('click')
    expect(wrapper.emitted().confirm).toBeTruthy()
  })

  it('emette cancel cliccando "Annulla" o close', async () => {
    const wrapper = mount(PdfWarningsModal, {
      props: { show: true, warnings: warningsSample },
    })
    await wrapper.find('[data-testid="pdf-warnings-cancel"]').trigger('click')
    expect(wrapper.emitted().cancel).toBeTruthy()
  })

  it('quando una sezione è vuota non viene renderizzata', () => {
    const wrapper = mount(PdfWarningsModal, {
      props: {
        show: true,
        warnings: {
          has_warnings: true,
          lavorazioni_costo_orario_zero: [],
          materiali_prezzo_zero: warningsSample.materiali_prezzo_zero,
        },
      },
    })
    expect(wrapper.find('[data-testid="lavorazioni-zero-section"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="materiali-zero-section"]').exists()).toBe(true)
  })
})

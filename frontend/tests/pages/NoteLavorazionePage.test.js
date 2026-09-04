import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import NoteLavorazionePage from '../../src/pages/NoteLavorazionePage.vue'

const getNote = vi.fn()
const getNota = vi.fn()
const cancellaNota = vi.fn()
const stampaNota = vi.fn()
const getPdfWarnings = vi.fn()

vi.mock('../../src/services/note-lavorazione', () => ({
  getNote: (...a) => getNote(...a),
  getNota: (...a) => getNota(...a),
  cancellaNota: (...a) => cancellaNota(...a),
  stampaNota: (...a) => stampaNota(...a),
  getPdfWarnings: (...a) => getPdfWarnings(...a),
  // unused below but exported by the real module
  creaNota: vi.fn(),
  aggiornaNota: vi.fn(),
}))

vi.mock('../../src/services/rapportini', () => ({
  getRighe: vi.fn().mockResolvedValue({ data: [] }),
}))

vi.mock('../../src/services/api', () => ({
  default: { get: vi.fn().mockResolvedValue({ data: [] }) },
}))

vi.mock('../../src/components/NotaLavorazioneFormModal.vue', () => ({
  default: { name: 'NotaLavorazioneFormModalStub', template: '<div />' },
}))
vi.mock('../../src/components/HelpIcon.vue', () => ({
  default: { name: 'HelpIconStub', template: '<span />' },
}))

const sampleNote = [
  { id: 1, cliente_id: 1, cliente_nome: 'A', testo: '', num_righe: 2, ore_totali: 5, created_at: '2026-05-19' },
]

describe('NoteLavorazionePage — flusso PDF con warnings (US6)', () => {
  beforeEach(() => {
    getNote.mockReset().mockResolvedValue({ data: sampleNote, pagination: { totalPages: 1, total: 1 } })
    getPdfWarnings.mockReset()
    stampaNota.mockReset().mockResolvedValue(undefined)
  })

  it('senza warning chiama stampaNota direttamente senza aprire il modal', async () => {
    getPdfWarnings.mockResolvedValue({
      has_warnings: false,
      righe_costo_orario_zero: [],
      materiali_prezzo_zero: [],
    })
    const wrapper = mount(NoteLavorazionePage)
    await flushPromises()

    await wrapper.find('button[title="Stampa"]').trigger('click')
    await flushPromises()

    expect(getPdfWarnings).toHaveBeenCalledWith(1)
    expect(stampaNota).toHaveBeenCalledTimes(1)
    expect(stampaNota).toHaveBeenCalledWith(1)
    expect(wrapper.find('[data-testid="pdf-warnings-confirm"]').exists()).toBe(false)
  })

  it('con warning apre il modal e non chiama stampaNota finché non si conferma', async () => {
    getPdfWarnings.mockResolvedValue({
      has_warnings: true,
      righe_costo_orario_zero: [
        { riga_id: 9, giorno: '2026-05-19', ora_inizio: '09:00', ora_fine: '11:00', utente_nome: 'Mario' },
      ],
      materiali_prezzo_zero: [],
    })
    const wrapper = mount(NoteLavorazionePage)
    await flushPromises()

    await wrapper.find('button[title="Stampa"]').trigger('click')
    await flushPromises()

    expect(stampaNota).not.toHaveBeenCalled()
    const confirm = wrapper.find('[data-testid="pdf-warnings-confirm"]')
    expect(confirm.exists()).toBe(true)

    await confirm.trigger('click')
    await flushPromises()

    expect(stampaNota).toHaveBeenCalledTimes(1)
    expect(stampaNota).toHaveBeenCalledWith(1)
  })

  it('annullare il modal non chiama stampaNota', async () => {
    getPdfWarnings.mockResolvedValue({
      has_warnings: true,
      righe_costo_orario_zero: [],
      materiali_prezzo_zero: [
        { riga_id: 9, materiale_id: 100, nome: 'X', fuori_catalogo: true },
      ],
    })
    const wrapper = mount(NoteLavorazionePage)
    await flushPromises()

    await wrapper.find('button[title="Stampa"]').trigger('click')
    await flushPromises()

    await wrapper.find('[data-testid="pdf-warnings-cancel"]').trigger('click')
    await flushPromises()

    expect(stampaNota).not.toHaveBeenCalled()
  })
})

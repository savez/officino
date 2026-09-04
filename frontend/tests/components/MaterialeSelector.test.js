import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import MaterialeSelector from '../../src/components/MaterialeSelector.vue'

// Stub html5-qrcode (used by BarcodeScannerModal).
vi.mock('html5-qrcode', () => ({
  Html5Qrcode: class {
    constructor() {}
    start() { return Promise.resolve() }
    stop() { return Promise.resolve() }
    clear() {}
    getState() { return 1 }
  },
}))

// Stub catalogo service used by MaterialeSelector.
const searchCatalogoMock = vi.fn()
const getCatalogoByBarcodeMock = vi.fn()
vi.mock('../../src/services/catalogo', () => ({
  searchCatalogo: (...args) => searchCatalogoMock(...args),
  getCatalogoByBarcode: (...args) => getCatalogoByBarcodeMock(...args),
}))

/**
 * Helper: returns the latest payload emitted via `update:materiali`.
 * @param {import('@vue/test-utils').VueWrapper} wrapper
 */
function lastEmittedMateriali(wrapper) {
  const events = wrapper.emitted('update:materiali')
  expect(events, 'no update:materiali emitted').toBeTruthy()
  return events[events.length - 1][0]
}

/**
 * Run the debounced search inside MaterialeSelector and wait for the
 * search results dropdown to be populated. Uses fake timers so we don't
 * actually wait 300ms.
 */
async function triggerSearch(wrapper, term, results) {
  searchCatalogoMock.mockResolvedValueOnce({ data: results })
  const input = wrapper.find('input[placeholder^="Cerca"]')
  await input.setValue(term)
  // The component debounces by 300ms. Advance timers then flush microtasks.
  vi.advanceTimersByTime(350)
  await flushPromises()
}

describe('MaterialeSelector — prezzo unitario', () => {
  it('precompila prezzo_unitario con prezzo_vendita del catalogo dopo la selezione', async () => {
    vi.useFakeTimers()
    const wrapper = mount(MaterialeSelector, { props: { materiali: [] } })

    await triggerSearch(wrapper, 'cavo', [
      { id: 42, nome: 'Cavo USB-C', prezzo_vendita: 12.5 },
    ])

    // Click the result row.
    const result = wrapper.find('.list-group .list-group-item-action')
    expect(result.exists()).toBe(true)
    await result.trigger('click')

    const emitted = lastEmittedMateriali(wrapper)
    expect(emitted).toHaveLength(1)
    expect(emitted[0]).toMatchObject({
      pezzo_id: 42,
      nome: 'Cavo USB-C',
      quantita: 1,
      fuori_catalogo: false,
      prezzo_unitario: 12.5,
    })
    vi.useRealTimers()
  })

  it("usa 0 come prezzo_unitario se il prodotto a catalogo non ha prezzo_vendita", async () => {
    vi.useFakeTimers()
    const wrapper = mount(MaterialeSelector, { props: { materiali: [] } })

    await triggerSearch(wrapper, 'pezzo', [{ id: 7, nome: 'Senza prezzo' }])
    await wrapper.find('.list-group .list-group-item-action').trigger('click')

    const emitted = lastEmittedMateriali(wrapper)
    expect(emitted[0].prezzo_unitario).toBe(0)
    vi.useRealTimers()
  })

  it('modificando il prezzo_unitario aggiorna il payload emesso', async () => {
    const initial = [
      { pezzo_id: 1, nome: 'Vite M6', quantita: 2, fuori_catalogo: false, prezzo_unitario: 1.0 },
    ]
    const wrapper = mount(MaterialeSelector, { props: { materiali: initial } })

    const input = wrapper.find('[data-testid="prezzo-input-0"]')
    expect(input.exists()).toBe(true)

    await input.setValue('3.75')

    const emitted = lastEmittedMateriali(wrapper)
    expect(emitted[0]).toMatchObject({
      pezzo_id: 1,
      quantita: 2,
      prezzo_unitario: 3.75,
    })
  })

  it("clamps a 0 i valori negativi del prezzo_unitario", async () => {
    const initial = [
      { pezzo_id: 1, nome: 'Vite', quantita: 1, fuori_catalogo: false, prezzo_unitario: 1 },
    ]
    const wrapper = mount(MaterialeSelector, { props: { materiali: initial } })

    await wrapper.find('[data-testid="prezzo-input-0"]').setValue('-5')
    const emitted = lastEmittedMateriali(wrapper)
    expect(emitted[0].prezzo_unitario).toBe(0)
  })

  it('aggiungendo un fuori catalogo senza prezzo emette prezzo_unitario = 0', async () => {
    const wrapper = mount(MaterialeSelector, { props: { materiali: [] } })

    await wrapper.find('button[title="Inserisci manualmente"]').trigger('click')
    await wrapper.find('[data-testid="manual-nome-input"]').setValue('Consumabile vario')
    await wrapper.find('[data-testid="manual-quantita-input"]').setValue(3)

    await wrapper.find('[data-testid="manual-add-btn"]').trigger('click')

    const emitted = lastEmittedMateriali(wrapper)
    expect(emitted).toHaveLength(1)
    expect(emitted[0]).toMatchObject({
      nome_manuale: 'Consumabile vario',
      quantita: 3,
      fuori_catalogo: true,
      prezzo_unitario: 0,
    })
  })

  it('aggiungendo un fuori catalogo con prezzo lo include nel payload', async () => {
    const wrapper = mount(MaterialeSelector, { props: { materiali: [] } })

    await wrapper.find('button[title="Inserisci manualmente"]').trigger('click')
    await wrapper.find('[data-testid="manual-nome-input"]').setValue('Guarnizione speciale')
    await wrapper.find('[data-testid="manual-quantita-input"]').setValue(2)
    await wrapper.find('[data-testid="manual-prezzo-input"]').setValue('4.5')

    await wrapper.find('[data-testid="manual-add-btn"]').trigger('click')

    const emitted = lastEmittedMateriali(wrapper)
    expect(emitted[0]).toMatchObject({
      nome_manuale: 'Guarnizione speciale',
      quantita: 2,
      fuori_catalogo: true,
      prezzo_unitario: 4.5,
    })
  })
})

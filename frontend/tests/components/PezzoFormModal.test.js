import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import PezzoFormModal from '../../src/components/PezzoFormModal.vue'

// Stub out html5-qrcode (used internally by BarcodeScannerModal). We don't
// need any camera behaviour for these tests; we just emit the `scanned`
// event from the child component directly.
vi.mock('html5-qrcode', () => ({
  Html5Qrcode: class {
    constructor() {}
    start() { return Promise.resolve() }
    stop() { return Promise.resolve() }
    clear() {}
    getState() { return 1 }
  },
}))

// Stub catalogo service used by PezzoFormModal.
vi.mock('../../src/services/catalogo', () => ({
  createProdotto: vi.fn(),
  updateProdotto: vi.fn(),
}))

describe('PezzoFormModal - barcode scanning (US7)', () => {
  it('mostra il pulsante di scansione barcode con icona bi-upc-scan', async () => {
    const wrapper = mount(PezzoFormModal, {
      props: { show: true, pezzo: null, categorie: [] },
    })

    const scanBtn = wrapper.find('[data-testid="barcode-scan-btn"]')
    expect(scanBtn.exists()).toBe(true)
    expect(scanBtn.find('i.bi-upc-scan').exists()).toBe(true)
  })

  it('apre lo scanner al click del pulsante e aggiorna form.barcode con il valore scannerizzato', async () => {
    const wrapper = mount(PezzoFormModal, {
      props: { show: true, pezzo: null, categorie: [] },
    })

    // Initially the scanner modal child is not visible (show=false)
    const scanner = wrapper.findComponent({ name: 'BarcodeScannerModal' })
    expect(scanner.exists()).toBe(true)
    expect(scanner.props('show')).toBe(false)

    // Click the scan button
    await wrapper.find('[data-testid="barcode-scan-btn"]').trigger('click')
    expect(scanner.props('show')).toBe(true)

    // Simulate the scanner emitting the scanned event with a barcode value
    scanner.vm.$emit('scanned', '8001234567890')
    await wrapper.vm.$nextTick()

    // The barcode input must now contain the scanned value
    const input = wrapper.find('[data-testid="barcode-input"]')
    expect(input.element.value).toBe('8001234567890')

    // Scanner should be closed after the scan
    expect(scanner.props('show')).toBe(false)
  })

  it('sovrascrive silenziosamente un barcode già valorizzato (no conferma bloccante)', async () => {
    const wrapper = mount(PezzoFormModal, {
      props: {
        show: false,
        pezzo: { id: 7, barcode: '1111111111111', nome: 'Esistente', prezzo_vendita: 10 },
        categorie: [],
      },
    })
    // Trigger the show watcher so the form is populated from the pezzo prop
    await wrapper.setProps({ show: true })
    await wrapper.vm.$nextTick()

    // The form should be pre-populated with the existing barcode
    const input = wrapper.find('[data-testid="barcode-input"]')
    expect(input.element.value).toBe('1111111111111')

    // Open scanner and simulate a new scan
    await wrapper.find('[data-testid="barcode-scan-btn"]').trigger('click')
    const scanner = wrapper.findComponent({ name: 'BarcodeScannerModal' })
    scanner.vm.$emit('scanned', '9999999999999')
    await wrapper.vm.$nextTick()

    // The old value must be silently overwritten with the new one
    expect(input.element.value).toBe('9999999999999')
    // No confirm/alert dialog should be triggered — we just check that the
    // scanner closes and the value is updated without user intervention.
    expect(scanner.props('show')).toBe(false)
  })
})

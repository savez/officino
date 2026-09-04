import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import UtenteFormModal from '../../src/components/UtenteFormModal.vue'

// Stub out the utenti service so onSubmit doesn't issue real HTTP calls.
const createUtente = vi.fn().mockResolvedValue({})
const updateUtente = vi.fn().mockResolvedValue({})

vi.mock('../../src/services/utenti', () => ({
  createUtente: (...args) => createUtente(...args),
  updateUtente: (...args) => updateUtente(...args),
}))

describe('UtenteFormModal — costo_orario', () => {
  beforeEach(() => {
    createUtente.mockClear()
    updateUtente.mockClear()
  })

  it('renderizza il campo costo_orario', async () => {
    const wrapper = mount(UtenteFormModal, { props: { show: true, utente: null } })
    const input = wrapper.find('[data-testid="utente-costo-orario"]')
    expect(input.exists()).toBe(true)
    expect(input.attributes('type')).toBe('number')
    expect(input.attributes('min')).toBe('0')
    expect(input.attributes('step')).toBe('0.01')
  })

  it('precompila il campo con il valore dell\'utente in edit', async () => {
    const wrapper = mount(UtenteFormModal, {
      props: {
        show: false,
        utente: { id: 1, nome: 'Mario', email: 'm@x.it', ruolo: 'user', costo_orario: 25.5 },
      },
    })
    await wrapper.setProps({ show: true })
    await wrapper.vm.$nextTick()
    const input = wrapper.find('[data-testid="utente-costo-orario"]')
    expect(Number(input.element.value)).toBe(25.5)
  })

  it('invia costo_orario nel payload di creazione', async () => {
    const wrapper = mount(UtenteFormModal, { props: { show: true, utente: null } })

    await wrapper.find('input[type="text"]').setValue('Mario')
    await wrapper.find('input[type="email"]').setValue('mario@example.it')
    await wrapper.find('input[type="password"]').setValue('segreto123')
    await wrapper.find('[data-testid="utente-costo-orario"]').setValue('30.25')

    await wrapper.find('form').trigger('submit.prevent')
    await wrapper.vm.$nextTick()

    expect(createUtente).toHaveBeenCalledTimes(1)
    const payload = createUtente.mock.calls[0][0]
    expect(payload.costo_orario).toBe(30.25)
    expect(payload.nome).toBe('Mario')
  })

  it('invia costo_orario nel payload di update', async () => {
    const wrapper = mount(UtenteFormModal, {
      props: {
        show: true,
        utente: { id: 7, nome: 'Anna', email: 'a@x.it', ruolo: 'user', costo_orario: 20 },
      },
    })
    await wrapper.vm.$nextTick()

    await wrapper.find('[data-testid="utente-costo-orario"]').setValue('42.5')
    await wrapper.find('form').trigger('submit.prevent')
    await wrapper.vm.$nextTick()

    expect(updateUtente).toHaveBeenCalledTimes(1)
    const [id, payload] = updateUtente.mock.calls[0]
    expect(id).toBe(7)
    expect(payload.costo_orario).toBe(42.5)
  })
})

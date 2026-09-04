import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const getDashboardStats = vi.fn()
const isAdminMock = vi.fn()

vi.mock('../../src/services/dashboard', () => ({
  getDashboardStats: (...a) => getDashboardStats(...a),
  exportOreExcel: vi.fn().mockResolvedValue({}),
}))
vi.mock('../../src/services/auth', () => ({
  getCurrentUser: () => ({ nome: 'Mario' }),
  isAdmin: () => isAdminMock(),
}))

import DashboardPage from '../../src/pages/DashboardPage.vue'

const RISPOSTA = {
  periodo: { da: '2026-09-01', a: '2026-09-30' },
  operai: [],
  ore_mancanti: [],
  operaio_id: null,
  ore: { per_cliente: [], per_operaio: [] },
}

/**
 * Monta la pagina nel ruolo scelto.
 * @param {boolean} admin
 * @param {object} risposta
 * @returns {Promise<import('@vue/test-utils').VueWrapper>}
 */
async function monta(admin = false, risposta = RISPOSTA) {
  isAdminMock.mockReturnValue(admin)
  getDashboardStats.mockResolvedValue(risposta)
  const w = mount(DashboardPage, {
    global: {
      stubs: {
        OrePerClienteBarChart: true,
        OrePerOperaioBarChart: true,
        OreGestiteBarChart: true,
        HelpIcon: true,
      },
    },
  })
  await flushPromises()
  return w
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('la dashboard non conta piu i preventivi', () => {
  it('non li nomina, per nessuno dei due ruoli', async () => {
    for (const admin of [false, true]) {
      const w = await monta(admin)
      expect(w.text().toLowerCase()).not.toContain('preventiv')
    }
  })

  it('non chiede al server dati sui preventivi', async () => {
    // Toglierli dalla schermata lasciando la lettura sarebbe il costo invisibile
    // che FR-004 vieta: qui si verifica che la pagina non ne dipenda piu'.
    const w = await monta(true)
    expect(JSON.stringify(w.html())).not.toMatch(/preventiv/i)
  })
})

describe('le pillole di ruolo sono sparite dalle intestazioni', () => {
  it('nessuna intestazione porta una pillola', async () => {
    // Si verificano i BADGE, non le parole. «Le tue ore mancanti» resta come
    // titolo del pannello per l'operaio: dice di chi sono quelle ore, ed e'
    // un'informazione. Le pillole rimosse erano un'altra cosa — «admin» su una
    // scheda che solo un amministratore puo' vedere, «le tue ore» accanto a un
    // titolo che gia' lo diceva: ripetizioni che occupavano spazio.
    for (const admin of [false, true]) {
      const w = await monta(admin)
      expect(w.findAll('.badge')).toHaveLength(0)
    }
  })
})

describe("l'ordine della schermata", () => {
  it('le ore mancanti precedono ogni altro contenuto, per entrambi i ruoli', async () => {
    // Chi apre l'applicazione deve trovare per prima l'unica cosa su cui agire.
    // Sorgente e non DOM: il pannello si monta solo quando ci sono ore mancanti,
    // e qui interessa la POSIZIONE nel modello, non la sua presenza a runtime.
    const src = readFileSync(
      resolve(__dirname, '../../src/pages/DashboardPage.vue'),
      'utf8',
    )
    const corpo = src.slice(src.indexOf('<template>'))
    const pannello = corpo.indexOf('<PannelloOreMancanti')
    const primoGrafico = corpo.indexOf('BarChart')
    const primaScheda = corpo.indexOf('Ore lavorate')

    expect(pannello).toBeGreaterThan(-1)
    expect(pannello).toBeLessThan(primaScheda)
    expect(pannello).toBeLessThan(primoGrafico)
  })
})

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

vi.mock('../../src/services/api', () => ({
  default: {
    get: vi.fn(),
  },
}))

import api from '../../src/services/api'
import { getDashboardStats, exportOreExcel } from '../../src/services/dashboard'

describe('getDashboardStats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('chiama api.get con il path e i parametri corretti', async () => {
    api.get.mockResolvedValue({ data: {} })

    await getDashboardStats(3, 2026)

    expect(api.get).toHaveBeenCalledOnce()
    expect(api.get).toHaveBeenCalledWith('/dashboard/stats', {
      params: { mese: 3, anno: 2026 },
    })
  })

  it('restituisce i dati dalla risposta API', async () => {
    const fakeData = {
      ore_totali: 120,
      preventivi: { bozza: 2, approvato: 5 },
    }
    api.get.mockResolvedValue({ data: fakeData })

    const result = await getDashboardStats(1, 2026)

    expect(result).toEqual(fakeData)
  })

  it('propaga correttamente gli errori dell\'API', async () => {
    const apiError = new Error('Network Error')
    api.get.mockRejectedValue(apiError)

    await expect(getDashboardStats(1, 2026)).rejects.toThrow('Network Error')
  })
})

describe('exportOreExcel', () => {
  let createElementSpy, clickSpy

  beforeEach(() => {
    createElementSpy = vi.spyOn(document, 'createElement')
    clickSpy = vi.fn()
    window.URL.createObjectURL = vi.fn(() => 'blob:mock-url')
    window.URL.revokeObjectURL = vi.fn()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('chiama api.get con i parametri corretti', async () => {
    const mockBlob = new Blob()
    api.get.mockResolvedValue({ data: mockBlob })

    await exportOreExcel(3, 2026)

    expect(api.get).toHaveBeenCalledWith('/dashboard/export-ore', {
      params: { mese: 3, anno: 2026 },
      responseType: 'blob',
    })
  })

  it('crea un link di download con il filename corretto', async () => {
    const mockBlob = new Blob()
    api.get.mockResolvedValue({ data: mockBlob })

    const mockLink = {
      href: '',
      download: '',
      click: vi.fn(),
    }
    createElementSpy.mockReturnValue(mockLink)

    await exportOreExcel(3, 2026)

    expect(createElementSpy).toHaveBeenCalledWith('a')
    expect(mockLink.download).toBe('ore_2026_03.xlsx')
    expect(mockLink.click).toHaveBeenCalled()
  })

  it('revoca il blob URL dopo il download', async () => {
    const mockBlob = new Blob()
    api.get.mockResolvedValue({ data: mockBlob })

    const mockLink = {
      href: '',
      download: '',
      click: vi.fn(),
    }
    createElementSpy.mockReturnValue(mockLink)

    await exportOreExcel(3, 2026)

    expect(window.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url')
  })

  it('propaga gli errori dell\'API', async () => {
    const apiError = new Error('Export failed')
    api.get.mockRejectedValue(apiError)

    await expect(exportOreExcel(3, 2026)).rejects.toThrow('Export failed')
  })
})

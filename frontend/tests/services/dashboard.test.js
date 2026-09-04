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

    await getDashboardStats({ da: '2026-03-01', a: '2026-03-31' })

    expect(api.get).toHaveBeenCalledOnce()
    expect(api.get).toHaveBeenCalledWith('/dashboard/stats', {
      params: { da: '2026-03-01', a: '2026-03-31' },
    })
  })

  it('restituisce i dati dalla risposta API', async () => {
    const fakeData = {
      ore_totali: 120,
      preventivi: { bozza: 2, approvato: 5 },
    }
    api.get.mockResolvedValue({ data: fakeData })

    const result = await getDashboardStats({ da: '2026-01-01', a: '2026-01-31' })

    expect(result).toEqual(fakeData)
  })

  it('propaga correttamente gli errori dell\'API', async () => {
    const apiError = new Error('Network Error')
    api.get.mockRejectedValue(apiError)

    await expect(getDashboardStats({ da: '2026-01-01', a: '2026-01-31' })).rejects.toThrow(
      'Network Error'
    )
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

    await exportOreExcel({ da: '2026-03-01', a: '2026-03-31' })

    expect(api.get).toHaveBeenCalledWith('/dashboard/export-ore', {
      params: { da: '2026-03-01', a: '2026-03-31' },
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

    // Il nome del file arriva dal server, che conosce le date risolte anche
    // quando il client ha chiesto una scorciatoia.
    api.get.mockResolvedValue({
      data: mockBlob,
      headers: { 'content-disposition': 'attachment; filename="ore_2026-03-01_2026-03-31.xlsx"' },
    })

    await exportOreExcel({ da: '2026-03-01', a: '2026-03-31' })

    expect(createElementSpy).toHaveBeenCalledWith('a')
    expect(mockLink.download).toBe('ore_2026-03-01_2026-03-31.xlsx')
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

    await exportOreExcel({ da: '2026-03-01', a: '2026-03-31' })

    expect(window.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url')
  })

  it('propaga gli errori dell\'API', async () => {
    const apiError = new Error('Export failed')
    api.get.mockRejectedValue(apiError)

    await expect(exportOreExcel({ da: '2026-03-01', a: '2026-03-31' })).rejects.toThrow(
      'Export failed'
    )
  })
})

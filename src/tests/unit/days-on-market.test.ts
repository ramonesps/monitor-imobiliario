// Testes unitários de cálculo de dias no mercado
// Cobertura: U06

import { describe, it, expect } from 'vitest'
import { calculateDaysOnMarket } from '@/lib/scraper/dedup'

describe('U06: calculateDaysOnMarket — deactivated_at - first_seen_at', () => {
  it('deve calcular 0 dias quando datas são iguais', () => {
    const date = '2024-01-15T00:00:00.000Z'
    expect(calculateDaysOnMarket(date, date)).toBe(0)
  })

  it('deve calcular 1 dia de diferença', () => {
    expect(
      calculateDaysOnMarket('2024-01-15T00:00:00.000Z', '2024-01-16T00:00:00.000Z')
    ).toBe(1)
  })

  it('deve calcular 30 dias de diferença', () => {
    expect(
      calculateDaysOnMarket('2024-01-01T00:00:00.000Z', '2024-01-31T00:00:00.000Z')
    ).toBe(30)
  })

  it('deve calcular 90 dias (trimestre)', () => {
    expect(
      calculateDaysOnMarket('2024-01-01T00:00:00.000Z', '2024-04-01T00:00:00.000Z')
    ).toBe(91) // Jan(31) + Feb(29 em 2024 - bissexto) + Mar(31) = 91
  })

  it('deve retornar 0 para datas inversas (proteção contra bug)', () => {
    // deactivated_at antes de first_seen_at → 0 (não negativo)
    expect(
      calculateDaysOnMarket('2024-01-31T00:00:00.000Z', '2024-01-01T00:00:00.000Z')
    ).toBe(0)
  })

  it('deve calcular dias com datas em formato ISO com timezone', () => {
    expect(
      calculateDaysOnMarket('2024-01-15T10:00:00-03:00', '2024-01-22T10:00:00-03:00')
    ).toBe(7)
  })
})

// Testes unitários de transição de status de listings
// Cobertura: U10

import { describe, it, expect } from 'vitest'
import { shouldDeactivate } from '@/lib/scraper/dedup'

describe('U10: shouldDeactivate — transição active → inactive após 2 dias ausente', () => {
  const today = '2024-01-17T10:00:00.000Z'

  it('deve desativar listing ausente há exatamente 2 dias', () => {
    const lastSeenAt = '2024-01-15T10:00:00.000Z' // 2 dias antes
    expect(shouldDeactivate(lastSeenAt, today)).toBe(true)
  })

  it('deve desativar listing ausente há mais de 2 dias', () => {
    const lastSeenAt = '2024-01-10T10:00:00.000Z' // 7 dias antes
    expect(shouldDeactivate(lastSeenAt, today)).toBe(true)
  })

  it('não deve desativar listing visto hoje', () => {
    expect(shouldDeactivate(today, today)).toBe(false)
  })

  it('não deve desativar listing visto ontem (1 dia)', () => {
    const lastSeenAt = '2024-01-16T10:00:00.000Z' // 1 dia antes
    expect(shouldDeactivate(lastSeenAt, today)).toBe(false)
  })

  it('não deve desativar listing visto há 1.9 dias', () => {
    // 1 dia e 21.6 horas = 1.9 dias < 2
    const lastSeenAt = '2024-01-15T12:24:00.000Z'
    expect(shouldDeactivate(lastSeenAt, today)).toBe(false)
  })

  it('deve desativar listing visto há 2.5 dias', () => {
    const lastSeenAt = '2024-01-15T00:00:00.000Z' // 2.41 dias antes
    expect(shouldDeactivate(lastSeenAt, today)).toBe(true)
  })
})

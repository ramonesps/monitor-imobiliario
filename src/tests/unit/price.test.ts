// Testes unitários de detecção de mudança de preço
// Cobertura: U05

import { describe, it, expect } from 'vitest'
import { hasPriceChanged } from '@/lib/scraper/dedup'

describe('U05: hasPriceChanged — detecção de mudança de preço', () => {
  it('deve detectar mudança quando preço aumentou', () => {
    expect(hasPriceChanged(3500, 3800)).toBe(true)
  })

  it('deve detectar mudança quando preço diminuiu', () => {
    expect(hasPriceChanged(3800, 3500)).toBe(true)
  })

  it('não deve detectar mudança para preços idênticos', () => {
    expect(hasPriceChanged(3500, 3500)).toBe(false)
  })

  it('não deve detectar mudança para diferença mínima (< R$1)', () => {
    expect(hasPriceChanged(3500.0, 3500.5)).toBe(false)
  })

  it('deve detectar mudança para diferença de exatamente R$1', () => {
    expect(hasPriceChanged(3500, 3501)).toBe(true)
  })

  it('deve detectar mudança em preços de venda (valores altos)', () => {
    expect(hasPriceChanged(450000, 480000)).toBe(true)
    expect(hasPriceChanged(450000, 450000)).toBe(false)
  })

  it('deve tratar preço zerado', () => {
    expect(hasPriceChanged(0, 100)).toBe(true)
    expect(hasPriceChanged(0, 0)).toBe(false)
  })
})

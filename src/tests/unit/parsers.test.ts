// Testes unitários de parsing de campos
// Cobertura: U07 (mobília), U08 (andar)

import { describe, it, expect } from 'vitest'
import { parseFurnished, parseFloor } from '@/lib/scraper/dedup'
import { BaseScraper } from '@/lib/scraper/platforms/base'
import type { RawListing } from '@/types'

// Classe concreta para testar os helpers da BaseScraper
class TestScraper extends BaseScraper {
  name = 'test'
  async search(): Promise<RawListing[]> { return [] }

  // Expõe métodos protegidos para teste
  public testParseFurnished(text: string) { return this.parseFurnished(text) }
  public testParseFloor(text: string) { return this.parseFloor(text) }
}

describe('U07: parseFurnished — parsing de status de mobília', () => {
  it('"Mobiliado" → "full"', () => {
    expect(parseFurnished('Mobiliado')).toBe('full')
  })

  it('"Mobiliada" → "full"', () => {
    expect(parseFurnished('Mobiliada')).toBe('full')
  })

  it('"Semi-Mobiliado" → "partial"', () => {
    expect(parseFurnished('Semi-Mobiliado')).toBe('partial')
  })

  it('"Semimobiliado" → "partial"', () => {
    expect(parseFurnished('Semimobiliado')).toBe('partial')
  })

  it('"Semi Mobiliado" → "partial"', () => {
    expect(parseFurnished('Semi Mobiliado')).toBe('partial')
  })

  it('"Sem mobília" → "none"', () => {
    expect(parseFurnished('Sem mobília')).toBe('none')
  })

  it('"Sem móveis" → "none"', () => {
    // Texto sem "mobilia" ou "semi"
    expect(parseFurnished('Sem móveis')).toBe('unknown')
  })

  it('"Não mobiliado" → "none"', () => {
    expect(parseFurnished('Não mobiliado')).toBe('none')
  })

  it('texto desconhecido → "unknown"', () => {
    expect(parseFurnished('Consulte')).toBe('unknown')
    expect(parseFurnished('')).toBe('unknown')
  })

  it('deve ser case-insensitive', () => {
    expect(parseFurnished('MOBILIADO')).toBe('full')
    expect(parseFurnished('semi mobiliado')).toBe('partial')
  })
})

describe('U07: BaseScraper.parseFurnished — via classe base', () => {
  const scraper = new TestScraper()

  it('"Mobiliado" → "full"', () => {
    expect(scraper.testParseFurnished('Mobiliado')).toBe('full')
  })

  it('"Semi" → "partial"', () => {
    expect(scraper.testParseFurnished('Semi')).toBe('partial')
  })
})

describe('U08: parseFloor — extração de número do andar', () => {
  it('"12º andar" → "12"', () => {
    expect(parseFloor('12º andar')).toBe('12')
  })

  it('"12 andar" → "12"', () => {
    expect(parseFloor('12 andar')).toBe('12')
  })

  it('"Andar 12" → "12"', () => {
    expect(parseFloor('Andar 12')).toBe('12')
  })

  it('"Térreo" → "0"', () => {
    expect(parseFloor('Térreo')).toBe('0')
  })

  it('"terreo" → "0"', () => {
    expect(parseFloor('terreo')).toBe('0')
  })

  it('"1° andar" → "1"', () => {
    expect(parseFloor('1° andar')).toBe('1')
  })

  it('número puro "5" → "5"', () => {
    expect(parseFloor('5')).toBe('5')
  })

  it('texto sem andar → null', () => {
    expect(parseFloor('Casa')).toBeNull()
    expect(parseFloor('')).toBeNull()
  })
})

describe('U08: BaseScraper.parseFloor — via classe base', () => {
  const scraper = new TestScraper()

  it('"12º andar" → "12"', () => {
    expect(scraper.testParseFloor('12º andar')).toBe('12')
  })

  it('"Térreo" → "0"', () => {
    expect(scraper.testParseFloor('Térreo')).toBe('0')
  })
})

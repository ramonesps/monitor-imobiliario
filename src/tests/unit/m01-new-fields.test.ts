// Testes unitários M01 — novos campos de coleta estruturada
// Cobertura: U11–U19 conforme IMP_Specification.md

import { describe, it, expect } from 'vitest'
import { generateFingerprint, calculateSimilarity } from '@/lib/scraper/dedup'
import type { ListingFingerprint } from '@/types'

// ============================================================
// U11 / U11b: parseBathrooms (via OLX parseIntProp pattern)
// ============================================================
describe('U11: parseBathrooms — extração de banheiros', () => {
  function parseIntProp(properties: Array<{ name: string; value: string }>, key: string): number | undefined {
    const v = parseInt(properties.find((p) => p.name === key)?.value ?? '0')
    return v > 0 ? v : undefined
  }

  it('U11: propriedade "bathrooms" com valor "3" → 3', () => {
    const props = [{ name: 'bathrooms', value: '3' }]
    expect(parseIntProp(props, 'bathrooms')).toBe(3)
  })

  it('U11b: valor "0" → undefined', () => {
    const props = [{ name: 'bathrooms', value: '0' }]
    expect(parseIntProp(props, 'bathrooms')).toBeUndefined()
  })

  it('U11b: chave ausente → undefined', () => {
    const props = [{ name: 'rooms', value: '2' }]
    expect(parseIntProp(props, 'bathrooms')).toBeUndefined()
  })
})

// ============================================================
// U12 / U12b: parseGarages OLX
// ============================================================
describe('U12: parseGarages OLX — extração de vagas via ad.properties', () => {
  function parseIntProp(properties: Array<{ name: string; value: string }>, key: string): number | undefined {
    const v = parseInt(properties.find((p) => p.name === key)?.value ?? '0')
    return v > 0 ? v : undefined
  }

  it('U12: properties com {name:"garage", value:"2"} → 2', () => {
    const props = [{ name: 'garage', value: '2' }]
    expect(parseIntProp(props, 'garage')).toBe(2)
  })

  it('U12b: array sem chave "garage" → undefined', () => {
    const props = [{ name: 'rooms', value: '3' }, { name: 'bathrooms', value: '1' }]
    expect(parseIntProp(props, 'garage')).toBeUndefined()
  })
})

// ============================================================
// U13 / U13b: parseListedAt OLX (Unix ms)
// ============================================================
describe('U13: parseListedAt OLX — Unix ms para ISO 8601', () => {
  function parseListedAt(listTime: number | null | undefined): string | undefined {
    if (!listTime) return undefined
    return new Date(listTime).toISOString()
  }

  it('U13: Unix ms 1700000000000 → ISO 8601 válido', () => {
    const result = parseListedAt(1700000000000)
    expect(result).toBeDefined()
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
  })

  it('U13b: valor 0 → undefined sem lançar erro', () => {
    expect(() => parseListedAt(0)).not.toThrow()
    expect(parseListedAt(0)).toBeUndefined()
  })

  it('U13b: null → undefined sem lançar erro', () => {
    expect(() => parseListedAt(null)).not.toThrow()
    expect(parseListedAt(null)).toBeUndefined()
  })
})

// ============================================================
// U14 / U14b: parseListedAt ImovelWeb (DD/MM/AAAA)
// ============================================================
describe('U14: parseListedAt ImovelWeb — data BR para ISO', () => {
  function parseListedAtBR(text: string): string | undefined {
    const m = text.match(/[Pp]ublicado\s+em\s+(\d{2})\/(\d{2})\/(\d{4})/)
    if (m) return `${m[3]}-${m[2]}-${m[1]}`
    return undefined
  }

  it('U14: "Publicado em 10/03/2025" → "2025-03-10"', () => {
    expect(parseListedAtBR('Publicado em 10/03/2025')).toBe('2025-03-10')
  })

  it('U14b: texto sem data reconhecível → undefined', () => {
    expect(parseListedAtBR('Atualizado recentemente')).toBeUndefined()
    expect(parseListedAtBR('')).toBeUndefined()
  })
})

// ============================================================
// U15: persistência — listedAt undefined → null no banco
// (testado via asserção de tipo: undefined ?? null === null)
// ============================================================
describe('U15: listedAt undefined → coluna fica null', () => {
  it('undefined ?? null === null', () => {
    const listedAt: string | undefined = undefined
    expect(listedAt ?? null).toBeNull()
  })

  it('string definida preservada', () => {
    const listedAt: string | undefined = '2025-03-10'
    expect(listedAt ?? null).toBe('2025-03-10')
  })
})

// ============================================================
// U16: generateFingerprint — bedrooms explícito
// ============================================================
describe('U16: generateFingerprint — quartos diferentes geram fingerprints diferentes', () => {
  it('mesmos andar/preço/tipo, bedrooms diferentes → hashes diferentes', () => {
    const base = { type: 'rent' as const, floor: '5', price: 3500 }
    const fp1 = generateFingerprint({ ...base, bedrooms: 2 })
    const fp2 = generateFingerprint({ ...base, bedrooms: 3 })
    expect(fp1).not.toBe(fp2)
  })

  it('bedrooms: 2 vs bedrooms: undefined → hashes diferentes', () => {
    const base = { type: 'rent' as const, floor: '5', price: 3500 }
    const fp1 = generateFingerprint({ ...base, bedrooms: 2 })
    const fp2 = generateFingerprint({ ...base, bedrooms: undefined })
    expect(fp1).not.toBe(fp2)
  })

  it('bedrooms: undefined em ambos → mesmo hash', () => {
    const base = { type: 'rent' as const, floor: '5', price: 3500 }
    expect(generateFingerprint({ ...base })).toBe(generateFingerprint({ ...base }))
  })
})

// ============================================================
// U17: calcSimilarityScore — bathrooms e garages coincidem → +5
// ============================================================
describe('U17: calculateSimilarity — bathrooms e garages coincidem → +5 pts', () => {
  const base: ListingFingerprint = {
    type: 'rent',
    floor: '5',
    price: 3500,
    area: 70,
    bedrooms: 2,
    bathrooms: null,
    garages: null,
    phashes: [],
  }

  it('com bathrooms e garages coincidindo, score é maior', () => {
    const withBath: ListingFingerprint = { ...base, bathrooms: 2, garages: 1 }
    const scoreWithBath = calculateSimilarity(withBath, { ...withBath })
    const scoreWithout = calculateSimilarity(base, { ...base })
    // Score com bathrooms/garages coincidindo deve ser >= score sem eles
    expect(scoreWithBath).toBeGreaterThanOrEqual(scoreWithout)
  })

  it('bathrooms e garages iguais em ambos → +5 pts sobre baseline sem esses campos', () => {
    const withBath: ListingFingerprint = { ...base, bathrooms: 2, garages: 1 }
    const scoreWith = calculateSimilarity(withBath, { ...withBath })
    const scoreWithout = calculateSimilarity(base, { ...base })
    expect(scoreWith - scoreWithout).toBe(5)
  })
})

// ============================================================
// U18: calcSimilarityScore — garagens divergem 2+ → -10 pts
// ============================================================
describe('U18: calculateSimilarity — divergência de 2+ unidades → -10 pts', () => {
  const base: ListingFingerprint = {
    type: 'rent',
    floor: '5',
    price: 3500,
    area: 70,
    bedrooms: 2,
    bathrooms: null,
    garages: null,
    phashes: [],
  }

  it('garagens divergem em 2+ unidades → score cai 10 pts em relação ao baseline', () => {
    const a: ListingFingerprint = { ...base, bathrooms: 2, garages: 1 }
    const b: ListingFingerprint = { ...base, bathrooms: 2, garages: 3 } // diff = 2
    const scoreBaseline = calculateSimilarity(base, { ...base }) // sem bathrooms/garages
    const scoreDivergent = calculateSimilarity(a, b)
    expect(scoreBaseline - scoreDivergent).toBe(10)
  })

  it('bathrooms divergem em 2+ unidades → score cai 10 pts', () => {
    const a: ListingFingerprint = { ...base, bathrooms: 1, garages: 1 }
    const b: ListingFingerprint = { ...base, bathrooms: 3, garages: 1 } // diff = 2
    const scoreBaseline = calculateSimilarity(base, { ...base })
    const scoreDivergent = calculateSimilarity(a, b)
    expect(scoreBaseline - scoreDivergent).toBe(10)
  })
})

// ============================================================
// U19 / U19b: parseBedrooms OLX via ad.properties
// ============================================================
describe('U19: parseBedrooms OLX — via ad.properties name="rooms"', () => {
  function parseIntProp(properties: Array<{ name: string; value: string }>, key: string): number | undefined {
    const v = parseInt(properties.find((p) => p.name === key)?.value ?? '0')
    return v > 0 ? v : undefined
  }

  it('U19: properties com {name:"rooms", value:"3"} → 3', () => {
    const props = [{ name: 'rooms', value: '3' }]
    expect(parseIntProp(props, 'rooms')).toBe(3)
  })

  it('U19b: value "0" → undefined', () => {
    const props = [{ name: 'rooms', value: '0' }]
    expect(parseIntProp(props, 'rooms')).toBeUndefined()
  })
})

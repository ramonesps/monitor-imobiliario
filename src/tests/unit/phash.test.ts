// Testes unitários de perceptual hashing
// Cobertura: U01, U02, U03

import { describe, it, expect, vi, beforeEach } from 'vitest'
import sharp from 'sharp'

// Mock do Sharp para evitar dependência de imagens reais nos testes unitários
vi.mock('sharp', () => {
  const mockInstance = {
    resize: vi.fn().mockReturnThis(),
    greyscale: vi.fn().mockReturnThis(),
    raw: vi.fn().mockReturnThis(),
    toBuffer: vi.fn(),
  }
  const mockSharp = vi.fn(() => mockInstance)
  return { default: mockSharp }
})

import { generatePhash, hammingDistance, isSameProperty } from '@/lib/scraper/phash'

// Cria buffer de pixels 8x8 com valor uniforme (imagem sólida)
function createUniformPixelBuffer(value: number): Buffer {
  return Buffer.from(Array(64).fill(value))
}

// Cria buffer com padrão xadrez (alternando 0 e 255)
function createCheckerboardBuffer(): Buffer {
  return Buffer.from(Array(64).fill(0).map((_, i) => (i % 2 === 0 ? 0 : 255)))
}

describe('U01: generatePhash — hash de imagem conhecida', () => {
  beforeEach(() => {
    const mockInstance = (sharp as any)()
    mockInstance.toBuffer.mockResolvedValue({
      data: createUniformPixelBuffer(128),
      info: { width: 8, height: 8, channels: 1 },
    })
  })

  it('deve retornar uma string hexadecimal de 16 caracteres', async () => {
    const hash = await generatePhash(Buffer.from([]))
    expect(hash).toMatch(/^[0-9a-f]{16}$/)
  })

  it('deve retornar hash determinístico para a mesma imagem', async () => {
    const hash1 = await generatePhash(Buffer.from([]))
    const hash2 = await generatePhash(Buffer.from([]))
    expect(hash1).toBe(hash2)
  })

  it('deve retornar hash consistente para pixels uniformes', async () => {
    const mockInstance = (sharp as any)()
    mockInstance.toBuffer.mockResolvedValue({
      data: createUniformPixelBuffer(200),
      info: { width: 8, height: 8, channels: 1 },
    })
    const hash = await generatePhash(Buffer.from([]))
    // Pixels acima da média: todos bits = 1 → hash de 1s
    expect(hash).toHaveLength(16)
    expect(hash).toMatch(/^[0-9a-f]+$/)
  })
})

describe('U02: hammingDistance — mesmo imóvel → distance < 10', () => {
  it('deve retornar distância 0 para hashes idênticos', () => {
    const hash = 'abcdef1234567890'
    expect(hammingDistance(hash, hash)).toBe(0)
  })

  it('deve retornar distância pequena para hashes muito similares', () => {
    // Diferença de 1 nibble: 'a' (1010) vs 'b' (1011) = 1 bit diferente
    const hash1 = 'abcdef1234567890'
    const hash2 = 'bbcdef1234567890'
    const dist = hammingDistance(hash1, hash2)
    expect(dist).toBeLessThan(10)
  })

  it('isSameProperty retorna true para distância < 10', () => {
    const hash = 'abcdef1234567890'
    expect(isSameProperty(hash, hash)).toBe(true)
  })

  it('deve lançar erro para hashes com comprimentos diferentes', () => {
    expect(() => hammingDistance('abc', 'abcd')).toThrow('comprimentos diferentes')
  })
})

describe('U03: hammingDistance — imóveis distintos → distance > 30', () => {
  it('deve retornar distância alta para hashes completamente diferentes', () => {
    // '0' = 0000, 'f' = 1111 → 4 bits diferentes por nibble
    // 16 nibbles × 4 bits = 64 bits de distância máxima
    const hash1 = '0000000000000000'
    const hash2 = 'ffffffffffffffff'
    const dist = hammingDistance(hash1, hash2)
    expect(dist).toBe(64) // Distância máxima possível
    expect(dist).toBeGreaterThan(30)
  })

  it('isSameProperty retorna false para imagens muito diferentes', () => {
    const hash1 = '0000000000000000'
    const hash2 = 'ffffffffffffffff'
    expect(isSameProperty(hash1, hash2)).toBe(false)
  })

  it('deve calcular distância corretamente com valores parciais', () => {
    // 'f' = 1111, '0' = 0000 → 4 bits distintos por nibble
    const hash1 = 'f0f0f0f0f0f0f0f0'
    const hash2 = '0f0f0f0f0f0f0f0f'
    const dist = hammingDistance(hash1, hash2)
    // Cada par f/0 ou 0/f = 4 bits diferentes
    expect(dist).toBe(64)
    expect(dist).toBeGreaterThan(30)
  })
})

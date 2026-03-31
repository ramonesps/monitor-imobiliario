// Setup do Vitest para testes unitários e de integração

import { vi } from 'vitest'

// Mock do Sharp para testes que não precisam de processamento real de imagem
// Descomente quando necessário em testes específicos
// vi.mock('sharp')

// Mock do better-sqlite3 para testes de integração que usam :memory:
// Sobrescrito por testes individuais quando necessário

// Globals de conveniência para datas de teste
globalThis.TEST_DATE = '2024-01-15T10:00:00.000Z'
globalThis.TEST_DATE_2 = '2024-01-17T10:00:00.000Z' // 2 dias depois

// Silencia logs desnecessários nos testes
// Comente para depuração
if (process.env.TEST_VERBOSE !== 'true') {
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
}

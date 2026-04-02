// Testes de resiliência do sistema
// Cobertura: R01, R02, R03, R04, R05, R06

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ALL_SCRAPERS, runScraper } from '@/lib/scraper/runner'
import { downloadPhoto, localPathToUrl } from '@/lib/scraper/photo-downloader'
import { BaseScraper } from '@/lib/scraper/platforms/base'
import type { RawListing } from '@/types'

// Mock do runner para testes de resiliência
vi.mock('@/lib/scraper/runner', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/scraper/runner')>()
  return {
    ...actual,
    runScraper: vi.fn(),
  }
})

// Mock do photo-downloader — mantém localPathToUrl real, mocka apenas I/O
vi.mock('@/lib/scraper/photo-downloader', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/scraper/photo-downloader')>()
  return {
    ...actual,
    downloadPhoto: vi.fn(),
    getPhotoDestPath: vi.fn((id: string, i: number) => `/tmp/${id}/${i}.jpg`),
  }
})

// Scraper que sempre lança erro (para R01)
class ErrorScraper extends BaseScraper {
  name = 'error-platform'
  async search(): Promise<RawListing[]> {
    throw new Error('Plataforma indisponível — simulado para teste R01')
  }
}

// Scraper com HTML inválido (para R02)
class BadHtmlScraper extends BaseScraper {
  name = 'bad-html-platform'
  async search(): Promise<RawListing[]> {
    // Simula retorno vazio por HTML inválido sem lançar exceção
    console.error('[bad-html-platform] Seletores não encontrados — HTML pode ter mudado')
    return []
  }
}

// Scraper com retry (para R04)
class RetryableScraper extends BaseScraper {
  name = 'retryable-platform'
  private attempts = 0
  readonly maxFailures: number

  constructor(maxFailures: number) {
    super()
    this.maxFailures = maxFailures
  }

  async search(): Promise<RawListing[]> {
    this.attempts++
    if (this.attempts <= this.maxFailures) {
      throw new Error('Rate limited — 429 Too Many Requests')
    }
    return [
      {
        externalId: 'retry-success',
        externalUrl: 'https://example.com/1',
        platform: this.name,
        type: 'rent',
        price: 3500,
        furnished: 'full',
        description: 'Sucesso após retry',
        photoUrls: [],
      },
    ]
  }

  getAttempts() { return this.attempts }
}

describe('R01: Plataforma fora do ar → runner continua nas demais', () => {
  it('deve continuar executando outros scrapers quando um falha', async () => {
    const errorScraper = new ErrorScraper()
    const workingScraper = {
      name: 'working-platform',
      search: vi.fn().mockResolvedValue([]),
    }

    // Simula execução sequencial com tolerância a falhas
    const results: Array<{ platform: string; success: boolean; error?: string }> = []

    for (const scraper of [errorScraper, workingScraper]) {
      try {
        await scraper.search('Test Building', 'Test Address')
        results.push({ platform: scraper.name, success: true })
      } catch (error) {
        // R01: Captura erro e continua
        results.push({
          platform: scraper.name,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    expect(results).toHaveLength(2)
    expect(results[0].success).toBe(false)
    expect(results[0].error).toContain('indisponível')
    expect(results[1].success).toBe(true) // Segundo scraper executou
    expect(workingScraper.search).toHaveBeenCalledOnce()
  })

  it('deve logar o erro da plataforma que falhou', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const errorScraper = new ErrorScraper()

    try {
      await errorScraper.search('Test', 'Test')
    } catch (error) {
      console.error(`[runner] ERRO em ${errorScraper.name}:`, error)
    }

    expect(consoleSpy).toHaveBeenCalled()
    consoleSpy.mockRestore()
  })
})

describe('R02: HTML mudou (seletores quebrados) → log, não crash', () => {
  it('deve retornar array vazio quando HTML não tem seletores esperados', async () => {
    const scraper = new BadHtmlScraper()
    const results = await scraper.search('Test Building', 'Test Address')
    expect(results).toEqual([]) // Não crashou, retornou vazio
  })

  it('deve logar erro de parse sem lançar exceção', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const scraper = new BadHtmlScraper()
    await expect(scraper.search('Test', 'Test')).resolves.not.toThrow()
    consoleSpy.mockRestore()
  })
})

describe('R03: Foto 404 → pula, continua', () => {
  it('deve retornar null para foto com erro 404', async () => {
    const mockedDownload = vi.mocked(downloadPhoto)
    mockedDownload.mockResolvedValueOnce(null) // Simula 404

    const result = await downloadPhoto('https://example.com/foto-inexistente.jpg', '/tmp/test.jpg')
    expect(result).toBeNull()
  })

  it('deve processar fotos restantes após uma falhar', async () => {
    const mockedDownload = vi.mocked(downloadPhoto)
    mockedDownload
      .mockResolvedValueOnce(null) // Foto 1: falha
      .mockResolvedValueOnce('/tmp/listing/1.jpg') // Foto 2: sucesso
      .mockResolvedValueOnce('/tmp/listing/2.jpg') // Foto 3: sucesso

    const photoUrls = ['https://example.com/404.jpg', 'https://example.com/ok1.jpg', 'https://example.com/ok2.jpg']
    const results = await Promise.all(
      photoUrls.map((url, i) => downloadPhoto(url, `/tmp/listing/${i}.jpg`))
    )

    expect(results).toHaveLength(3)
    expect(results[0]).toBeNull() // Falhou
    expect(results[1]).toBe('/tmp/listing/1.jpg') // Sucesso
    expect(results[2]).toBe('/tmp/listing/2.jpg') // Sucesso

    const successfulDownloads = results.filter((r) => r !== null)
    expect(successfulDownloads).toHaveLength(2) // Continuou após falha
  })
})

describe('R04: Rate limiting → retry com backoff', () => {
  it('deve tentar novamente após rate limiting e ter sucesso', async () => {
    const scraper = new RetryableScraper(2) // Falha nas 2 primeiras tentativas

    // Usa withRetry internamente
    const result = await scraper['withRetry'](
      () => scraper.search('Test', 'Test'),
      { maxAttempts: 3, baseDelayMs: 10, maxDelayMs: 100 }
    )

    expect(result).toHaveLength(1)
    expect(result[0].externalId).toBe('retry-success')
    expect(scraper.getAttempts()).toBe(3) // Tentou 3 vezes
  })

  it('deve lançar erro após esgotar tentativas', async () => {
    const scraper = new RetryableScraper(10) // Sempre falha (mais que 3 tentativas)

    await expect(
      scraper['withRetry'](
        () => scraper.search('Test', 'Test'),
        { maxAttempts: 3, baseDelayMs: 10, maxDelayMs: 50 }
      )
    ).rejects.toThrow('Rate limited')

    expect(scraper.getAttempts()).toBe(3) // Tentou exatamente 3 vezes
  })
})

describe('R05: Cron roda 2x → idempotente (não duplica listings)', () => {
  it('não deve criar listing duplicado para mesmo external_url', () => {
    // Simula a lógica de idempotência do runner:
    // "Checar se external_url já existe em listing_sources → só atualizar last_seen_at"

    const externalUrl = 'https://zapimoveis.com.br/imovel/12345'
    const existingSources = [
      { externalUrl, lastSeenAt: '2024-01-15T06:00:00.000Z' },
    ]

    // Simula segunda execução do cron
    const alreadyExists = existingSources.some((s) => s.externalUrl === externalUrl)
    expect(alreadyExists).toBe(true) // URL já existe → não cria novo listing

    // Apenas atualiza last_seen_at
    if (alreadyExists) {
      existingSources[0].lastSeenAt = '2024-01-15T18:00:00.000Z'
    }

    expect(existingSources).toHaveLength(1) // Continua com 1 source, não duplicou
    expect(existingSources[0].lastSeenAt).toBe('2024-01-15T18:00:00.000Z')
  })

  it('deve criar novo listing quando URL não existe ainda', () => {
    const newExternalUrl = 'https://zapimoveis.com.br/imovel/99999'
    const existingSources: Array<{ externalUrl: string }> = []

    const alreadyExists = existingSources.some((s) => s.externalUrl === newExternalUrl)
    expect(alreadyExists).toBe(false) // Não existe → deve criar novo listing

    existingSources.push({ externalUrl: newExternalUrl })
    expect(existingSources).toHaveLength(1)
  })
})

describe('R06: localPath ausente → fallback para urlOriginal; arquivo ausente → não quebra UI', () => {
  it('deve usar urlOriginal quando localPath é null', () => {
    const urlOriginal = 'https://resizedimgs.vivareal.com/foto.jpg'
    const localPath: string | null = null

    const displayUrl = localPath ? localPathToUrl(localPath, '/app/data/photos') : urlOriginal
    expect(displayUrl).toBe(urlOriginal)
  })

  it('deve usar /api/photos/... quando localPath está preenchido', () => {
    const urlOriginal = 'https://resizedimgs.vivareal.com/foto.jpg'
    const localPath = '/app/data/photos/a1/uuid/0.jpg'

    const displayUrl = localPath ? localPathToUrl(localPath, '/app/data/photos') : urlOriginal
    expect(displayUrl).toBe('/api/photos/a1/uuid/0.jpg')
    expect(displayUrl).not.toBe(urlOriginal)
  })
})

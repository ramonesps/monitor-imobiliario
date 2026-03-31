// Interface base e classe abstrata para scrapers de plataformas
// Cada plataforma implementa PlatformScraper

import type { RawListing, PlatformScraper } from '@/types'

export type { RawListing, PlatformScraper }

// Opções de retry para resiliência (R04)
export interface RetryOptions {
  maxAttempts: number
  baseDelayMs: number
  maxDelayMs: number
}

const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
}

/**
 * Classe abstrata base para scrapers de plataformas.
 * Fornece helpers de retry, error handling e parsing comuns.
 */
export abstract class BaseScraper implements PlatformScraper {
  abstract name: string

  abstract search(buildingName: string, address: string): Promise<RawListing[]>

  /**
   * Executa uma função com retry e backoff exponencial.
   * Utilizado para lidar com rate limiting (R04).
   */
  protected async withRetry<T>(
    fn: () => Promise<T>,
    options: RetryOptions = DEFAULT_RETRY_OPTIONS
  ): Promise<T> {
    let lastError: Error | undefined

    for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
      try {
        return await fn()
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))

        if (attempt < options.maxAttempts) {
          const delay = Math.min(
            options.baseDelayMs * Math.pow(2, attempt - 1),
            options.maxDelayMs
          )
          console.warn(
            `[${this.name}] Tentativa ${attempt}/${options.maxAttempts} falhou: ${lastError.message}. Aguardando ${delay}ms...`
          )
          await this.sleep(delay)
        }
      }
    }

    throw lastError
  }

  /**
   * Parseia o status de mobília a partir de texto.
   * U07: "Mobiliado" → 'full', "Semi" → 'partial', "Sem mobília" → 'none'
   */
  protected parseFurnished(text: string): 'full' | 'partial' | 'none' | 'unknown' {
    const lower = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    if (lower.includes('semi')) return 'partial'
    if (lower.includes('mobiliado') || lower.includes('mobiliad') || lower.includes('mobiliada')) return 'full'
    if (lower.includes('sem mobilia') || lower.includes('nao mobiliado') || lower.includes('desmobiliado')) return 'none'
    return 'unknown'
  }

  /**
   * Extrai número do andar a partir de texto.
   * U08: "12º andar" → "12", "Térreo" → "0"
   */
  protected parseFloor(text: string): string | undefined {
    const lower = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

    // Térreo = andar 0
    if (lower.includes('terreo') || lower.includes('terrro') || lower.includes('ground')) {
      return '0'
    }

    // Extrai número de "12º andar", "12 andar", "andar 12", etc.
    const match = text.match(/(\d+)\s*[°º]?\s*andar/i) || text.match(/andar\s*[°º]?\s*(\d+)/i)
    if (match) return match[1]

    // Número puro
    const numMatch = text.match(/^(\d+)$/)
    if (numMatch) return numMatch[1]

    return undefined
  }

  /**
   * Loga erro sem re-throw para tolerância a falhas (R02).
   */
  protected logParseError(field: string, value: unknown, error: unknown): void {
    console.error(`[${this.name}] Erro ao parsear campo '${field}' de '${value}':`, error)
  }

  /**
   * Utilitário de sleep para backoff.
   */
  protected sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

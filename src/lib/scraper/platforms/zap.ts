// Scraper para ZAP Imóveis (zapimoveis.com.br)
// Fase 1: Primeiro scraper a ser implementado

import { BaseScraper } from './base'
import type { RawListing } from '@/types'

export class ZapScraper extends BaseScraper {
  name = 'zap'

  async search(buildingName: string, address: string): Promise<RawListing[]> {
    // TODO: Implementar busca no ZAP Imóveis
    // 1. Usar Playwright para abrir zapimoveis.com.br
    // 2. Pesquisar pelo nome do prédio + endereço
    // 3. Iterar páginas de resultados
    // 4. Extrair dados via Cheerio
    // 5. Retornar array de RawListing
    //
    // Seletores esperados (sujeito a mudança):
    // - Card de anúncio: [data-id] ou .listing-item
    // - Preço: .listing__price
    // - Área: .listing__detail--area
    // - Quartos: .listing__detail--bedroom
    // - Andar: .listing__detail--floor
    // - Fotos: .carousel__image img
    console.log(`[zap] search not implemented yet. Building: ${buildingName}, Address: ${address}`)
    return []
  }

  /**
   * Parseia o HTML de um card de anúncio do ZAP.
   * Exposto para testes de integração com mock HTML (I01).
   */
  parseListingCard(_html: string): Partial<RawListing> | null {
    // TODO: Implementar parsing com Cheerio
    throw new Error('not implemented')
  }
}

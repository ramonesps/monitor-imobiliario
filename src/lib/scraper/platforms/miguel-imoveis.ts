// Scraper para Miguel Imóveis (miguelimoveis.com.br)
// Imobiliária local — scraper custom

import { BaseScraper } from './base'
import type { RawListing } from '@/types'

export class MiguelImoveisScraper extends BaseScraper {
  name = 'miguel-imoveis'

  async search(buildingName: string, address: string): Promise<RawListing[]> {
    // TODO: Implementar scraper custom para Miguel Imóveis
    //
    // Site imobiliário local com estrutura HTML própria.
    // 1. Usar Playwright para abrir miguelimoveis.com.br
    // 2. Buscar pelo nome do prédio
    // 3. Extrair RawListings com seletores específicos do site
    console.log(`[miguel-imoveis] search not implemented yet. Building: ${buildingName}, Address: ${address}`)
    return []
  }

  /**
   * Parseia o HTML de um card de anúncio da Miguel Imóveis.
   * Exposto para testes de integração com mock HTML (I06).
   */
  parseListingCard(_html: string): Partial<RawListing> | null {
    // TODO: Implementar parsing com Cheerio
    throw new Error('not implemented')
  }
}

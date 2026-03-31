// Scraper para Frias Neto (friasneto.com.br)
// Imobiliária local — scraper custom

import { BaseScraper } from './base'
import type { RawListing } from '@/types'

export class FriasNetoScraper extends BaseScraper {
  name = 'frias-neto'

  async search(buildingName: string, address: string): Promise<RawListing[]> {
    // TODO: Implementar scraper custom para Frias Neto
    //
    // Site imobiliário local com estrutura HTML própria.
    // 1. Usar Playwright para abrir friasneto.com.br
    // 2. Buscar pelo nome do prédio
    // 3. Extrair RawListings com seletores específicos do site
    console.log(`[frias-neto] search not implemented yet. Building: ${buildingName}, Address: ${address}`)
    return []
  }

  /**
   * Parseia o HTML de um card de anúncio da Frias Neto.
   * Exposto para testes de integração com mock HTML (I05).
   */
  parseListingCard(_html: string): Partial<RawListing> | null {
    // TODO: Implementar parsing com Cheerio
    throw new Error('not implemented')
  }
}

// Scraper para ImovelWeb (imovelweb.com.br)
// Cobertura adicional de anúncios

import { BaseScraper } from './base'
import type { RawListing } from '@/types'

export class ImovelWebScraper extends BaseScraper {
  name = 'imovelweb'

  async search(buildingName: string, address: string): Promise<RawListing[]> {
    // TODO: Implementar busca no ImovelWeb
    //
    // 1. Usar Playwright para abrir imovelweb.com.br
    // 2. Pesquisar pelo nome do prédio
    // 3. Extrair RawListings
    console.log(`[imovelweb] search not implemented yet. Building: ${buildingName}, Address: ${address}`)
    return []
  }

  /**
   * Parseia o HTML de um card de anúncio do ImovelWeb.
   * Exposto para testes de integração com mock HTML (I04).
   */
  parseListingCard(_html: string): Partial<RawListing> | null {
    // TODO: Implementar parsing com Cheerio
    throw new Error('not implemented')
  }
}

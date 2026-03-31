// Scraper para VivaReal (vivareal.com.br)
// Mesma empresa do ZAP — compartilha muitos anúncios

import { BaseScraper } from './base'
import type { RawListing } from '@/types'

export class VivaRealScraper extends BaseScraper {
  name = 'vivareal'

  async search(buildingName: string, address: string): Promise<RawListing[]> {
    // TODO: Implementar busca no VivaReal
    // Estrutura similar ao ZAP (mesma empresa), possível reuso de lógica
    //
    // 1. Usar Playwright para abrir vivareal.com.br
    // 2. Pesquisar pelo nome do prédio
    // 3. Extrair RawListings
    console.log(`[vivareal] search not implemented yet. Building: ${buildingName}, Address: ${address}`)
    return []
  }

  /**
   * Parseia o HTML de um card de anúncio do VivaReal.
   * Exposto para testes de integração com mock HTML (I02).
   */
  parseListingCard(_html: string): Partial<RawListing> | null {
    // TODO: Implementar parsing com Cheerio
    throw new Error('not implemented')
  }
}

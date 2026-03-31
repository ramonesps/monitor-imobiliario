// Scraper para OLX (olx.com.br)
// Complementa com anúncios de particulares

import { BaseScraper } from './base'
import type { RawListing } from '@/types'

export class OlxScraper extends BaseScraper {
  name = 'olx'

  async search(buildingName: string, address: string): Promise<RawListing[]> {
    // TODO: Implementar busca na OLX
    //
    // 1. Usar Playwright para abrir olx.com.br/imoveis
    // 2. Pesquisar pelo nome do prédio
    // 3. Extrair RawListings (anúncios de particulares + imobiliárias)
    //
    // Observação: OLX usa JS dinâmico, precisará aguardar hydration
    console.log(`[olx] search not implemented yet. Building: ${buildingName}, Address: ${address}`)
    return []
  }

  /**
   * Parseia o HTML de um card de anúncio da OLX.
   * Exposto para testes de integração com mock HTML (I03).
   */
  parseListingCard(_html: string): Partial<RawListing> | null {
    // TODO: Implementar parsing com Cheerio
    throw new Error('not implemented')
  }
}

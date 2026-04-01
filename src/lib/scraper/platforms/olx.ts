// Scraper para OLX (olx.com.br)
// Foco em anúncios de particulares e imobiliárias menores
// OLX usa Next.js com __NEXT_DATA__ mas estrutura diferente do ZAP/VivaReal

import { BaseScraper } from './base'
import type { RawListing } from '@/types'

const BASE_URL = 'https://www.olx.com.br'
const MAX_PAGES = 3 // OLX tem menos resultados relevantes por busca

export class OlxScraper extends BaseScraper {
  name = 'olx'

  async search(buildingName: string, _address: string): Promise<RawListing[]> {
    const { chromium } = await import('playwright')
    const browser = await chromium.launch({ headless: true })
    const all: RawListing[] = []

    try {
      const context = await browser.newContext({
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        locale: 'pt-BR',
      })

      const listings = await this.withRetry(() =>
        this.searchListings(context, buildingName)
      )
      all.push(...listings)

      await context.close()
    } finally {
      await browser.close()
    }

    return all
  }

  private async searchListings(
    context: import('playwright').BrowserContext,
    query: string
  ): Promise<RawListing[]> {
    const page = await context.newPage()
    const all: RawListing[] = []

    try {
      for (let pageNum = 1; pageNum <= MAX_PAGES; pageNum++) {
        // OLX usa o parâmetro 'q' e 'o' para offset de página
        const offset = (pageNum - 1) * 50
        const url =
          pageNum === 1
            ? `${BASE_URL}/imoveis?q=${encodeURIComponent(query)}&sf=1`
            : `${BASE_URL}/imoveis?q=${encodeURIComponent(query)}&sf=1&o=${pageNum}`

        console.log(`[olx] Buscando página ${pageNum}: ${url}`)

        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
        await page.waitForTimeout(2000)

        const nextDataText = await page.evaluate(() => {
          const el = document.getElementById('__NEXT_DATA__')
          return el ? el.textContent : null
        })

        if (!nextDataText) {
          console.warn(`[olx] __NEXT_DATA__ não encontrado na página ${pageNum}`)
          break
        }

        let nextData: any
        try {
          nextData = JSON.parse(nextDataText)
        } catch {
          break
        }

        const listings = this.extractListingsFromNextData(nextData)
        if (listings.length === 0) break

        all.push(...listings)
        if (pageNum < MAX_PAGES) await page.waitForTimeout(1500)
      }
    } finally {
      await page.close()
    }

    return all
  }

  /**
   * Extrai listings do __NEXT_DATA__ da OLX.
   * Exposto para testes (I03).
   */
  extractListingsFromNextData(nextData: any): RawListing[] {
    const results: RawListing[] = []

    // OLX pode ter os ads em diferentes caminhos
    const ads: any[] =
      nextData?.props?.pageProps?.ads ??
      nextData?.props?.pageProps?.initialListings ??
      nextData?.props?.pageProps?.listingProps?.ads ??
      []

    if (!Array.isArray(ads)) return results

    for (const ad of ads) {
      try {
        const adId = String(ad.listId ?? ad.id ?? ad.adId ?? '')
        if (!adId) continue

        const adUrl = String(ad.url ?? ad.link ?? '')
        const externalUrl = adUrl.startsWith('http') ? adUrl : `${BASE_URL}${adUrl}`

        // OLX embute o preço diretamente
        const priceRaw = ad.price ?? ad.priceValue ?? ad.priceTag?.price ?? ''
        const price = parseFloat(String(priceRaw).replace(/[^\d,]/g, '').replace(',', '.'))
        if (!price || price <= 0) continue

        // Categoria/tipo: imóveis para venda vs aluguel
        const category = String(
          ad.category?.name ?? ad.subject ?? ad.title ?? ''
        ).toLowerCase()
        const type = this.inferType(category, ad)

        // Parâmetros do anúncio (área, quartos, etc.)
        const params: any[] = ad.params ?? ad.properties ?? []
        const area = this.extractParam(params, ['size', 'area', 'tamanho', 'area_util'])
        const bedrooms = this.extractParam(params, ['rooms', 'quartos', 'bedrooms', 'dormitorios'])
        const floorParam = this.extractParam(params, ['floor', 'andar'])

        const floor = floorParam ? String(floorParam) : undefined

        // Mobília
        const furnishingParam = this.extractParamRaw(params, ['furnished', 'mobilia', 'mobiliado'])
        const furnished = furnishingParam ? this.parseFurnished(String(furnishingParam)) : 'unknown'

        // Fotos
        const images: string[] = (ad.images ?? ad.photos ?? [])
          .map((img: any) => (typeof img === 'string' ? img : img?.src ?? img?.url ?? ''))
          .filter(Boolean)
          .slice(0, 10)

        const olxCity = ad.location?.municipality ?? ad.location?.city ?? ad.municipality ?? null
        const olxState = ad.location?.uf ?? ad.location?.state ?? ad.uf ?? null

        results.push({
          externalId: adId,
          externalUrl,
          platform: 'olx',
          type,
          price,
          floor,
          area: area ? Number(area) : undefined,
          bedrooms: bedrooms ? Number(bedrooms) : undefined,
          furnished,
          description: String(ad.body ?? ad.description ?? ad.subject ?? '').slice(0, 2000),
          agencyName: ad.user?.name ?? ad.professionalAd ? 'Imobiliária' : undefined,
          photoUrls: images,
          city: olxCity ? String(olxCity) : undefined,
          state: olxState ? String(olxState) : undefined,
        })
      } catch (err) {
        this.logParseError('ad', ad?.listId ?? '?', err)
      }
    }

    return results
  }

  private inferType(
    categoryText: string,
    ad: any
  ): 'sale' | 'rent' {
    // Tenta inferir pelo subcategory ou título
    const combined = (categoryText + ' ' + String(ad.subject ?? ad.title ?? '')).toLowerCase()
    if (
      combined.includes('aluguel') ||
      combined.includes('alugar') ||
      combined.includes('locação') ||
      combined.includes('locacao')
    ) {
      return 'rent'
    }
    return 'sale'
  }

  private extractParam(params: any[], keys: string[]): number | null {
    for (const p of params) {
      const key = String(p.name ?? p.key ?? p.label ?? '').toLowerCase()
      if (keys.some((k) => key.includes(k))) {
        const val = parseFloat(String(p.value ?? p.rawValue ?? '').replace(/[^\d,]/g, ''))
        if (!isNaN(val)) return val
      }
    }
    return null
  }

  private extractParamRaw(params: any[], keys: string[]): string | null {
    for (const p of params) {
      const key = String(p.name ?? p.key ?? p.label ?? '').toLowerCase()
      if (keys.some((k) => key.includes(k))) {
        return String(p.value ?? p.rawValue ?? '')
      }
    }
    return null
  }

  parseListingCard(html: string): Partial<RawListing> | null {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const cheerio = require('cheerio')
    const $ = cheerio.load(html)

    try {
      const priceText = $('[data-testid="price"], .price, .sc-1fcmfeb-2').first().text().trim()
      const price = parseFloat(priceText.replace(/[^\d]/g, ''))

      const title = $('a, h2').first().text().trim()
      const type = this.inferType(title, {})

      return {
        price: isNaN(price) ? undefined : price,
        type,
        platform: 'olx',
      }
    } catch (err) {
      this.logParseError('card', html.slice(0, 100), err)
      return null
    }
  }
}

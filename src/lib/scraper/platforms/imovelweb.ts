// Scraper para ImovelWeb (imovelweb.com.br)
// Plataforma do grupo Navent/Lifull — estrutura Next.js com __NEXT_DATA__

import { BaseScraper } from './base'
import type { RawListing } from '@/types'

const BASE_URL = 'https://www.imovelweb.com.br'
const MAX_PAGES = 5

export class ImovelWebScraper extends BaseScraper {
  name = 'imovelweb'

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

      for (const type of ['venda', 'aluguel'] as const) {
        const listings = await this.withRetry(() =>
          this.searchByType(context, buildingName, type)
        )
        all.push(...listings)
      }

      await context.close()
    } finally {
      await browser.close()
    }

    return all
  }

  private async searchByType(
    context: import('playwright').BrowserContext,
    query: string,
    type: 'venda' | 'aluguel'
  ): Promise<RawListing[]> {
    const page = await context.newPage()
    const all: RawListing[] = []

    try {
      for (let pageNum = 1; pageNum <= MAX_PAGES; pageNum++) {
        // ImovelWeb usa slug de tipo na URL e parâmetro 'q' para busca
        const slug = type === 'venda' ? 'imoveis-venda' : 'imoveis-aluguel'
        const pagePart = pageNum > 1 ? `-pagina-${pageNum}` : ''
        const url = `${BASE_URL}/${slug}${pagePart}.html?q=${encodeURIComponent(query)}`

        console.log(`[imovelweb] Buscando ${type} página ${pageNum}: ${url}`)

        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
        await page.waitForTimeout(2000)

        const nextDataText = await page.evaluate(() => {
          const el = document.getElementById('__NEXT_DATA__')
          return el ? el.textContent : null
        })

        if (!nextDataText) {
          console.warn(`[imovelweb] __NEXT_DATA__ não encontrado na página ${pageNum}`)
          break
        }

        let nextData: any
        try {
          nextData = JSON.parse(nextDataText)
        } catch {
          break
        }

        const listings = this.extractListingsFromNextData(nextData, type)
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
   * Extrai listings do __NEXT_DATA__ do ImovelWeb.
   * Exposto para testes (I04).
   */
  extractListingsFromNextData(nextData: any, type: 'venda' | 'aluguel'): RawListing[] {
    const results: RawListing[] = []
    const listingType = type === 'venda' ? 'sale' : 'rent'
    const businessType = type === 'venda' ? 'SALE' : 'RENTAL'

    // ImovelWeb pode organizar os listings em diferentes estruturas
    const listings: any[] =
      nextData?.props?.pageProps?.initialListings ??
      nextData?.props?.pageProps?.listingWrapper ??
      nextData?.props?.pageProps?.searchResults?.listings ??
      nextData?.props?.pageProps?.postings ??
      []

    if (!Array.isArray(listings)) return results

    for (const item of listings) {
      try {
        const listing = item?.listing ?? item?.posting ?? item
        const pricingInfos: any[] =
          item?.pricingInfos ?? listing?.pricingInfos ?? listing?.prices ?? []
        const link = item?.link ?? listing?.link ?? {}
        const account = item?.account ?? listing?.publisher ?? {}

        // ImovelWeb pode ter preço diretamente no listing
        let price = 0
        const pricing = pricingInfos.find((p: any) => p.businessType === businessType)
        if (pricing) {
          price = parseFloat(String(pricing.price ?? pricing.amount ?? 0))
        } else {
          // Fallback: preço direto no objeto
          price = parseFloat(
            String(listing.price ?? listing.priceValue ?? listing.salePrice ?? 0)
          )
        }
        if (!price || price <= 0) continue

        const externalId = String(
          listing.id ?? listing.externalId ?? listing.postingId ?? ''
        )
        if (!externalId) continue

        const href = String(link.href ?? link.url ?? listing.url ?? '')
        const externalUrl = href.startsWith('http') ? href : `${BASE_URL}${href}`

        // Área
        const usableAreas: number[] = listing.usableAreas ?? listing.coveredArea ?? []
        const areaValue = Array.isArray(usableAreas) ? usableAreas[0] : usableAreas
        const area = areaValue ?? listing.usableArea ?? listing.totalArea ?? null

        // Quartos
        const bedrooms: number[] = listing.bedrooms ?? listing.rooms ?? []
        const bedroomCount = Array.isArray(bedrooms) ? bedrooms[0] : bedrooms
        const bedroomFinal = bedroomCount ?? listing.bedroom ?? null

        // Andar
        const floorRaw = listing.unitFloor ?? listing.floor ?? listing.floorNumber ?? null
        const floor = floorRaw !== null ? String(floorRaw) : undefined

        // Mobília
        const amenities: string[] = listing.amenities ?? listing.features ?? []
        const furnished = this.parseFurnishedIW(amenities, listing)

        // Fotos
        const images: string[] = (listing.images ?? listing.photos ?? [])
          .map((img: any) => (typeof img === 'string' ? img : img?.url ?? img?.src ?? ''))
          .filter(Boolean)
          .slice(0, 10)

        results.push({
          externalId,
          externalUrl,
          platform: 'imovelweb',
          type: listingType,
          price,
          floor,
          area: area ? Number(area) : undefined,
          bedrooms: bedroomFinal ? Number(bedroomFinal) : undefined,
          furnished,
          description: String(listing.description ?? listing.title ?? '').slice(0, 2000),
          agencyName:
            String(account.name ?? account.companyName ?? account.publisherName ?? '') ||
            undefined,
          photoUrls: images,
        })
      } catch (err) {
        this.logParseError('listing', item?.listing?.id ?? '?', err)
      }
    }

    return results
  }

  private parseFurnishedIW(
    amenities: string[],
    listing: any
  ): 'full' | 'partial' | 'none' | 'unknown' {
    // Tenta por código inglês primeiro
    const upper = amenities.map((a) => a.toUpperCase())
    if (upper.includes('FURNISHED') && !upper.includes('SEMI_FURNISHED')) return 'full'
    if (upper.includes('SEMI_FURNISHED')) return 'partial'
    if (upper.includes('NOT_FURNISHED') || upper.includes('UNFURNISHED')) return 'none'

    // Tenta campo específico do ImovelWeb
    const furnishedField = listing.furnished ?? listing.mobilia ?? listing.furnishingType
    if (furnishedField) return this.parseFurnished(String(furnishedField))

    // Fallback: busca no texto das amenidades
    return this.parseFurnished(amenities.join(' '))
  }

  parseListingCard(html: string): Partial<RawListing> | null {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const cheerio = require('cheerio')
    const $ = cheerio.load(html)

    try {
      const priceText = $('.price-value, [data-testid="price"]').first().text().trim()
      const price = parseFloat(priceText.replace(/[^\d]/g, ''))

      const areaText = $('[data-testid="area"], .icon-stacked').first().text().trim()
      const area = parseFloat(areaText.replace(/[^\d]/g, ''))

      const floorText = $('p').filter((_: number, el: any) => {
        return $(el).text().toLowerCase().includes('andar')
      }).first().text().trim()
      const floor = floorText ? (this.parseFloor(floorText) ?? undefined) : undefined

      const agencyName = $('.publisher-label, [data-testid="publisher"]').first().text().trim()

      return {
        price: isNaN(price) ? undefined : price,
        area: isNaN(area) ? undefined : area,
        floor,
        agencyName: agencyName || undefined,
        platform: 'imovelweb',
      }
    } catch (err) {
      this.logParseError('card', html.slice(0, 100), err)
      return null
    }
  }
}

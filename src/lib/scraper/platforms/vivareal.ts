// Scraper para VivaReal (vivareal.com.br)
// Mesma empresa do ZAP (OLX Group) — estrutura __NEXT_DATA__ idêntica
// Reusa a lógica de extração do ZAP com URLs e nome de plataforma diferentes

import { BaseScraper } from './base'
import type { RawListing } from '@/types'

const BASE_URL = 'https://www.vivareal.com.br'
const MAX_PAGES = 5

export class VivaRealScraper extends BaseScraper {
  name = 'vivareal'

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
        const url = `${BASE_URL}/${type}/imoveis/?q=${encodeURIComponent(query)}${pageNum > 1 ? `&pagina=${pageNum}` : ''}`
        console.log(`[vivareal] Buscando ${type} página ${pageNum}: ${url}`)

        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
        await page.waitForTimeout(2000)

        const nextDataText = await page.evaluate(() => {
          const el = document.getElementById('__NEXT_DATA__')
          return el ? el.textContent : null
        })

        if (!nextDataText) {
          console.warn(`[vivareal] __NEXT_DATA__ não encontrado na página ${pageNum}`)
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
   * Extrai listings do __NEXT_DATA__ do VivaReal.
   * Estrutura idêntica ao ZAP. Exposto para testes (I02).
   */
  extractListingsFromNextData(nextData: any, type: 'venda' | 'aluguel'): RawListing[] {
    const results: RawListing[] = []
    const listingType = type === 'venda' ? 'sale' : 'rent'
    const businessType = type === 'venda' ? 'SALE' : 'RENTAL'

    const listings: any[] =
      nextData?.props?.pageProps?.initialListings ??
      nextData?.props?.pageProps?.listingWrapper ??
      nextData?.props?.pageProps?.initialSearchResults?.listings ??
      []

    if (!Array.isArray(listings)) return results

    for (const item of listings) {
      try {
        const listing = item?.listing ?? item
        const pricingInfos: any[] = item?.pricingInfos ?? listing?.pricingInfos ?? []
        const link = item?.link ?? {}
        const account = item?.account ?? {}

        const pricing = pricingInfos.find((p: any) => p.businessType === businessType)
        if (!pricing) continue

        const price = parseFloat(String(pricing.price ?? pricing.monthlyRentPrice ?? 0))
        if (!price || price <= 0) continue

        const externalId = String(listing.id ?? listing.externalId ?? '')
        if (!externalId) continue

        const href = String(link.href ?? link.uri ?? '')
        const externalUrl = href.startsWith('http') ? href : `${BASE_URL}${href}`

        const usableAreas: number[] = listing.usableAreas ?? []
        const area = usableAreas[0] ?? listing.usableArea ?? null

        const bedrooms: number[] = listing.bedrooms ?? []
        const bedroomCount = bedrooms[0] ?? listing.bedroom ?? null

        const floorRaw = listing.unitFloor ?? listing.floor ?? null
        const floor = floorRaw !== null ? String(floorRaw) : undefined

        const amenities: string[] = listing.amenities ?? []
        const furnished = this.parseFurnishedVR(amenities)

        const images: string[] = (listing.images ?? [])
          .map((img: any) => (typeof img === 'string' ? img : img?.url ?? ''))
          .filter(Boolean)
          .slice(0, 10)

        results.push({
          externalId,
          externalUrl,
          platform: 'vivareal',
          type: listingType,
          price,
          floor,
          area: area ? Number(area) : undefined,
          bedrooms: bedroomCount ? Number(bedroomCount) : undefined,
          furnished,
          description: String(listing.description ?? '').slice(0, 2000),
          agencyName: String(account.name ?? account.companyName ?? '') || undefined,
          photoUrls: images,
        })
      } catch (err) {
        this.logParseError('listing', item?.listing?.id ?? '?', err)
      }
    }

    return results
  }

  private parseFurnishedVR(amenities: string[]): 'full' | 'partial' | 'none' | 'unknown' {
    const upper = amenities.map((a) => a.toUpperCase())
    if (upper.includes('FURNISHED') && !upper.includes('SEMI_FURNISHED')) return 'full'
    if (upper.includes('SEMI_FURNISHED')) return 'partial'
    if (upper.includes('NOT_FURNISHED') || upper.includes('UNFURNISHED')) return 'none'
    return this.parseFurnished(amenities.join(' '))
  }

  parseListingCard(html: string): Partial<RawListing> | null {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const cheerio = require('cheerio')
    const $ = cheerio.load(html)

    try {
      const priceText = $('.property-card__price, [data-testid="price"]').first().text().trim()
      const price = parseFloat(priceText.replace(/[^\d]/g, ''))

      const areaText = $('[data-testid="area"], .features__item--area').first().text().trim()
      const area = parseFloat(areaText.replace(/[^\d]/g, ''))

      const bedroomsText = $('[data-testid="bedrooms"], .features__item--bedroom')
        .first()
        .text()
        .trim()
      const bedrooms = parseInt(bedroomsText) || undefined

      const floorText = $('[data-testid="floor"], .property-address__floor').first().text().trim()
      const floor = floorText ? (this.parseFloor(floorText) ?? undefined) : undefined

      return {
        price: isNaN(price) ? undefined : price,
        area: isNaN(area) ? undefined : area,
        bedrooms,
        floor,
        platform: 'vivareal',
      }
    } catch (err) {
      this.logParseError('card', html.slice(0, 100), err)
      return null
    }
  }
}

// Scraper para ZAP Imóveis (zapimoveis.com.br)
// ZAP migrou para Next.js App Router — extrai dados interceptando chamadas à API interna
// Fallback: tenta __NEXT_DATA__ (páginas antigas) e extração dos scripts RSC

import { BaseScraper } from './base'
import type { RawListing } from '@/types'

const BASE_URL = 'https://www.zapimoveis.com.br'
const MAX_PAGES = 5

export class ZapScraper extends BaseScraper {
  name = 'zap'

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

    // Intercepta respostas JSON da API interna do ZAP
    const capturedApiData: any[] = []
    page.on('response', async (response) => {
      const url = response.url()
      if (
        (url.includes('zapimoveis.com.br') || url.includes('zap-static')) &&
        url.includes('/v') &&
        (url.includes('listing') || url.includes('search') || url.includes('imovel'))
      ) {
        try {
          const ct = response.headers()['content-type'] ?? ''
          if (ct.includes('json')) {
            const json = await response.json().catch(() => null)
            if (json) capturedApiData.push(json)
          }
        } catch { /* ignora */ }
      }
    })

    try {
      for (let pageNum = 1; pageNum <= MAX_PAGES; pageNum++) {
        capturedApiData.length = 0
        const url = this.buildSearchUrl(query, type, pageNum)
        console.log(`[zap] Buscando ${type} página ${pageNum}: ${url}`)

        await page.goto(url, { waitUntil: 'networkidle', timeout: 40000 })
        await page.waitForTimeout(2000)

        // Tenta __NEXT_DATA__ (formato legado)
        const nextDataText = await page.evaluate(() => {
          const el = document.getElementById('__NEXT_DATA__')
          return el ? el.textContent : null
        })

        let pageListings: RawListing[] = []

        if (nextDataText) {
          try {
            const nextData = JSON.parse(nextDataText)
            pageListings = this.extractListingsFromNextData(nextData, type)
          } catch { /* ignora */ }
        }

        // Fallback: tenta dados capturados da API interna
        if (pageListings.length === 0 && capturedApiData.length > 0) {
          for (const apiResp of capturedApiData) {
            const extracted = this.extractListingsFromApiResponse(apiResp, type)
            pageListings.push(...extracted)
          }
        }

        // Fallback: extrai dos scripts RSC (__next_f)
        if (pageListings.length === 0) {
          pageListings = await this.extractFromRscScripts(page, type)
        }

        if (pageListings.length === 0) {
          console.warn(`[zap] Nenhum listing extraído na página ${pageNum}, parando`)
          break
        }

        all.push(...pageListings)

        if (pageNum < MAX_PAGES) await page.waitForTimeout(1500)
      }
    } finally {
      await page.close()
    }

    return all
  }

  private buildSearchUrl(query: string, type: 'venda' | 'aluguel', page: number): string {
    const encoded = encodeURIComponent(query)
    const pagePart = page > 1 ? `&pagina=${page}` : ''
    return `${BASE_URL}/${type}/imoveis/?q=${encoded}${pagePart}`
  }

  /** Extrai listings de respostas JSON da API interna do ZAP */
  private extractListingsFromApiResponse(apiResp: any, type: 'venda' | 'aluguel'): RawListing[] {
    const listingType = type === 'venda' ? 'sale' : 'rent'
    const results: RawListing[] = []

    // Diferentes formatos de resposta da API interna
    const items: any[] =
      apiResp?.listings ??
      apiResp?.data?.listings ??
      apiResp?.search?.result?.listings ??
      apiResp?.result?.listings ??
      (Array.isArray(apiResp) ? apiResp : [])

    for (const item of items) {
      try {
        const listing = item?.listing ?? item
        const pricingInfos: any[] = item?.pricingInfos ?? listing?.pricingInfos ?? []

        const businessType = type === 'venda' ? 'SALE' : 'RENTAL'
        const pricing = pricingInfos.find((p: any) => p.businessType === businessType)
        if (!pricing) continue

        const price = parseFloat(String(pricing.price ?? pricing.monthlyRentPrice ?? 0))
        if (!price || price <= 0) continue

        const externalId = String(listing.id ?? listing.externalId ?? '')
        if (!externalId) continue

        const href = String(item?.link?.href ?? item?.link?.uri ?? listing?.link?.href ?? '')
        const externalUrl = href.startsWith('http') ? href : `${BASE_URL}${href}`

        const usableAreas: number[] = listing.usableAreas ?? []
        const area = usableAreas[0] ?? listing.usableArea ?? null
        const bedrooms: number[] = listing.bedrooms ?? []
        const bedroomCount = bedrooms[0] ?? listing.bedroom ?? null
        const floorRaw = listing.unitFloor ?? listing.floor ?? null
        const floor = floorRaw !== null ? String(floorRaw) : undefined
        const amenities: string[] = listing.amenities ?? []
        const images: string[] = (listing.images ?? [])
          .map((img: any) => (typeof img === 'string' ? img : img?.url ?? ''))
          .filter(Boolean)
          .slice(0, 10)

        const address = listing?.address ?? item?.address ?? {}
        const addressCity = address?.city ?? address?.neighborhood?.city ?? null
        const addressState = address?.stateAcronym ?? address?.state ?? null

        results.push({
          externalId,
          externalUrl,
          platform: 'zap',
          type: listingType,
          price,
          floor,
          area: area ? Number(area) : undefined,
          bedrooms: bedroomCount ? Number(bedroomCount) : undefined,
          furnished: this.parseFurnishedZap(amenities),
          description: String(listing.description ?? '').slice(0, 2000),
          agencyName: String(item?.account?.name ?? item?.account?.companyName ?? '') || undefined,
          photoUrls: images,
          city: addressCity ? String(addressCity) : undefined,
          state: addressState ? String(addressState) : undefined,
        })
      } catch (err) {
        this.logParseError('api-listing', item?.listing?.id ?? '?', err)
      }
    }

    return results
  }

  /** Extrai listings dos scripts RSC do Next.js App Router (__next_f) */
  private async extractFromRscScripts(
    page: import('playwright').Page,
    type: 'venda' | 'aluguel'
  ): Promise<RawListing[]> {
    const listingType = type === 'venda' ? 'sale' : 'rent'
    const results: RawListing[] = []

    try {
      // Coleta todos os dados do __next_f
      const rscChunks = await page.evaluate(() => {
        return (window as any).__next_f
          ?.filter((chunk: any[]) => chunk[0] === 1)
          .map((chunk: any[]) => chunk[1])
          ?? []
      })

      if (!rscChunks || rscChunks.length === 0) return results

      const fullText = rscChunks.join('\n')

      // Extrai blocos JSON que parecem listings (contém "businessType" ou "pricingInfos")
      const jsonBlocks = this.extractJsonBlocks(fullText)

      for (const block of jsonBlocks) {
        if (!block.id || (!block.pricingInfos && !block.price)) continue

        const pricingInfos: any[] = block.pricingInfos ?? []
        const businessType = type === 'venda' ? 'SALE' : 'RENTAL'
        const pricing = pricingInfos.find((p: any) => p.businessType === businessType)
        if (!pricing && !block.price) continue

        const price = parseFloat(String(pricing?.price ?? block.price ?? 0))
        if (!price || price <= 0) continue

        const address = block.address ?? {}
        results.push({
          externalId: String(block.id),
          externalUrl: `${BASE_URL}/imovel/${block.id}`,
          platform: 'zap',
          type: listingType,
          price,
          area: block.usableAreas?.[0] ?? block.usableArea ?? undefined,
          bedrooms: block.bedrooms?.[0] ?? block.bedroom ?? undefined,
          furnished: this.parseFurnishedZap(block.amenities ?? []),
          description: String(block.description ?? '').slice(0, 2000),
          photoUrls: (block.images ?? []).slice(0, 10),
          city: address.city ?? undefined,
          state: address.stateAcronym ?? address.state ?? undefined,
        })
      }
    } catch (err) {
      console.warn('[zap] Falha ao extrair RSC scripts:', err)
    }

    return results
  }

  private extractJsonBlocks(text: string): any[] {
    const results: any[] = []
    // Procura por objetos JSON que parecem listings
    const regex = /\{"id":"[^"]{5,}","[^}]{50,}/g
    const matches = text.match(regex) ?? []
    for (const match of matches) {
      try {
        // Tenta completar o JSON encontrando o fechamento
        const start = text.indexOf(match)
        if (start === -1) continue
        let depth = 0
        let end = start
        for (let i = start; i < Math.min(start + 5000, text.length); i++) {
          if (text[i] === '{') depth++
          else if (text[i] === '}') {
            depth--
            if (depth === 0) { end = i + 1; break }
          }
        }
        if (end > start) {
          const obj = JSON.parse(text.slice(start, end))
          results.push(obj)
        }
      } catch { /* ignora JSON inválido */ }
    }
    return results
  }

  /**
   * Extrai listings do JSON __NEXT_DATA__ do ZAP Imóveis.
   * Exposto para testes de integração (I01).
   */
  extractListingsFromNextData(nextData: any, type: 'venda' | 'aluguel'): RawListing[] {
    const results: RawListing[] = []
    const listingType = type === 'venda' ? 'sale' : 'rent'

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

        const businessType = type === 'venda' ? 'SALE' : 'RENTAL'
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
        const images: string[] = (listing.images ?? [])
          .map((img: any) => (typeof img === 'string' ? img : img?.url ?? ''))
          .filter(Boolean)
          .slice(0, 10)

        const addressCity =
          listing?.address?.city ??
          listing?.address?.neighborhood?.city ??
          item?.address?.city ??
          null
        const addressState =
          listing?.address?.stateAcronym ??
          listing?.address?.state ??
          item?.address?.stateAcronym ??
          null

        results.push({
          externalId,
          externalUrl,
          platform: 'zap',
          type: listingType,
          price,
          floor,
          area: area ? Number(area) : undefined,
          bedrooms: bedroomCount ? Number(bedroomCount) : undefined,
          furnished: this.parseFurnishedZap(amenities),
          description: String(listing.description ?? '').slice(0, 2000),
          agencyName: String(account.name ?? account.companyName ?? '') || undefined,
          photoUrls: images,
          city: addressCity ? String(addressCity) : undefined,
          state: addressState ? String(addressState) : undefined,
        })
      } catch (err) {
        this.logParseError('listing', item?.listing?.id ?? '?', err)
      }
    }

    return results
  }

  private parseFurnishedZap(amenities: string[]): 'full' | 'partial' | 'none' | 'unknown' {
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
      const priceText = $('.listing__price, [data-testid="price"]').first().text().trim()
      const price = parseFloat(priceText.replace(/[^\d]/g, ''))
      const areaText = $('[data-testid="area"], .listing__detail--area').first().text().trim()
      const area = parseFloat(areaText.replace(/[^\d]/g, ''))
      const bedroomsText = $('[data-testid="bedrooms"]').first().text().trim()
      const bedrooms = parseInt(bedroomsText) || undefined
      const floorText = $('[data-testid="floor"]').first().text().trim()
      const floor = floorText ? (this.parseFloor(floorText) ?? undefined) : undefined
      const description = $('[data-testid="description"]').first().text().trim()

      return {
        price: isNaN(price) ? undefined : price,
        area: isNaN(area) ? undefined : area,
        bedrooms,
        floor,
        description,
        platform: 'zap',
      }
    } catch (err) {
      this.logParseError('card', html.slice(0, 100), err)
      return null
    }
  }
}

// Scraper para VivaReal (vivareal.com.br)
// Mesma empresa do ZAP (OLX Group) — estrutura idêntica, migrada para Next.js App Router
// Intercepta API interna + fallback __NEXT_DATA__ (páginas legadas)

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

    // Intercepta respostas JSON da API interna do VivaReal
    const capturedApiData: any[] = []
    page.on('response', async (response) => {
      const url = response.url()
      if (
        (url.includes('vivareal.com.br') || url.includes('vr-static')) &&
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
        const url = `${BASE_URL}/${type}/imoveis/?q=${encodeURIComponent(query)}${pageNum > 1 ? `&pagina=${pageNum}` : ''}`
        console.log(`[vivareal] Buscando ${type} página ${pageNum}: ${url}`)

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

                const href = String(item?.link?.href ?? listing?.link?.href ?? '')
                const externalUrl = href.startsWith('http') ? href : `${BASE_URL}${href}`
                const address = listing?.address ?? item?.address ?? {}

                // M01: campos novos
                const vrBathroomsRaw = listing.bathrooms
                const vrBathroomCount = Array.isArray(vrBathroomsRaw) ? vrBathroomsRaw[0] : vrBathroomsRaw
                const vrGaragesRaw = listing.parkingSpaces
                const vrGarageCount = Array.isArray(vrGaragesRaw) ? vrGaragesRaw[0] : vrGaragesRaw
                const vrDescFull = String(listing.description ?? '')
                const vrListedAt = listing.updatedAt ? String(listing.updatedAt) : undefined
                const vrAdvertiserName = String(item?.account?.name ?? '') || undefined

                pageListings.push({
                  externalId,
                  externalUrl,
                  platform: 'vivareal',
                  type: type === 'venda' ? 'sale' : 'rent',
                  price,
                  floor: listing.unitFloor != null ? String(listing.unitFloor) : undefined,
                  area: listing.usableAreas?.[0] ?? listing.usableArea ?? undefined,
                  bedrooms: listing.bedrooms?.[0] ?? listing.bedroom ?? undefined,
                  bathrooms: vrBathroomCount && Number(vrBathroomCount) > 0 ? Number(vrBathroomCount) : undefined,
                  garages: vrGarageCount && Number(vrGarageCount) > 0 ? Number(vrGarageCount) : undefined,
                  furnished: this.parseFurnishedVR(listing.amenities ?? []),
                  description: vrDescFull.slice(0, 2000),
                  descriptionFull: vrDescFull || undefined,
                  listedAt: vrListedAt,
                  advertiserName: vrAdvertiserName,
                  agencyName: vrAdvertiserName,
                  photoUrls: this.resolvePhotoUrls(listing.images ?? []),
                  city: address.city ?? address.neighborhood?.city ?? undefined,
                  state: address.stateAcronym ?? address.state ?? undefined,
                })
              } catch (err) {
                this.logParseError('api-listing', item?.listing?.id ?? '?', err)
              }
            }
          }
        }

        if (pageListings.length === 0) {
          console.warn(`[vivareal] Nenhum listing extraído na página ${pageNum}, parando`)
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
        const images = this.resolvePhotoUrls(listing.images ?? [])

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

        // M01: campos novos
        const vrBathroomsRaw2 = listing.bathrooms
        const vrBathroomCount2 = Array.isArray(vrBathroomsRaw2) ? vrBathroomsRaw2[0] : vrBathroomsRaw2
        const vrGaragesRaw2 = listing.parkingSpaces
        const vrGarageCount2 = Array.isArray(vrGaragesRaw2) ? vrGaragesRaw2[0] : vrGaragesRaw2
        const vrDescFull2 = String(listing.description ?? '')
        const vrListedAt2 = listing.updatedAt ? String(listing.updatedAt) : undefined
        const vrAdvertiserName2 = String(account.name ?? account.companyName ?? '') || undefined

        results.push({
          externalId,
          externalUrl,
          platform: 'vivareal',
          type: listingType,
          price,
          floor,
          area: area ? Number(area) : undefined,
          bedrooms: bedroomCount ? Number(bedroomCount) : undefined,
          bathrooms: vrBathroomCount2 && Number(vrBathroomCount2) > 0 ? Number(vrBathroomCount2) : undefined,
          garages: vrGarageCount2 && Number(vrGarageCount2) > 0 ? Number(vrGarageCount2) : undefined,
          furnished: this.parseFurnishedVR(amenities),
          description: vrDescFull2.slice(0, 2000),
          descriptionFull: vrDescFull2 || undefined,
          listedAt: vrListedAt2,
          advertiserName: vrAdvertiserName2,
          agencyName: vrAdvertiserName2,
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

  /** M02: resolve URLs de maior resolução disponível — idêntico ao ZAP (mesma plataforma OLX Group). */
  private resolvePhotoUrls(rawImages: any[]): string[] {
    return rawImages
      .map((img: any) => {
        if (typeof img === 'string') return img
        const variants: any[] = img.sizes ?? img.resolutions ?? img.variants ?? []
        if (variants.length > 0) {
          const best = [...variants].sort((a: any, b: any) => (b.width ?? 0) - (a.width ?? 0))[0]
          return best?.url ?? img.original ?? img.url ?? ''
        }
        return img.original ?? img.url ?? ''
      })
      .filter(Boolean)
      .slice(0, 10)
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
      const bedroomsText = $('[data-testid="bedrooms"], .features__item--bedroom').first().text().trim()
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

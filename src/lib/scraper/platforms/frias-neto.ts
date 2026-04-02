// Scraper para Frias Neto (friasneto.com.br)
// Imobiliária local — scraper custom com Cheerio

import { BaseScraper } from './base'
import type { RawListing } from '@/types'

const BASE_URL = 'https://www.friasneto.com.br'

// Selectors mapeados a partir do HTML real do site
const SELECTORS = {
  card: '.property-item',
  id: '[data-property-id]',
  price: '.price',
  area: '.area',
  floor: '.floor',
  rooms: '.rooms',
  photo: 'img',
  agency: '.agency',
  link: 'a[href]',
}

export class FriasNetoScraper extends BaseScraper {
  name = 'frias-neto'

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

      const page = await context.newPage()
      const query = encodeURIComponent(buildingName)

      // Tenta buscar em venda e aluguel separadamente
      for (const path of [`/imoveis-venda?busca=${query}`, `/imoveis-locacao?busca=${query}`]) {
        try {
          await this.withRetry(() => page.goto(`${BASE_URL}${path}`, { timeout: 30000 }))
          await page.waitForSelector(SELECTORS.card, { timeout: 10000 }).catch(() => null)

          const html = await page.content()
          const listings = await this.parsePageHtml(html, BASE_URL)
          all.push(...listings)
        } catch (err) {
          this.logParseError('page', path, err)
        }
      }

      await context.close()
    } finally {
      await browser.close()
    }

    return all
  }

  private async parsePageHtml(html: string, baseUrl: string): Promise<RawListing[]> {
    const { load } = await import('cheerio')
    const $ = load(html)
    const results: RawListing[] = []

    $(SELECTORS.card).each((_, el) => {
      try {
        const card = $(el)
        const parsed = this.parseCard($, card, baseUrl)
        if (parsed) results.push(parsed as RawListing)
      } catch (err) {
        this.logParseError('card', $.html(el)?.slice(0, 100), err)
      }
    })

    return results
  }

  /**
   * Parseia um card de anúncio da Frias Neto.
   * Exposto para testes de integração com mock HTML (I05).
   */
  parseListingCard(html: string): Partial<RawListing> | null {
    // Cheerio é síncrono — require direto (já importado pelo Next.js bundle)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { load } = require('cheerio')
    const $ = load(html)
    const card = $(SELECTORS.card).first()
    if (!card.length) return null
    return this.parseCard($, card, BASE_URL)
  }

  private parseCard(
    $: ReturnType<typeof import('cheerio').load>,
    card: ReturnType<ReturnType<typeof import('cheerio').load>>,
    baseUrl: string
  ): Partial<RawListing> | null {
    const externalId =
      card.attr('data-property-id') ??
      card.find('[data-property-id]').attr('data-property-id')

    const priceText = card.find(SELECTORS.price).first().text().trim()
    const price = this.parsePrice(priceText)
    if (!price) return null

    const type = priceText.toLowerCase().includes('mês') || priceText.toLowerCase().includes('/mes')
      ? 'rent'
      : 'sale'

    const areaText = card.find(SELECTORS.area).first().text().trim()
    const area = this.parseArea(areaText)

    const floorText = card.find(SELECTORS.floor).first().text().trim()
    const floor = floorText ? this.parseFloor(floorText) : undefined

    const roomsText = card.find(SELECTORS.rooms).first().text().trim()
    const bedrooms = this.parseBedrooms(roomsText)

    const photoUrl = card.find(SELECTORS.photo).first().attr('src')

    const agencyName = card.find(SELECTORS.agency).first().text().trim() || 'Frias Neto Imóveis'

    const linkHref = card.find(SELECTORS.link).first().attr('href') ?? ''
    const externalUrl = linkHref.startsWith('http') ? linkHref : `${baseUrl}${linkHref}`

    if (!externalId && !externalUrl) return null

    return {
      externalId: externalId ?? externalUrl,
      externalUrl,
      platform: this.name,
      type,
      price,
      floor,
      area,
      bedrooms,
      furnished: 'unknown',
      description: '',
      agencyName,
      photoUrls: photoUrl ? [photoUrl] : [],
    }
  }

  /**
   * M02: visita a página de detalhe para extrair fotos do carrossel.
   * R06: em caso de falha retorna {} — listing não é bloqueado.
   */
  async fetchDetail(url: string): Promise<Partial<RawListing>> {
    const { chromium } = await import('playwright')
    const browser = await chromium.launch({ headless: true })
    try {
      const context = await browser.newContext({
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        locale: 'pt-BR',
      })
      const page = await context.newPage()
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })

      const photoUrls = await page.evaluate(() => {
        const candidates = [
          '[class*="carousel"] img',
          '[class*="gallery"] img',
          '[class*="slider"] img',
          '[class*="fotos"] img',
          '.photo-carousel img',
        ]
        for (const sel of candidates) {
          const imgs = document.querySelectorAll(sel)
          if (imgs.length > 1) {
            return Array.from(imgs)
              .map((img) => img.getAttribute('src') ?? img.getAttribute('data-src') ?? '')
              .filter(Boolean)
          }
        }
        return []
      })

      await context.close()
      return photoUrls.length > 0 ? { photoUrls: (photoUrls as string[]).slice(0, 10) } : {}
    } catch (err) {
      console.warn('[frias-neto] fetchDetail falhou:', err)
      return {}
    } finally {
      await browser.close()
    }
  }

  private parsePrice(text: string): number | null {
    const cleaned = text.replace(/[R$\s.]/g, '').replace(',', '.')
    const match = cleaned.match(/(\d+(?:\.\d+)?)/)
    if (!match) return null
    const value = parseFloat(match[1])
    return isNaN(value) || value <= 0 ? null : value
  }

  private parseArea(text: string): number | undefined {
    const match = text.match(/(\d+(?:[.,]\d+)?)\s*m/i)
    if (!match) return undefined
    return parseFloat(match[1].replace(',', '.'))
  }

  private parseBedrooms(text: string): number | undefined {
    const match = text.match(/(\d+)\s*(?:dorm|quarto|dormit)/i)
    if (!match) return undefined
    return parseInt(match[1], 10)
  }
}

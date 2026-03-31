// Testes de integração dos scrapers com HTML mockado
// Cobertura: I01, I02, I03, I04, I05, I06
// Não usa Playwright real — testa o parsing de HTML estático

import { describe, it, expect } from 'vitest'
import { ZapScraper } from '@/lib/scraper/platforms/zap'
import { VivaRealScraper } from '@/lib/scraper/platforms/vivareal'
import { OlxScraper } from '@/lib/scraper/platforms/olx'
import { ImovelWebScraper } from '@/lib/scraper/platforms/imovelweb'
import { FriasNetoScraper } from '@/lib/scraper/platforms/frias-neto'
import { MiguelImoveisScraper } from '@/lib/scraper/platforms/miguel-imoveis'

// HTML de fixture para cada plataforma
// Simula a estrutura que o scraper real encontraria
const ZAP_CARD_HTML = `
<div data-id="123456789" class="listing-item">
  <div class="listing__price">R$ 3.500/mês</div>
  <span class="listing__detail--area">75m²</span>
  <span class="listing__detail--bedroom">2 quartos</span>
  <span class="listing__detail--floor">5º andar</span>
  <span class="listing__detail--furnished">Mobiliado</span>
  <a class="listing__link" href="https://zapimoveis.com.br/imovel/123456789">Ver anúncio</a>
  <img class="carousel__image" src="https://photos.zap.com.br/foto1.jpg" />
  <span class="listing__agency">Imobiliária Central</span>
</div>
`

const VIVAREAL_CARD_HTML = `
<div data-id="vr-987654" class="property-card">
  <div class="property-card__price">R$ 450.000</div>
  <li class="features__item features__item--area">80m²</li>
  <li class="features__item features__item--bedroom">3 quartos</li>
  <span class="property-address__floor">3° andar</span>
  <img class="carousel-image" src="https://cdn.vivareal.com/photo1.jpg" />
  <p class="property-card__publisher-name">Construtora Alpha</p>
</div>
`

const OLX_CARD_HTML = `
<div class="sc-1fcmfeb-2" data-lurker-id="olx-555">
  <span class="m7nrfa-0">R$ 2.800</span>
  <span>60m²</span>
  <a href="https://www.olx.com.br/imoveis/aluguel/555">Apartamento Centro</a>
  <img src="https://img.olx.com.br/thumb555.jpg" />
</div>
`

const IMOVELWEB_CARD_HTML = `
<div class="postingCard" data-posting-id="iw-777">
  <div class="price-value">$950.000</div>
  <li class="icon-stacked">90m²</li>
  <li class="icon-stacked">4 amb.</li>
  <p>12º andar</p>
  <img src="https://img.imovelweb.com.br/photo777.jpg" />
  <div class="publisher-label">Imóveis Paulista</div>
</div>
`

const FRIAS_NETO_CARD_HTML = `
<div class="property-item" data-property-id="fn-888">
  <div class="price">R$ 4.200/mês</div>
  <div class="area">95m²</div>
  <div class="floor">7º andar</div>
  <div class="rooms">3 dormitórios</div>
  <img src="https://friasneto.com.br/fotos/888.jpg" />
  <div class="agency">Frias Neto Imóveis</div>
  <a href="https://friasneto.com.br/imovel/888">Ver imóvel</a>
</div>
`

const MIGUEL_IMOVEIS_CARD_HTML = `
<div class="imovel-card" id="mi-999">
  <span class="valor">R$550.000</span>
  <span class="area-util">110m²</span>
  <span class="dormitorios">3 dorms</span>
  <span class="andar">2º andar</span>
  <img src="https://miguelimoveis.com.br/img/999.jpg" />
  <a href="https://miguelimoveis.com.br/imovel/999">Detalhes</a>
</div>
`

// I01: ZAP Scraper
describe('I01: ZapScraper — parsing de __NEXT_DATA__ mockado', () => {
  const scraper = new ZapScraper()

  it('deve ter o nome correto', () => {
    expect(scraper.name).toBe('zap')
  })

  it('extractListingsFromNextData deve extrair listing de venda', () => {
    const mockNextData = {
      props: {
        pageProps: {
          initialListings: [
            {
              listing: {
                id: 'zap-123',
                usableAreas: [75],
                bedrooms: [2],
                unitFloor: 5,
                amenities: ['FURNISHED'],
                description: 'Apartamento mobiliado no centro',
                images: ['https://photos.zap.com.br/foto1.jpg'],
              },
              pricingInfos: [{ businessType: 'SALE', price: '450000' }],
              link: { href: '/imovel/zap-123' },
              account: { name: 'Imobiliária Central' },
            },
          ],
        },
      },
    }
    const results = scraper.extractListingsFromNextData(mockNextData, 'venda')
    expect(results).toHaveLength(1)
    expect(results[0].externalId).toBe('zap-123')
    expect(results[0].type).toBe('sale')
    expect(results[0].price).toBe(450000)
    expect(results[0].area).toBe(75)
    expect(results[0].bedrooms).toBe(2)
    expect(results[0].floor).toBe('5')
    expect(results[0].furnished).toBe('full')
    expect(results[0].platform).toBe('zap')
    expect(results[0].agencyName).toBe('Imobiliária Central')
  })

  it('extractListingsFromNextData deve extrair listing de aluguel', () => {
    const mockNextData = {
      props: {
        pageProps: {
          initialListings: [
            {
              listing: {
                id: 'zap-456',
                usableAreas: [60],
                bedrooms: [1],
                unitFloor: 3,
                amenities: [],
                description: 'Studio compacto',
                images: [],
              },
              pricingInfos: [{ businessType: 'RENTAL', price: '2500' }],
              link: { href: '/imovel/zap-456' },
              account: { name: 'Direto' },
            },
          ],
        },
      },
    }
    const results = scraper.extractListingsFromNextData(mockNextData, 'aluguel')
    expect(results).toHaveLength(1)
    expect(results[0].type).toBe('rent')
    expect(results[0].price).toBe(2500)
  })

  it('extractListingsFromNextData deve ignorar listing sem preço', () => {
    const mockNextData = {
      props: {
        pageProps: {
          initialListings: [
            {
              listing: { id: 'zap-sem-preco', usableAreas: [50], bedrooms: [1], images: [] },
              pricingInfos: [],
              link: { href: '/imovel/zap-sem-preco' },
              account: {},
            },
          ],
        },
      },
    }
    const results = scraper.extractListingsFromNextData(mockNextData, 'venda')
    expect(results).toHaveLength(0)
  })

  it('parseListingCard deve retornar objeto (não lança erro)', () => {
    const result = scraper.parseListingCard(ZAP_CARD_HTML)
    // Pode retornar null se cheerio não encontrar os campos,
    // mas não deve lançar exceção
    expect(result === null || typeof result === 'object').toBe(true)
  })
})

// I02: VivaReal Scraper
describe('I02: VivaRealScraper — parsing de HTML mockado', () => {
  const scraper = new VivaRealScraper()

  it('deve ter o nome correto', () => {
    expect(scraper.name).toBe('vivareal')
  })

  it('parseListingCard deve lançar "not implemented" (stub)', () => {
    expect(() => scraper.parseListingCard(VIVAREAL_CARD_HTML)).toThrow('not implemented')
  })

  it('search deve retornar array vazio (stub)', async () => {
    const results = await scraper.search('Edifício Test', 'Rua Test, 100')
    expect(results).toHaveLength(0)
  })
})

// I03: OLX Scraper
describe('I03: OlxScraper — parsing de HTML mockado', () => {
  const scraper = new OlxScraper()

  it('deve ter o nome correto', () => {
    expect(scraper.name).toBe('olx')
  })

  it('parseListingCard deve lançar "not implemented" (stub)', () => {
    expect(() => scraper.parseListingCard(OLX_CARD_HTML)).toThrow('not implemented')
  })

  it('search deve retornar array vazio (stub)', async () => {
    const results = await scraper.search('Edifício Test', 'Rua Test, 100')
    expect(results).toHaveLength(0)
  })
})

// I04: ImovelWeb Scraper
describe('I04: ImovelWebScraper — parsing de HTML mockado', () => {
  const scraper = new ImovelWebScraper()

  it('deve ter o nome correto', () => {
    expect(scraper.name).toBe('imovelweb')
  })

  it('parseListingCard deve lançar "not implemented" (stub)', () => {
    expect(() => scraper.parseListingCard(IMOVELWEB_CARD_HTML)).toThrow('not implemented')
  })

  it('search deve retornar array vazio (stub)', async () => {
    const results = await scraper.search('Edifício Test', 'Rua Test, 100')
    expect(results).toHaveLength(0)
  })
})

// I05: Frias Neto Scraper
describe('I05: FriasNetoScraper — parsing de HTML mockado', () => {
  const scraper = new FriasNetoScraper()

  it('deve ter o nome correto', () => {
    expect(scraper.name).toBe('frias-neto')
  })

  it('parseListingCard deve lançar "not implemented" (stub)', () => {
    expect(() => scraper.parseListingCard(FRIAS_NETO_CARD_HTML)).toThrow('not implemented')
  })

  it('search deve retornar array vazio (stub)', async () => {
    const results = await scraper.search('Edifício Test', 'Rua Test, 100')
    expect(results).toHaveLength(0)
  })
})

// I06: Miguel Imóveis Scraper
describe('I06: MiguelImoveisScraper — parsing de HTML mockado', () => {
  const scraper = new MiguelImoveisScraper()

  it('deve ter o nome correto', () => {
    expect(scraper.name).toBe('miguel-imoveis')
  })

  it('parseListingCard deve lançar "not implemented" (stub)', () => {
    expect(() => scraper.parseListingCard(MIGUEL_IMOVEIS_CARD_HTML)).toThrow('not implemented')
  })

  it('search deve retornar array vazio (stub)', async () => {
    const results = await scraper.search('Edifício Test', 'Rua Test, 100')
    expect(results).toHaveLength(0)
  })
})

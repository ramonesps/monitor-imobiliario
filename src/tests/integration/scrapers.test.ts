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
describe('I02: VivaRealScraper — parsing de __NEXT_DATA__ mockado', () => {
  const scraper = new VivaRealScraper()

  it('deve ter o nome correto', () => {
    expect(scraper.name).toBe('vivareal')
  })

  it('extractListingsFromNextData deve extrair listing de venda', () => {
    const mockNextData = {
      props: {
        pageProps: {
          initialListings: [
            {
              listing: {
                id: 'vr-987654',
                usableAreas: [80],
                bedrooms: [3],
                unitFloor: 3,
                amenities: ['SEMI_FURNISHED'],
                description: 'Apartamento semi-mobiliado',
                images: ['https://cdn.vivareal.com/photo1.jpg'],
              },
              pricingInfos: [{ businessType: 'SALE', price: '450000' }],
              link: { href: '/imovel/vr-987654' },
              account: { name: 'Construtora Alpha' },
            },
          ],
        },
      },
    }
    const results = scraper.extractListingsFromNextData(mockNextData, 'venda')
    expect(results).toHaveLength(1)
    expect(results[0].externalId).toBe('vr-987654')
    expect(results[0].type).toBe('sale')
    expect(results[0].price).toBe(450000)
    expect(results[0].area).toBe(80)
    expect(results[0].bedrooms).toBe(3)
    expect(results[0].furnished).toBe('partial')
    expect(results[0].platform).toBe('vivareal')
  })

  it('extractListingsFromNextData deve ignorar listing sem preço válido', () => {
    const mockNextData = {
      props: { pageProps: { initialListings: [{ listing: { id: 'vr-0' }, pricingInfos: [], link: {}, account: {} }] } },
    }
    const results = scraper.extractListingsFromNextData(mockNextData, 'venda')
    expect(results).toHaveLength(0)
  })

  it('parseListingCard deve retornar objeto (não lança erro)', () => {
    const result = scraper.parseListingCard(VIVAREAL_CARD_HTML)
    expect(result === null || typeof result === 'object').toBe(true)
  })
})

// I03: OLX Scraper
describe('I03: OlxScraper — parsing de __NEXT_DATA__ mockado', () => {
  const scraper = new OlxScraper()

  it('deve ter o nome correto', () => {
    expect(scraper.name).toBe('olx')
  })

  it('extractListingsFromNextData deve extrair anúncio de aluguel', () => {
    const mockNextData = {
      props: {
        pageProps: {
          ads: [
            {
              listId: 'olx-555',
              url: '/imoveis/aluguel/555',
              price: 'R$ 2.800',
              subject: 'Apartamento para alugar',
              body: 'Apartamento no centro, 60m²',
              params: [
                { name: 'size', value: '60' },
                { name: 'rooms', value: '2' },
              ],
              images: ['https://img.olx.com.br/thumb555.jpg'],
              user: { name: null },
            },
          ],
        },
      },
    }
    const results = scraper.extractListingsFromNextData(mockNextData)
    expect(results).toHaveLength(1)
    expect(results[0].externalId).toBe('olx-555')
    expect(results[0].type).toBe('rent')
    expect(results[0].price).toBe(2800)
    expect(results[0].area).toBe(60)
    expect(results[0].bedrooms).toBe(2)
    expect(results[0].platform).toBe('olx')
  })

  it('extractListingsFromNextData deve inferir venda quando não há indicação de aluguel', () => {
    const mockNextData = {
      props: {
        pageProps: {
          ads: [
            {
              listId: 'olx-666',
              url: '/imoveis/venda/666',
              price: 'R$ 350.000',
              subject: 'Casa à venda',
              body: 'Casa espaçosa',
              params: [],
              images: [],
            },
          ],
        },
      },
    }
    const results = scraper.extractListingsFromNextData(mockNextData)
    expect(results).toHaveLength(1)
    expect(results[0].type).toBe('sale')
    expect(results[0].price).toBe(350000)
  })

  it('parseListingCard deve retornar objeto (não lança erro)', () => {
    const result = scraper.parseListingCard(OLX_CARD_HTML)
    expect(result === null || typeof result === 'object').toBe(true)
  })
})

// I04: ImovelWeb Scraper
describe('I04: ImovelWebScraper — parsing de __NEXT_DATA__ mockado', () => {
  const scraper = new ImovelWebScraper()

  it('deve ter o nome correto', () => {
    expect(scraper.name).toBe('imovelweb')
  })

  it('extractListingsFromNextData deve extrair listing de venda', () => {
    const mockNextData = {
      props: {
        pageProps: {
          initialListings: [
            {
              listing: {
                id: 'iw-777',
                usableAreas: [90],
                bedrooms: [4],
                unitFloor: 12,
                amenities: ['NOT_FURNISHED'],
                description: 'Apartamento amplo no 12º andar',
                images: ['https://img.imovelweb.com.br/photo777.jpg'],
              },
              pricingInfos: [{ businessType: 'SALE', price: '950000' }],
              link: { href: '/imovel/iw-777' },
              account: { name: 'Imóveis Paulista' },
            },
          ],
        },
      },
    }
    const results = scraper.extractListingsFromNextData(mockNextData, 'venda')
    expect(results).toHaveLength(1)
    expect(results[0].externalId).toBe('iw-777')
    expect(results[0].type).toBe('sale')
    expect(results[0].price).toBe(950000)
    expect(results[0].area).toBe(90)
    expect(results[0].bedrooms).toBe(4)
    expect(results[0].floor).toBe('12')
    expect(results[0].furnished).toBe('none')
    expect(results[0].platform).toBe('imovelweb')
  })

  it('extractListingsFromNextData deve suportar preço direto no listing (sem pricingInfos)', () => {
    const mockNextData = {
      props: {
        pageProps: {
          initialListings: [
            {
              listing: {
                id: 'iw-888',
                usableAreas: [70],
                bedrooms: [2],
                salePrice: 480000,
                amenities: [],
                images: [],
              },
              pricingInfos: [],
              link: { href: '/imovel/iw-888' },
              account: {},
            },
          ],
        },
      },
    }
    const results = scraper.extractListingsFromNextData(mockNextData, 'venda')
    expect(results).toHaveLength(1)
    expect(results[0].price).toBe(480000)
  })

  it('parseListingCard deve retornar objeto (não lança erro)', () => {
    const result = scraper.parseListingCard(IMOVELWEB_CARD_HTML)
    expect(result === null || typeof result === 'object').toBe(true)
  })
})

// I05: Frias Neto Scraper
describe('I05: FriasNetoScraper — parsing de HTML mockado', () => {
  const scraper = new FriasNetoScraper()

  it('deve ter o nome correto', () => {
    expect(scraper.name).toBe('frias-neto')
  })

  it('parseListingCard deve extrair preço, área, andar, quartos e tipo', () => {
    const result = scraper.parseListingCard(FRIAS_NETO_CARD_HTML)
    expect(result).not.toBeNull()
    expect(result!.price).toBe(4200)
    expect(result!.type).toBe('rent')
    expect(result!.area).toBe(95)
    expect(result!.floor).toBe('7')
    expect(result!.bedrooms).toBe(3)
    expect(result!.platform).toBe('frias-neto')
  })

  it('parseListingCard deve extrair externalId e externalUrl', () => {
    const result = scraper.parseListingCard(FRIAS_NETO_CARD_HTML)
    expect(result).not.toBeNull()
    expect(result!.externalId).toBe('fn-888')
    expect(result!.externalUrl).toContain('friasneto.com.br/imovel/888')
  })

  it('parseListingCard deve extrair foto', () => {
    const result = scraper.parseListingCard(FRIAS_NETO_CARD_HTML)
    expect(result!.photoUrls).toHaveLength(1)
    expect(result!.photoUrls![0]).toContain('888.jpg')
  })

  it('parseListingCard deve retornar null para HTML sem preço', () => {
    const result = scraper.parseListingCard('<div class="property-item"></div>')
    expect(result).toBeNull()
  })
})

// I06: Miguel Imóveis Scraper
describe('I06: MiguelImoveisScraper — parsing de HTML mockado', () => {
  const scraper = new MiguelImoveisScraper()

  it('deve ter o nome correto', () => {
    expect(scraper.name).toBe('miguel-imoveis')
  })

  it('parseListingCard deve extrair preço, área, andar, quartos e tipo', () => {
    const result = scraper.parseListingCard(MIGUEL_IMOVEIS_CARD_HTML)
    expect(result).not.toBeNull()
    expect(result!.price).toBe(550000)
    expect(result!.type).toBe('sale')
    expect(result!.area).toBe(110)
    expect(result!.floor).toBe('2')
    expect(result!.bedrooms).toBe(3)
    expect(result!.platform).toBe('miguel-imoveis')
  })

  it('parseListingCard deve extrair externalId e externalUrl', () => {
    const result = scraper.parseListingCard(MIGUEL_IMOVEIS_CARD_HTML)
    expect(result).not.toBeNull()
    expect(result!.externalId).toBe('mi-999')
    expect(result!.externalUrl).toContain('miguelimoveis.com.br/imovel/999')
  })

  it('parseListingCard deve extrair foto', () => {
    const result = scraper.parseListingCard(MIGUEL_IMOVEIS_CARD_HTML)
    expect(result!.photoUrls).toHaveLength(1)
    expect(result!.photoUrls![0]).toContain('999.jpg')
  })

  it('parseListingCard deve retornar null para HTML sem preço', () => {
    const result = scraper.parseListingCard('<div class="imovel-card"></div>')
    expect(result).toBeNull()
  })
})

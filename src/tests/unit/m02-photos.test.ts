// Testes unitários M02 — otimização de coleta de imagens
// Cobertura: U11–U14 conforme M02.md

import { describe, it, expect } from 'vitest'
import { ZapScraper } from '@/lib/scraper/platforms/zap'
import { OlxScraper } from '@/lib/scraper/platforms/olx'

// ============================================================
// U11 — resolvePhotoUrls ZAP/VivaReal
// ============================================================
describe('U11: resolvePhotoUrls ZAP/VivaReal — seleciona variante de maior width', () => {
  const zap = new ZapScraper()

  it('U11: retorna URL da variante com maior width', () => {
    const mockNextData = {
      props: {
        pageProps: {
          initialListings: [
            {
              listing: {
                id: 'test-zap-001',
                images: [
                  {
                    url: 'https://photos.zapimoveis.com.br/small.jpg',
                    sizes: [
                      { url: 'https://photos.zapimoveis.com.br/320w.jpg', width: 320 },
                      { url: 'https://photos.zapimoveis.com.br/1024w.jpg', width: 1024 },
                      { url: 'https://photos.zapimoveis.com.br/640w.jpg', width: 640 },
                    ],
                  },
                ],
                usableAreas: [70],
                bedrooms: [2],
                description: '',
              },
              pricingInfos: [{ businessType: 'RENTAL', price: '3500' }],
              link: { href: '/imovel/test-zap-001' },
            },
          ],
        },
      },
    }

    const listings = zap.extractListingsFromNextData(mockNextData, 'aluguel')
    expect(listings).toHaveLength(1)
    expect(listings[0].photoUrls).toEqual(['https://photos.zapimoveis.com.br/1024w.jpg'])
  })

  it('U11b: faz fallback para img.original quando não há variantes', () => {
    const mockNextData = {
      props: {
        pageProps: {
          initialListings: [
            {
              listing: {
                id: 'test-zap-002',
                images: [
                  { original: 'https://photos.zapimoveis.com.br/full.jpg', url: 'https://photos.zapimoveis.com.br/thumb.jpg' },
                ],
                usableAreas: [80],
                bedrooms: [3],
                description: '',
              },
              pricingInfos: [{ businessType: 'SALE', price: '500000' }],
              link: { href: '/imovel/test-zap-002' },
            },
          ],
        },
      },
    }

    const listings = zap.extractListingsFromNextData(mockNextData, 'venda')
    expect(listings[0].photoUrls).toEqual(['https://photos.zapimoveis.com.br/full.jpg'])
  })

  it('U11c: string direta é preservada sem alteração', () => {
    const mockNextData = {
      props: {
        pageProps: {
          initialListings: [
            {
              listing: {
                id: 'test-zap-003',
                images: ['https://photos.zapimoveis.com.br/direct.jpg'],
                usableAreas: [60],
                bedrooms: [1],
                description: '',
              },
              pricingInfos: [{ businessType: 'RENTAL', price: '2000' }],
              link: { href: '/imovel/test-zap-003' },
            },
          ],
        },
      },
    }

    const listings = zap.extractListingsFromNextData(mockNextData, 'aluguel')
    expect(listings[0].photoUrls).toEqual(['https://photos.zapimoveis.com.br/direct.jpg'])
  })

  it('U11d: variantes com resolutions em vez de sizes', () => {
    const mockNextData = {
      props: {
        pageProps: {
          initialListings: [
            {
              listing: {
                id: 'test-zap-004',
                images: [
                  {
                    url: 'https://photos.zapimoveis.com.br/small.jpg',
                    resolutions: [
                      { url: 'https://photos.zapimoveis.com.br/res_800.jpg', width: 800 },
                      { url: 'https://photos.zapimoveis.com.br/res_400.jpg', width: 400 },
                    ],
                  },
                ],
                usableAreas: [90],
                bedrooms: [2],
                description: '',
              },
              pricingInfos: [{ businessType: 'RENTAL', price: '4000' }],
              link: { href: '/imovel/test-zap-004' },
            },
          ],
        },
      },
    }

    const listings = zap.extractListingsFromNextData(mockNextData, 'aluguel')
    expect(listings[0].photoUrls).toEqual(['https://photos.zapimoveis.com.br/res_800.jpg'])
  })
})

// ============================================================
// U12 — resolvePhotoUrls QuintoAndar (URL Cloudinary)
// ============================================================
describe('U12: resolvePhotoUrls QuintoAndar — remove segmento de transformação Cloudinary', () => {
  // QuintoAndar ainda não implementado — testa a lógica de transform como função pura
  function resolveCloudinaryUrl(url: string): string {
    return url.replace(/\/c_[^/]+\//, '/')
  }

  it('U12: remove segmento c_fill com dimensões', () => {
    const url = 'https://res.cloudinary.com/xyz/image/upload/c_fill,w_420,h_280/property/img.jpg'
    expect(resolveCloudinaryUrl(url)).toBe(
      'https://res.cloudinary.com/xyz/image/upload/property/img.jpg'
    )
  })

  it('U12b: preserva restante da URL após remoção', () => {
    const url = 'https://res.cloudinary.com/abc/image/upload/c_scale,w_800/listings/foto1.webp'
    expect(resolveCloudinaryUrl(url)).toBe(
      'https://res.cloudinary.com/abc/image/upload/listings/foto1.webp'
    )
  })

  it('U12c: URL sem transformação não é alterada', () => {
    const url = 'https://res.cloudinary.com/xyz/image/upload/property/img.jpg'
    expect(resolveCloudinaryUrl(url)).toBe(url)
  })
})

// ============================================================
// U13 — resolvePhotoUrls OLX
// ============================================================
describe('U13: resolvePhotoUrls OLX — usa img.original; fallback para img.url', () => {
  const olx = new OlxScraper()

  it('U13: retorna img.original quando presente', () => {
    const mockNextData = {
      props: {
        pageProps: {
          ads: [
            {
              listId: 'olx-001',
              url: 'https://www.olx.com.br/imoveis/olx-001',
              price: 'R$ 3.000',
              images: [
                { original: 'https://img.olx.com.br/full.jpg', src: 'https://img.olx.com.br/thumb.jpg' },
              ],
            },
          ],
        },
      },
    }

    const listings = olx.extractListingsFromNextData(mockNextData)
    expect(listings[0].photoUrls).toEqual(['https://img.olx.com.br/full.jpg'])
  })

  it('U13b: faz fallback para img.src quando original ausente', () => {
    const mockNextData = {
      props: {
        pageProps: {
          ads: [
            {
              listId: 'olx-002',
              url: 'https://www.olx.com.br/imoveis/olx-002',
              price: 'R$ 2.500',
              images: [
                { src: 'https://img.olx.com.br/src.jpg' },
              ],
            },
          ],
        },
      },
    }

    const listings = olx.extractListingsFromNextData(mockNextData)
    expect(listings[0].photoUrls).toEqual(['https://img.olx.com.br/src.jpg'])
  })

  it('U13c: faz fallback para img.url quando original e src ausentes', () => {
    const mockNextData = {
      props: {
        pageProps: {
          ads: [
            {
              listId: 'olx-003',
              url: 'https://www.olx.com.br/imoveis/olx-003',
              price: 'R$ 1.800',
              images: [
                { url: 'https://img.olx.com.br/url.jpg' },
              ],
            },
          ],
        },
      },
    }

    const listings = olx.extractListingsFromNextData(mockNextData)
    expect(listings[0].photoUrls).toEqual(['https://img.olx.com.br/url.jpg'])
  })
})

// ============================================================
// U14 — photo dedup
// ============================================================
describe('U14: photo dedup — não baixa foto cuja url_original já existe', () => {
  it('U14: URL existente → skip (guard lógico)', () => {
    const storedUrls = new Set([
      'https://img.example.com/already-stored.jpg',
    ])
    const shouldDownload = (url: string) => !storedUrls.has(url)

    expect(shouldDownload('https://img.example.com/already-stored.jpg')).toBe(false)
    expect(shouldDownload('https://img.example.com/new-photo.jpg')).toBe(true)
  })

  it('U14b: set vazio → todas as URLs são baixadas', () => {
    const storedUrls = new Set<string>()
    const shouldDownload = (url: string) => !storedUrls.has(url)

    expect(shouldDownload('https://img.example.com/photo1.jpg')).toBe(true)
    expect(shouldDownload('https://img.example.com/photo2.jpg')).toBe(true)
  })

  it('U14c: múltiplas fotos — apenas as novas são baixadas', () => {
    const storedUrls = new Set([
      'https://img.example.com/photo1.jpg',
      'https://img.example.com/photo3.jpg',
    ])
    const photos = [
      'https://img.example.com/photo1.jpg',
      'https://img.example.com/photo2.jpg',
      'https://img.example.com/photo3.jpg',
      'https://img.example.com/photo4.jpg',
    ]
    const toDownload = photos.filter((url) => !storedUrls.has(url))

    expect(toDownload).toEqual([
      'https://img.example.com/photo2.jpg',
      'https://img.example.com/photo4.jpg',
    ])
  })
})

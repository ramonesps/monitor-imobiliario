// Página de detalhe do imóvel
export const dynamic = 'force-dynamic'
// Galeria de fotos, dados, histórico de preço, fontes

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Calendar, Clock, ExternalLink, Home, MapPin } from 'lucide-react'
import { eq } from 'drizzle-orm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PriceChart } from '@/components/price-chart'
import db from '@/lib/db'
import { listings, listingSources, priceHistory, buildings, listingPhotos } from '@/lib/db/schema'
import { localPathToUrl } from '@/lib/scraper/photo-downloader'

type Params = { params: { id: string } }

function formatPrice(price: number) {
  return price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR')
}

function furnishedLabel(val: string) {
  return val === 'full' ? 'Mobiliado' : val === 'partial' ? 'Semi-mobiliado' : val === 'none' ? 'Sem mobília' : 'Não informado'
}

function platformLabel(p: string) {
  const map: Record<string, string> = {
    zap: 'ZAP Imóveis',
    vivareal: 'VivaReal',
    olx: 'OLX',
    imovelweb: 'ImovelWeb',
    'frias-neto': 'Frias Neto',
    'miguel-imoveis': 'Miguel Imóveis',
  }
  return map[p] ?? p
}

async function getListingDetail(id: string) {
  const [listing] = await db.select().from(listings).where(eq(listings.id, id))
  if (!listing) return null

  const [[building], sources, history, photos] = await Promise.all([
    db.select().from(buildings).where(eq(buildings.id, listing.buildingId)),
    db.select().from(listingSources).where(eq(listingSources.listingId, id)),
    db.select().from(priceHistory).where(eq(priceHistory.listingId, id)).orderBy(priceHistory.recordedAt),
    db.select().from(listingPhotos).where(eq(listingPhotos.listingId, id)).orderBy(listingPhotos.orderIndex),
  ])

  return { listing, building, sources, history, photos }
}

export default async function ListingPage({ params }: Params) {
  const detail = await getListingDetail(params.id)
  if (!detail) notFound()

  const { listing, building, sources, history, photos } = detail
  const priceChanged = listing.priceCurrent !== listing.priceOriginal

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-10">
        {/* Breadcrumb */}
        <div className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/" className="hover:text-foreground transition-colors">Prédios</Link>
          <span>/</span>
          {building && (
            <>
              <Link
                href={`/buildings/${building.id}`}
                className="hover:text-foreground transition-colors"
              >
                {building.name}
              </Link>
              <span>/</span>
            </>
          )}
          <span className="text-foreground">Imóvel</span>
        </div>

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <Badge variant={listing.type === 'rent' ? 'rent' : 'sale'}>
                {listing.type === 'rent' ? 'Aluguel' : 'Venda'}
              </Badge>
              {listing.status === 'inactive' && <Badge variant="inactive">Inativo</Badge>}
            </div>
            <h1 className="text-2xl font-bold tracking-tight mt-1">
              {formatPrice(listing.priceCurrent)}
              {listing.type === 'rent' && (
                <span className="text-sm font-normal text-muted-foreground">/mês</span>
              )}
            </h1>
            {priceChanged && (
              <p className="text-sm text-muted-foreground line-through">
                {formatPrice(listing.priceOriginal)}
              </p>
            )}
          </div>
          {building && (
            <Link
              href={`/buildings/${building.id}`}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              {building.name}
            </Link>
          )}
        </div>

        {/* Galeria de fotos */}
        {photos.length > 0 && (
          <div className="mb-6 space-y-2">
            {/* Foto principal */}
            <a href={photos[0].urlOriginal} target="_blank" rel="noopener noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photos[0].localPath ? localPathToUrl(photos[0].localPath) : photos[0].urlOriginal}
                alt="Foto principal"
                className="w-full h-64 object-cover rounded-lg"
              />
            </a>
            {/* Demais fotos */}
            {photos.length > 1 && (
              <div className="grid grid-cols-3 gap-2">
                {photos.slice(1).map((photo, i) => (
                  <a key={photo.id} href={photo.urlOriginal} target="_blank" rel="noopener noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.localPath ? localPathToUrl(photo.localPath) : photo.urlOriginal}
                      alt={`Foto ${i + 2}`}
                      className="w-full h-24 object-cover rounded-lg"
                    />
                  </a>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Dados do imóvel */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Dados do imóvel
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {listing.floor && (
                <div>
                  <p className="text-xs text-muted-foreground">Andar</p>
                  <p className="font-medium">{listing.floor}º andar</p>
                </div>
              )}
              {listing.area && (
                <div>
                  <p className="text-xs text-muted-foreground">Área</p>
                  <p className="font-medium">{listing.area} m²</p>
                </div>
              )}
              {listing.bedrooms && (
                <div>
                  <p className="text-xs text-muted-foreground">Quartos</p>
                  <p className="font-medium">{listing.bedrooms}</p>
                </div>
              )}
              {listing.bathrooms && (
                <div>
                  <p className="text-xs text-muted-foreground">Banheiros</p>
                  <p className="font-medium">{listing.bathrooms}</p>
                </div>
              )}
              {listing.garages && (
                <div>
                  <p className="text-xs text-muted-foreground">Vagas</p>
                  <p className="font-medium">{listing.garages}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground">Mobília</p>
                <p className="font-medium">{furnishedLabel(listing.furnished)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Visto pela 1ª vez</p>
                <p className="font-medium">{formatDate(listing.firstSeenAt)}</p>
              </div>
              {listing.status === 'inactive' && listing.daysOnMarket !== null && (
                <div>
                  <p className="text-xs text-muted-foreground">Dias no mercado</p>
                  <p className="font-medium">{listing.daysOnMarket} dias</p>
                </div>
              )}
            </div>
            {listing.description && (
              <p className="mt-4 text-sm text-muted-foreground border-t pt-3">
                {listing.description}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Histórico de preço */}
        <Card className="mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Histórico de preço
            </CardTitle>
          </CardHeader>
          <CardContent>
            {history.length > 0 ? (
              <>
                <PriceChart data={history.map((h) => ({ price: h.price, recordedAt: h.recordedAt }))} />
                <div className="mt-3 space-y-1 max-h-40 overflow-y-auto">
                  {[...history].reverse().map((h) => (
                    <div key={h.id} className="flex justify-between text-xs text-muted-foreground">
                      <span>{formatDate(h.recordedAt)}</span>
                      <span className="font-medium text-foreground">{formatPrice(h.price)}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Preço estável desde o primeiro anúncio ({formatDate(listing.firstSeenAt)})
              </p>
            )}
          </CardContent>
        </Card>

        {/* Fontes */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Fontes ({sources.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {sources.map((src) => (
                <div key={src.id} className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-sm">{platformLabel(src.platform)}</p>
                    {src.agencyName && (
                      <p className="text-xs text-muted-foreground">{src.agencyName}</p>
                    )}
                    {src.advertiserName && src.advertiserName !== src.agencyName && (
                      <p className="text-xs text-muted-foreground">Anunciante: {src.advertiserName}</p>
                    )}
                    {src.listedAt && (
                      <p className="text-xs text-muted-foreground">
                        Publicado em: {formatDate(src.listedAt)}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Visto: {formatDate(src.firstSeenAt)} → {formatDate(src.lastSeenAt)}
                    </p>
                  </div>
                  <a
                    href={src.externalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                  >
                    Ver anúncio
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

// Página de revisão de duplicatas
// Exibe pares de listings suspeitos lado a lado para revisão manual

import Link from 'next/link'
import { ArrowLeft, CheckCircle2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ReviewActions } from '@/components/review-actions'

interface ListingSource {
  id: string
  platform: string
  agencyName: string | null
  externalUrl: string
  externalId: string
}

interface ListingDetail {
  id: string
  type: string
  floor: string | null
  area: number | null
  bedrooms: number | null
  priceCurrent: number
  priceOriginal: number
  furnished: string
  description: string
  status: string
  sources: ListingSource[]
}

interface ReviewItem {
  id: string
  similarityScore: number
  createdAt: string
  listingA: ListingDetail | null
  listingB: ListingDetail | null
}

async function getPendingReviews(): Promise<ReviewItem[]> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'
  const res = await fetch(`${baseUrl}/api/duplicate-reviews`, { cache: 'no-store' })
  if (!res.ok) return []
  const data = await res.json()
  return data.reviews ?? []
}

function formatPrice(price: number) {
  return price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

function furnishedLabel(val: string) {
  return val === 'full' ? 'Mobiliado' : val === 'partial' ? 'Semi-mob.' : val === 'none' ? 'Sem mobília' : '—'
}

function platformLabel(p: string) {
  const map: Record<string, string> = {
    zap: 'ZAP',
    vivareal: 'VivaReal',
    olx: 'OLX',
    imovelweb: 'ImovelWeb',
    'frias-neto': 'Frias Neto',
    'miguel-imoveis': 'Miguel Imóveis',
  }
  return map[p] ?? p
}

function ListingCard({ listing }: { listing: ListingDetail }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant={listing.type === 'rent' ? 'rent' : 'sale'}>
          {listing.type === 'rent' ? 'Aluguel' : 'Venda'}
        </Badge>
        {listing.status === 'inactive' && <Badge variant="inactive">Inativo</Badge>}
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <span className="text-muted-foreground">Preço</span>
        <span className="font-semibold">{formatPrice(listing.priceCurrent)}</span>

        <span className="text-muted-foreground">Andar</span>
        <span>{listing.floor ? `${listing.floor}º` : '—'}</span>

        <span className="text-muted-foreground">Área</span>
        <span>{listing.area ? `${listing.area} m²` : '—'}</span>

        <span className="text-muted-foreground">Quartos</span>
        <span>{listing.bedrooms ?? '—'}</span>

        <span className="text-muted-foreground">Mobília</span>
        <span>{furnishedLabel(listing.furnished)}</span>
      </div>

      {listing.description && (
        <p className="text-xs text-muted-foreground line-clamp-2">{listing.description}</p>
      )}

      <div className="space-y-1">
        {listing.sources.map((src) => (
          <a
            key={src.id}
            href={src.externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline"
          >
            <span className="font-medium">{platformLabel(src.platform)}</span>
            {src.agencyName && <span className="text-muted-foreground">· {src.agencyName}</span>}
          </a>
        ))}
      </div>
    </div>
  )
}

export default async function ReviewsPage() {
  const reviews = await getPendingReviews()

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-10">
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Todos os prédios
          </Link>
        </div>

        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight">Revisão de duplicatas</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {reviews.length > 0
              ? `${reviews.length} par${reviews.length > 1 ? 'es' : ''} aguardando revisão`
              : 'Nenhuma revisão pendente'}
          </p>
        </div>

        {reviews.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
            <CheckCircle2 className="h-12 w-12 text-green-500" />
            <p className="text-sm">Todas as duplicatas foram revisadas.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {reviews.map((review) => (
              <Card key={review.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Similaridade:{' '}
                      <span
                        className={
                          review.similarityScore >= 80
                            ? 'text-yellow-600 font-bold'
                            : 'text-orange-600 font-bold'
                        }
                      >
                        {Math.round(review.similarityScore)}%
                      </span>
                    </CardTitle>
                    <span className="text-xs text-muted-foreground">
                      {new Date(review.createdAt).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                        Anúncio A
                      </p>
                      {review.listingA ? (
                        <ListingCard listing={review.listingA} />
                      ) : (
                        <p className="text-sm text-muted-foreground">Não encontrado</p>
                      )}
                    </div>

                    <div className="md:border-l md:pl-6">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                        Anúncio B
                      </p>
                      {review.listingB ? (
                        <ListingCard listing={review.listingB} />
                      ) : (
                        <p className="text-sm text-muted-foreground">Não encontrado</p>
                      )}
                    </div>
                  </div>

                  <ReviewActions reviewId={review.id} />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}

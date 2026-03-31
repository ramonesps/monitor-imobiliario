// Página do prédio: stats + lista de imóveis
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, RefreshCw, Home, TrendingUp, Clock, AlertTriangle } from 'lucide-react'
import { eq, and, sql } from 'drizzle-orm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import db from '@/lib/db'
import { buildings, listings, duplicateReviews } from '@/lib/db/schema'

type Params = { params: { id: string } }

async function getBuilding(id: string) {
  const [building] = await db.select().from(buildings).where(eq(buildings.id, id))
  if (!building) return null
  return {
    ...building,
    searchTerms: building.searchTerms ? (JSON.parse(building.searchTerms) as string[]) : [],
  }
}

async function getBuildingListings(buildingId: string) {
  return db.select().from(listings).where(eq(listings.buildingId, buildingId))
}

async function getPendingDuplicates(buildingId: string) {
  // Conta duplicatas pendentes que envolvem listings deste prédio
  const buildingListings = await db
    .select({ id: listings.id })
    .from(listings)
    .where(eq(listings.buildingId, buildingId))

  const ids = buildingListings.map((l) => l.id)
  if (ids.length === 0) return 0

  const pending = await db
    .select()
    .from(duplicateReviews)
    .where(eq(duplicateReviews.status, 'pending'))

  return pending.filter(
    (d) => ids.includes(d.listingAId) || ids.includes(d.listingBId)
  ).length
}

function formatPrice(price: number) {
  return price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

function avgOrNull(values: number[]) {
  if (values.length === 0) return null
  return values.reduce((a, b) => a + b, 0) / values.length
}

export default async function BuildingPage({ params }: Params) {
  const building = await getBuilding(params.id)
  if (!building) notFound()

  const allListings = await getBuildingListings(params.id)
  const pendingDuplicates = await getPendingDuplicates(params.id)

  const active = allListings.filter((l) => l.status === 'active')
  const inactive = allListings.filter((l) => l.status === 'inactive')
  const rentListings = active.filter((l) => l.type === 'rent')
  const saleListings = active.filter((l) => l.type === 'sale')

  const avgRent = avgOrNull(rentListings.map((l) => l.priceCurrent))
  const avgSalePerSqm = avgOrNull(
    saleListings.filter((l) => l.area && l.area > 0).map((l) => l.priceCurrent / l.area!)
  )
  const daysOnMarket = inactive.filter((l) => l.daysOnMarket !== null).map((l) => l.daysOnMarket!)
  const avgDays = avgOrNull(daysOnMarket)

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-10">
        {/* Breadcrumb */}
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Todos os prédios
          </Link>
        </div>

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{building.name}</h1>
            <p className="text-muted-foreground text-sm mt-0.5">{building.address}</p>
            {building.searchTerms.length > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                Busca: {building.searchTerms.join(', ')}
              </p>
            )}
          </div>
          <form action={`/api/scraper/run`} method="POST">
            <input type="hidden" name="buildingId" value={building.id} />
            <Button variant="outline" size="sm" type="submit">
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar agora
            </Button>
          </form>
        </div>

        {/* Alerta de duplicatas */}
        {pendingDuplicates > 0 && (
          <Link href="/reviews">
            <div className="mb-6 flex items-center gap-3 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-yellow-800 hover:bg-yellow-100 transition-colors">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <span className="text-sm font-medium">
                {pendingDuplicates} duplicata{pendingDuplicates > 1 ? 's' : ''} pendente
                {pendingDuplicates > 1 ? 's' : ''} de revisão
              </span>
            </div>
          </Link>
        )}

        {/* Stats cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Anúncios ativos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-1">
                <span className="text-3xl font-bold">{active.length}</span>
                <Home className="h-5 w-5 text-muted-foreground mb-1" />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {rentListings.length} aluguel · {saleListings.length} venda
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Aluguel médio
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold">
                {avgRent ? formatPrice(avgRent) : '—'}
              </span>
              <p className="text-xs text-muted-foreground mt-1">
                {rentListings.length} anúncio{rentListings.length !== 1 ? 's' : ''}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Venda média/m²
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold">
                {avgSalePerSqm ? formatPrice(avgSalePerSqm) : '—'}
              </span>
              <p className="text-xs text-muted-foreground mt-1">
                {saleListings.length} anúncio{saleListings.length !== 1 ? 's' : ''}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Tempo médio no mercado
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-1">
                <span className="text-3xl font-bold">
                  {avgDays ? Math.round(avgDays) : '—'}
                </span>
                {avgDays && <span className="text-sm text-muted-foreground mb-0.5">dias</span>}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {inactive.length} inativo{inactive.length !== 1 ? 's' : ''}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs de listagens */}
        <Tabs defaultValue="all">
          <TabsList className="mb-4">
            <TabsTrigger value="all">Todos ({active.length})</TabsTrigger>
            <TabsTrigger value="rent">Aluguel ({rentListings.length})</TabsTrigger>
            <TabsTrigger value="sale">Venda ({saleListings.length})</TabsTrigger>
            <TabsTrigger value="inactive">Inativos ({inactive.length})</TabsTrigger>
          </TabsList>

          {[
            { value: 'all', items: active },
            { value: 'rent', items: rentListings },
            { value: 'sale', items: saleListings },
            { value: 'inactive', items: inactive },
          ].map(({ value, items }) => (
            <TabsContent key={value} value={value}>
              {items.length === 0 ? (
                <p className="text-center text-muted-foreground py-10 text-sm">
                  Nenhum anúncio nesta categoria.
                </p>
              ) : (
                <div className="space-y-3">
                  {items.map((listing) => (
                    <Link key={listing.id} href={`/listings/${listing.id}`}>
                      <Card className="hover:shadow-md transition-shadow cursor-pointer">
                        <CardContent className="pt-4 pb-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <Badge variant={listing.type === 'rent' ? 'rent' : 'sale'}>
                                  {listing.type === 'rent' ? 'Aluguel' : 'Venda'}
                                </Badge>
                                {listing.status === 'inactive' && (
                                  <Badge variant="inactive">Inativo</Badge>
                                )}
                                {listing.floor && (
                                  <span className="text-xs text-muted-foreground">
                                    {listing.floor}º andar
                                  </span>
                                )}
                                {listing.area && (
                                  <span className="text-xs text-muted-foreground">
                                    {listing.area} m²
                                  </span>
                                )}
                                {listing.bedrooms && (
                                  <span className="text-xs text-muted-foreground">
                                    {listing.bedrooms} dorm.
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground truncate">
                                {listing.description || 'Sem descrição'}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="font-semibold text-base">
                                {formatPrice(listing.priceCurrent)}
                              </p>
                              {listing.priceCurrent !== listing.priceOriginal && (
                                <p className="text-xs text-muted-foreground line-through">
                                  {formatPrice(listing.priceOriginal)}
                                </p>
                              )}
                              {listing.daysOnMarket !== null && (
                                <p className="text-xs text-muted-foreground mt-1 flex items-center justify-end gap-1">
                                  <Clock className="h-3 w-3" />
                                  {listing.daysOnMarket}d
                                </p>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </main>
  )
}

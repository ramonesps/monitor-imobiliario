import { NextRequest, NextResponse } from 'next/server'
import { eq, and, gte, lte } from 'drizzle-orm'
import db from '@/lib/db'
import { listings, buildings } from '@/lib/db/schema'
import type { ListingType, ListingStatus, FurnishedStatus } from '@/types'

type Params = { params: { id: string } }

// GET /api/buildings/:id/listings — lista imóveis com filtros opcionais
// Query params: type, status, furnished, price_min, price_max
export async function GET(req: NextRequest, { params }: Params) {
  try {
    // Verifica se o prédio existe
    const [building] = await db
      .select()
      .from(buildings)
      .where(eq(buildings.id, params.id))

    if (!building) {
      return NextResponse.json({ error: 'Prédio não encontrado' }, { status: 404 })
    }

    const { searchParams } = req.nextUrl
    const type = searchParams.get('type') as ListingType | null
    const status = searchParams.get('status') as ListingStatus | null
    const furnished = searchParams.get('furnished') as FurnishedStatus | null
    const priceMin = searchParams.get('price_min') ? Number(searchParams.get('price_min')) : null
    const priceMax = searchParams.get('price_max') ? Number(searchParams.get('price_max')) : null

    const conditions = [eq(listings.buildingId, params.id)]

    if (type) conditions.push(eq(listings.type, type))
    if (status) conditions.push(eq(listings.status, status))
    if (furnished) conditions.push(eq(listings.furnished, furnished))
    if (priceMin !== null) conditions.push(gte(listings.priceCurrent, priceMin))
    if (priceMax !== null) conditions.push(lte(listings.priceCurrent, priceMax))

    const rows = await db
      .select()
      .from(listings)
      .where(and(...conditions))
      .orderBy(listings.lastSeenAt)

    return NextResponse.json({ listings: rows, total: rows.length })
  } catch (error) {
    console.error('[GET /api/buildings/:id/listings]', error)
    return NextResponse.json({ error: 'Erro ao listar imóveis' }, { status: 500 })
  }
}

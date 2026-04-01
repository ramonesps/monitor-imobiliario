import { NextRequest, NextResponse } from 'next/server'
import { eq, inArray } from 'drizzle-orm'
import db from '@/lib/db'
import {
  buildings,
  listings,
  listingSources,
  priceHistory,
  listingPhotos,
  duplicateReviews,
} from '@/lib/db/schema'

type Params = { params: { id: string } }

// GET /api/buildings/:id/listings
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const buildingListings = await db
      .select()
      .from(listings)
      .where(eq(listings.buildingId, params.id))
    return NextResponse.json({ listings: buildingListings })
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao buscar anuncios' }, { status: 500 })
  }
}

// DELETE /api/buildings/:id/listings — limpa todos os anuncios do predio (mantém o predio)
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const [existing] = await db.select().from(buildings).where(eq(buildings.id, params.id))
    if (!existing) return NextResponse.json({ error: 'Predio nao encontrado' }, { status: 404 })

    const rows = await db.select({ id: listings.id }).from(listings).where(eq(listings.buildingId, params.id))
    const listingIds = rows.map((l) => l.id)
    if (listingIds.length === 0) return NextResponse.json({ ok: true, deleted: 0 })

    const sources = await db.select({ id: listingSources.id }).from(listingSources).where(inArray(listingSources.listingId, listingIds))
    const sourceIds = sources.map((s) => s.id)

    await db.delete(listingPhotos).where(inArray(listingPhotos.listingId, listingIds))
    if (sourceIds.length > 0) await db.delete(priceHistory).where(inArray(priceHistory.sourceId, sourceIds))
    await db.delete(duplicateReviews).where(inArray(duplicateReviews.listingAId, listingIds))
    await db.delete(duplicateReviews).where(inArray(duplicateReviews.listingBId, listingIds))
    await db.delete(listingSources).where(inArray(listingSources.listingId, listingIds))
    await db.delete(listings).where(eq(listings.buildingId, params.id))

    return NextResponse.json({ ok: true, deleted: listingIds.length })
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao limpar anuncios' }, { status: 500 })
  }
}

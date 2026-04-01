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

// GET /api/buildings/:id — detalhe de um prédio
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const [building] = await db
      .select()
      .from(buildings)
      .where(eq(buildings.id, params.id))

    if (!building) {
      return NextResponse.json({ error: 'Prédio não encontrado' }, { status: 404 })
    }

    return NextResponse.json({
      ...building,
      searchTerms: building.searchTerms ? JSON.parse(building.searchTerms) : [],
    })
  } catch (error) {
    console.error('[GET /api/buildings/:id]', error)
    return NextResponse.json({ error: 'Erro ao buscar prédio' }, { status: 500 })
  }
}

// PUT /api/buildings/:id — atualiza dados de um prédio
// Body: { name?, address?, city?, searchTerms?, areaMin?, areaMax?, priceMin?, priceMax? }
export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const [existing] = await db.select().from(buildings).where(eq(buildings.id, params.id))
    if (!existing) {
      return NextResponse.json({ error: 'Prédio não encontrado' }, { status: 404 })
    }

    const body = await req.json()
    const { name, address, city, searchTerms, areaMin, areaMax, rentPriceMin, rentPriceMax, salePriceMin, salePriceMax } = body

    const updates: Record<string, unknown> = {}
    if (name !== undefined) updates.name = String(name).trim()
    if (address !== undefined) updates.address = String(address).trim()
    if (city !== undefined) updates.city = city ? String(city).trim() : null
    if (searchTerms !== undefined) updates.searchTerms = JSON.stringify(searchTerms)
    if (areaMin !== undefined) updates.areaMin = areaMin !== null ? Number(areaMin) : null
    if (areaMax !== undefined) updates.areaMax = areaMax !== null ? Number(areaMax) : null
    if (rentPriceMin !== undefined) updates.rentPriceMin = rentPriceMin !== null ? Number(rentPriceMin) : null
    if (rentPriceMax !== undefined) updates.rentPriceMax = rentPriceMax !== null ? Number(rentPriceMax) : null
    if (salePriceMin !== undefined) updates.salePriceMin = salePriceMin !== null ? Number(salePriceMin) : null
    if (salePriceMax !== undefined) updates.salePriceMax = salePriceMax !== null ? Number(salePriceMax) : null

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Nenhum campo para atualizar' }, { status: 400 })
    }

    await db.update(buildings).set(updates).where(eq(buildings.id, params.id))

    const [updated] = await db.select().from(buildings).where(eq(buildings.id, params.id))
    return NextResponse.json({
      ...updated,
      searchTerms: updated.searchTerms ? JSON.parse(updated.searchTerms) : [],
    })
  } catch (error) {
    console.error('[PUT /api/buildings/:id]', error)
    return NextResponse.json({ error: 'Erro ao atualizar prédio' }, { status: 500 })
  }
}

// DELETE /api/buildings/:id — remove prédio e todos os dados associados
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const [existing] = await db.select().from(buildings).where(eq(buildings.id, params.id))
    if (!existing) {
      return NextResponse.json({ error: 'Prédio não encontrado' }, { status: 404 })
    }

    // Busca todos os listings do prédio
    const buildingListings = await db
      .select({ id: listings.id })
      .from(listings)
      .where(eq(listings.buildingId, params.id))

    const listingIds = buildingListings.map((l) => l.id)

    if (listingIds.length > 0) {
      // Busca todas as fontes dos listings
      const sources = await db
        .select({ id: listingSources.id })
        .from(listingSources)
        .where(inArray(listingSources.listingId, listingIds))

      const sourceIds = sources.map((s) => s.id)

      // Remove em cascata: fotos, histórico de preços, revisões, fontes, listings
      await db
        .delete(listingPhotos)
        .where(inArray(listingPhotos.listingId, listingIds))

      if (sourceIds.length > 0) {
        await db
          .delete(priceHistory)
          .where(inArray(priceHistory.sourceId, sourceIds))
      }

      await db
        .delete(duplicateReviews)
        .where(inArray(duplicateReviews.listingAId, listingIds))
      await db
        .delete(duplicateReviews)
        .where(inArray(duplicateReviews.listingBId, listingIds))

      await db
        .delete(listingSources)
        .where(inArray(listingSources.listingId, listingIds))

      await db.delete(listings).where(eq(listings.buildingId, params.id))
    }

    await db.delete(buildings).where(eq(buildings.id, params.id))

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[DELETE /api/buildings/:id]', error)
    return NextResponse.json({ error: 'Erro ao remover prédio' }, { status: 500 })
  }
}

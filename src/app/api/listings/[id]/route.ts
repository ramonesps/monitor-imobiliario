import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import db from '@/lib/db'
import { listings, listingSources, priceHistory, listingPhotos } from '@/lib/db/schema'

type Params = { params: { id: string } }

// GET /api/listings/[id] — detalhe completo: sources, price_history, photos
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = params

    const [listing] = await db
      .select()
      .from(listings)
      .where(eq(listings.id, id))

    if (!listing) {
      return NextResponse.json({ error: 'Imóvel não encontrado' }, { status: 404 })
    }

    const sources = await db
      .select()
      .from(listingSources)
      .where(eq(listingSources.listingId, id))

    const history = await db
      .select()
      .from(priceHistory)
      .where(eq(priceHistory.listingId, id))
      .orderBy(priceHistory.recordedAt)

    const photos = await db
      .select()
      .from(listingPhotos)
      .where(eq(listingPhotos.listingId, id))
      .orderBy(listingPhotos.orderIndex)

    return NextResponse.json({ listing, sources, priceHistory: history, photos })
  } catch (error) {
    console.error('[GET /api/listings/[id]]', error)
    return NextResponse.json({ error: 'Erro ao buscar imóvel' }, { status: 500 })
  }
}

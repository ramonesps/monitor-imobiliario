import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import db from '@/lib/db'
import { duplicateReviews, listings, listingSources } from '@/lib/db/schema'

// GET /api/duplicate-reviews — lista revisões pendentes com detalhes dos listings
export async function GET() {
  try {
    const pending = await db
      .select()
      .from(duplicateReviews)
      .where(eq(duplicateReviews.status, 'pending'))
      .orderBy(duplicateReviews.createdAt)

    // Carrega os listings A e B para cada revisão
    const enriched = await Promise.all(
      pending.map(async (review) => {
        const [listingA] = await db
          .select()
          .from(listings)
          .where(eq(listings.id, review.listingAId))

        const [listingB] = await db
          .select()
          .from(listings)
          .where(eq(listings.id, review.listingBId))

        const sourcesA = await db
          .select()
          .from(listingSources)
          .where(eq(listingSources.listingId, review.listingAId))

        const sourcesB = await db
          .select()
          .from(listingSources)
          .where(eq(listingSources.listingId, review.listingBId))

        return {
          ...review,
          listingA: listingA ? { ...listingA, sources: sourcesA } : null,
          listingB: listingB ? { ...listingB, sources: sourcesB } : null,
        }
      })
    )

    return NextResponse.json({ reviews: enriched, total: enriched.length })
  } catch (error) {
    console.error('[GET /api/duplicate-reviews]', error)
    return NextResponse.json({ error: 'Erro ao listar revisões' }, { status: 500 })
  }
}

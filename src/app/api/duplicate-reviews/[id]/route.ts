import { NextRequest, NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import db from '@/lib/db'
import { duplicateReviews, listings, listingSources } from '@/lib/db/schema'

type Params = { params: { id: string } }

// POST /api/duplicate-reviews/[id] — resolve uma revisão de duplicata
// Body: { action: 'same' | 'different' }
//   same      → merge: transfere sources de B para A, desativa B
//   different → marca como confirmed_different (mantém ambos)
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = params
    const body = await req.json()
    const { action } = body

    if (action !== 'same' && action !== 'different') {
      return NextResponse.json(
        { error: 'Campo "action" deve ser "same" ou "different"' },
        { status: 400 }
      )
    }

    const [review] = await db
      .select()
      .from(duplicateReviews)
      .where(eq(duplicateReviews.id, id))

    if (!review) {
      return NextResponse.json({ error: 'Revisão não encontrada' }, { status: 404 })
    }

    if (review.status !== 'pending') {
      return NextResponse.json({ error: 'Revisão já foi resolvida' }, { status: 409 })
    }

    if (action === 'different') {
      await db
        .update(duplicateReviews)
        .set({ status: 'confirmed_different' })
        .where(eq(duplicateReviews.id, id))

      return NextResponse.json({ success: true, action: 'confirmed_different' })
    }

    // action === 'same': merge listing B → A
    // 1. Move todas as sources de B para A
    await db
      .update(listingSources)
      .set({ listingId: review.listingAId })
      .where(eq(listingSources.listingId, review.listingBId))

    // 2. Desativa listing B
    const now = new Date().toISOString()
    await db
      .update(listings)
      .set({ status: 'inactive', deactivatedAt: now })
      .where(eq(listings.id, review.listingBId))

    // 3. Marca revisão como confirmed_same
    await db
      .update(duplicateReviews)
      .set({ status: 'confirmed_same' })
      .where(eq(duplicateReviews.id, id))

    console.log(`[reviews] Merge: listing ${review.listingBId} unificado em ${review.listingAId}`)

    return NextResponse.json({ success: true, action: 'confirmed_same', mergedInto: review.listingAId })
  } catch (error) {
    console.error('[POST /api/duplicate-reviews/[id]]', error)
    return NextResponse.json({ error: 'Erro ao resolver revisão' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import db from '@/lib/db'
import { buildings } from '@/lib/db/schema'

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

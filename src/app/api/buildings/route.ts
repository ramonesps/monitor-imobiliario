import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import db from '@/lib/db'
import { buildings } from '@/lib/db/schema'
import { generateId } from '@/lib/utils/id'

// GET /api/buildings — lista todos os prédios
export async function GET() {
  try {
    const rows = await db.select().from(buildings).orderBy(buildings.createdAt)

    const result = rows.map((b) => ({
      ...b,
      searchTerms: b.searchTerms ? JSON.parse(b.searchTerms) : [],
    }))

    return NextResponse.json({ buildings: result })
  } catch (error) {
    console.error('[GET /api/buildings]', error)
    return NextResponse.json({ error: 'Erro ao listar prédios' }, { status: 500 })
  }
}

// POST /api/buildings — cadastra um novo prédio
// Body: { name: string, address: string, searchTerms?: string[] }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, address, searchTerms } = body

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return NextResponse.json({ error: 'Campo "name" é obrigatório' }, { status: 400 })
    }
    if (!address || typeof address !== 'string' || address.trim() === '') {
      return NextResponse.json({ error: 'Campo "address" é obrigatório' }, { status: 400 })
    }

    const now = new Date().toISOString()
    const id = generateId()

    await db.insert(buildings).values({
      id,
      name: name.trim(),
      address: address.trim(),
      searchTerms: searchTerms ? JSON.stringify(searchTerms) : null,
      createdAt: now,
    })

    const [created] = await db.select().from(buildings).where(eq(buildings.id, id))

    return NextResponse.json(
      {
        ...created,
        searchTerms: created.searchTerms ? JSON.parse(created.searchTerms) : [],
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('[POST /api/buildings]', error)
    return NextResponse.json({ error: 'Erro ao cadastrar prédio' }, { status: 500 })
  }
}

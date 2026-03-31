import { NextRequest, NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import db from '@/lib/db'
import { listings } from '@/lib/db/schema'

type Params = { params: { buildingId: string } }

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2
}

// GET /api/stats/[buildingId] — estatísticas do prédio
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { buildingId } = params

    const allListings = await db
      .select()
      .from(listings)
      .where(eq(listings.buildingId, buildingId))

    const active = allListings.filter((l) => l.status === 'active')
    const inactive = allListings.filter((l) => l.status === 'inactive')
    const rent = active.filter((l) => l.type === 'rent')
    const sale = active.filter((l) => l.type === 'sale')

    const rentPrices = rent.map((l) => l.priceCurrent)
    const salePrices = sale.map((l) => l.priceCurrent)
    const salePricesPerSqm = sale
      .filter((l) => l.area && l.area > 0)
      .map((l) => l.priceCurrent / l.area!)
    const daysOnMarket = inactive
      .filter((l) => l.daysOnMarket !== null)
      .map((l) => l.daysOnMarket!)

    const avg = (arr: number[]) =>
      arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null

    return NextResponse.json({
      buildingId,
      totals: {
        active: active.length,
        inactive: inactive.length,
        rent: rent.length,
        sale: sale.length,
      },
      rent: {
        avg: avg(rentPrices),
        median: median(rentPrices),
        min: rentPrices.length ? Math.min(...rentPrices) : null,
        max: rentPrices.length ? Math.max(...rentPrices) : null,
      },
      sale: {
        avg: avg(salePrices),
        median: median(salePrices),
        min: salePrices.length ? Math.min(...salePrices) : null,
        max: salePrices.length ? Math.max(...salePrices) : null,
        avgPerSqm: avg(salePricesPerSqm),
        medianPerSqm: median(salePricesPerSqm),
      },
      market: {
        avgDaysOnMarket: avg(daysOnMarket),
        medianDaysOnMarket: median(daysOnMarket),
      },
    })
  } catch (error) {
    console.error('[GET /api/stats/[buildingId]]', error)
    return NextResponse.json({ error: 'Erro ao calcular estatísticas' }, { status: 500 })
  }
}

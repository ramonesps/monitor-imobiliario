import { NextRequest, NextResponse } from 'next/server'
import { runScraper } from '@/lib/scraper/runner'
import type { ScraperRunOptions } from '@/types'

// POST /api/scraper/run — dispara o scraper manualmente
// Body (opcional): { buildingIds?: string[], platformFilter?: string[] }
export async function POST(req: NextRequest) {
  try {
    let options: ScraperRunOptions = {}

    const contentType = req.headers.get('content-type') ?? ''
    if (contentType.includes('application/json')) {
      const body = await req.json().catch(() => ({}))
      options = {
        buildingIds: Array.isArray(body.buildingIds) ? body.buildingIds : undefined,
        platformFilter: Array.isArray(body.platformFilter) ? body.platformFilter : undefined,
      }
    } else {
      // Suporta também form POST (botão "Atualizar agora" da UI)
      const formData = await req.formData().catch(() => null)
      if (formData) {
        const buildingId = formData.get('buildingId')
        if (buildingId) options.buildingIds = [String(buildingId)]
      }
    }

    console.log('[scraper/run] Iniciando scraper com opções:', options)

    const results = await runScraper(options)

    const summary = {
      total: results.length,
      success: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      newListings: results.reduce((acc, r) => acc + r.newListings, 0),
      updatedListings: results.reduce((acc, r) => acc + r.updatedListings, 0),
      deactivatedListings: results.reduce((acc, r) => acc + r.deactivatedListings, 0),
    }

    console.log('[scraper/run] Concluído:', summary)

    return NextResponse.json({ summary, results })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[scraper/run] Erro fatal:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

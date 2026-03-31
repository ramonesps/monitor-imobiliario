// Orquestrador do scraper
// Itera buildings e plataformas, tolerante a falhas (R01)

import type { PlatformScraper, ScraperRunOptions, ScraperRunResult } from '@/types'
import { ZapScraper } from './platforms/zap'
import { VivaRealScraper } from './platforms/vivareal'
import { OlxScraper } from './platforms/olx'
import { ImovelWebScraper } from './platforms/imovelweb'
import { FriasNetoScraper } from './platforms/frias-neto'
import { MiguelImoveisScraper } from './platforms/miguel-imoveis'

// Registry de todas as plataformas disponíveis
export const ALL_SCRAPERS: PlatformScraper[] = [
  new ZapScraper(),
  new VivaRealScraper(),
  new OlxScraper(),
  new ImovelWebScraper(),
  new FriasNetoScraper(),
  new MiguelImoveisScraper(),
]

/**
 * Executa o scraper para todos os buildings e plataformas.
 * R01: Se uma plataforma lança erro, loga e continua nas demais.
 * R05: Idempotente — verifica external_url antes de criar novo listing.
 *
 * @param options - Filtros opcionais de plataforma e building
 * @returns Array de resultados por plataforma/building
 */
export async function runScraper(options: ScraperRunOptions = {}): Promise<ScraperRunResult[]> {
  const results: ScraperRunResult[] = []

  // TODO (Fase 1): Buscar buildings do banco de dados
  // const buildings = await db.select().from(buildingsTable)
  const buildings: Array<{ id: string; name: string; address: string }> = []

  // Filtra plataformas se especificado
  const scrapers = options.platformFilter
    ? ALL_SCRAPERS.filter((s) => options.platformFilter!.includes(s.name))
    : ALL_SCRAPERS

  // Filtra buildings se especificado
  const filteredBuildings = options.buildingIds
    ? buildings.filter((b) => options.buildingIds!.includes(b.id))
    : buildings

  for (const building of filteredBuildings) {
    for (const scraper of scrapers) {
      const result: ScraperRunResult = {
        platform: scraper.name,
        buildingId: building.id,
        success: false,
        newListings: 0,
        updatedListings: 0,
        deactivatedListings: 0,
      }

      try {
        console.log(`[runner] Iniciando ${scraper.name} para building "${building.name}"...`)

        // R01: Encapsula cada plataforma em try/catch individual
        const rawListings = await scraper.search(building.name, building.address)

        console.log(`[runner] ${scraper.name}: ${rawListings.length} anúncios encontrados`)

        // TODO (Fase 1): Processar rawListings:
        // - Verificar external_url existente (R05)
        // - Download e phash de fotos
        // - Comparar com listings existentes (dedup)
        // - Criar/atualizar listings, sources, price_history
        // - Detectar inativos

        result.success = true
      } catch (error) {
        // R01: Plataforma falhou — loga e continua
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.error(`[runner] ERRO em ${scraper.name} para "${building.name}": ${errorMessage}`)
        result.error = errorMessage
      }

      results.push(result)
    }
  }

  return results
}

// Orquestrador do scraper
// Itera buildings e plataformas, tolerante a falhas (R01)
// Fase 1: ZAP implementado. Fases 2+: demais plataformas

import { eq, and } from 'drizzle-orm'
import db from '@/lib/db'
import { buildings, listings, listingSources } from '@/lib/db/schema'
import { generateId } from '@/lib/utils/id'
import { generateFingerprint, hasPriceChanged } from './dedup'
import type { PlatformScraper, RawListing, ScraperRunOptions, ScraperRunResult } from '@/types'
import { ZapScraper } from './platforms/zap'
import { VivaRealScraper } from './platforms/vivareal'
import { OlxScraper } from './platforms/olx'
import { ImovelWebScraper } from './platforms/imovelweb'
import { FriasNetoScraper } from './platforms/frias-neto'
import { MiguelImoveisScraper } from './platforms/miguel-imoveis'

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
 */
export async function runScraper(options: ScraperRunOptions = {}): Promise<ScraperRunResult[]> {
  const results: ScraperRunResult[] = []

  // Busca buildings do banco
  const allBuildings = await db.select().from(buildings)

  const scrapers = options.platformFilter
    ? ALL_SCRAPERS.filter((s) => options.platformFilter!.includes(s.name))
    : ALL_SCRAPERS

  const filteredBuildings = options.buildingIds
    ? allBuildings.filter((b) => options.buildingIds!.includes(b.id))
    : allBuildings

  if (filteredBuildings.length === 0) {
    console.log('[runner] Nenhum building encontrado.')
    return results
  }

  const today = new Date().toISOString()

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

        // R01: cada plataforma em try/catch individual
        const rawListings = await scraper.search(building.name, building.address)
        console.log(`[runner] ${scraper.name}: ${rawListings.length} anúncios encontrados`)

        for (const raw of rawListings) {
          const counts = await processRawListing(raw, building.id, today)
          result.newListings += counts.new
          result.updatedListings += counts.updated
        }

        result.success = true
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.error(
          `[runner] ERRO em ${scraper.name} para "${building.name}": ${errorMessage}`
        )
        result.error = errorMessage
      }

      results.push(result)
    }

    // Detecta listings inativos (ausentes hoje em todas as sources)
    const deactivated = await deactivateStaleListings(building.id, today)
    if (deactivated > 0) {
      console.log(`[runner] ${deactivated} listing(s) marcados como inativos em "${building.name}"`)
      // Adiciona ao resultado do último scraper do building
      const last = results.filter((r) => r.buildingId === building.id).at(-1)
      if (last) last.deactivatedListings += deactivated
    }
  }

  return results
}

/**
 * Processa um RawListing: cria ou atualiza listing + source.
 * R05: Se external_url já existe em listing_sources, apenas atualiza last_seen_at.
 */
async function processRawListing(
  raw: RawListing,
  buildingId: string,
  now: string
): Promise<{ new: number; updated: number }> {
  // Verifica se a source já existe
  const [existingSource] = await db
    .select()
    .from(listingSources)
    .where(
      and(
        eq(listingSources.externalId, raw.externalId),
        eq(listingSources.platform, raw.platform)
      )
    )

  if (existingSource) {
    // Source já existe — atualiza last_seen_at e verifica preço
    await db
      .update(listingSources)
      .set({ lastSeenAt: now })
      .where(eq(listingSources.id, existingSource.id))

    // Atualiza last_seen_at do listing pai
    await db
      .update(listings)
      .set({ lastSeenAt: now })
      .where(eq(listings.id, existingSource.listingId))

    // Verifica se o preço mudou
    const [parentListing] = await db
      .select()
      .from(listings)
      .where(eq(listings.id, existingSource.listingId))

    if (parentListing && hasPriceChanged(parentListing.priceCurrent, raw.price)) {
      await db
        .update(listings)
        .set({ priceCurrent: raw.price })
        .where(eq(listings.id, parentListing.id))

      // Registra em price_history (importado inline para evitar importação circular)
      const { priceHistory } = await import('@/lib/db/schema')
      await db.insert(priceHistory).values({
        id: generateId(),
        listingId: parentListing.id,
        price: raw.price,
        sourceId: existingSource.id,
        recordedAt: now,
      })
    }

    return { new: 0, updated: 1 }
  }

  // Listing novo — cria listing + source
  const listingId = generateId()
  const fingerprint = generateFingerprint(raw)

  await db.insert(listings).values({
    id: listingId,
    buildingId,
    type: raw.type,
    unitFingerprint: fingerprint,
    floor: raw.floor ?? null,
    area: raw.area ?? null,
    bedrooms: raw.bedrooms ?? null,
    priceCurrent: raw.price,
    priceOriginal: raw.price,
    furnished: raw.furnished,
    description: raw.description,
    status: 'active',
    firstSeenAt: now,
    lastSeenAt: now,
    createdAt: now,
  })

  await db.insert(listingSources).values({
    id: generateId(),
    listingId,
    platform: raw.platform,
    agencyName: raw.agencyName ?? null,
    externalUrl: raw.externalUrl,
    externalId: raw.externalId,
    firstSeenAt: now,
    lastSeenAt: now,
  })

  return { new: 1, updated: 0 }
}

/**
 * Marca como inativo listings que não foram vistos nas últimas 2+ dias.
 * U10: ausente 2+ dias → inactive, seta deactivated_at e days_on_market.
 */
async function deactivateStaleListings(buildingId: string, today: string): Promise<number> {
  const { calculateDaysOnMarket, shouldDeactivate } = await import('./dedup')

  const active = await db
    .select()
    .from(listings)
    .where(and(eq(listings.buildingId, buildingId), eq(listings.status, 'active')))

  let count = 0
  for (const listing of active) {
    if (shouldDeactivate(listing.lastSeenAt, today)) {
      const days = calculateDaysOnMarket(listing.firstSeenAt, today)
      await db
        .update(listings)
        .set({
          status: 'inactive',
          deactivatedAt: today,
          daysOnMarket: days,
        })
        .where(eq(listings.id, listing.id))
      count++
    }
  }

  return count
}

// Orquestrador do scraper
// Itera buildings e plataformas, tolerante a falhas (R01)

import { eq, and } from 'drizzle-orm'
import db from '@/lib/db'
import {
  buildings,
  listings,
  listingSources,
  priceHistory,
  duplicateReviews,
} from '@/lib/db/schema'
import { generateId } from '@/lib/utils/id'
import {
  generateFingerprint,
  calculateSimilarity,
  hasPriceChanged,
  shouldDeactivate,
  calculateDaysOnMarket,
} from './dedup'
import type {
  PlatformScraper,
  RawListing,
  ListingFingerprint,
  ScraperRunOptions,
  ScraperRunResult,
} from '@/types'
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

export async function runScraper(options: ScraperRunOptions = {}): Promise<ScraperRunResult[]> {
  const results: ScraperRunResult[] = []

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
        console.error(`[runner] ERRO em ${scraper.name} para "${building.name}": ${errorMessage}`)
        result.error = errorMessage
      }

      results.push(result)
    }

    const deactivated = await deactivateStaleListings(building.id, today)
    if (deactivated > 0) {
      const last = results.filter((r) => r.buildingId === building.id).at(-1)
      if (last) last.deactivatedListings += deactivated
    }
  }

  return results
}

/**
 * Processa um RawListing aplicando dedup completo:
 * - Se source já existe: atualiza timestamps e preço
 * - Se source nova: compara com listings existentes (fingerprint + similaridade)
 *   - Score >= 90%: merge (nova source no listing existente)
 *   - Score 60-89%: cria listing novo + duplicate_review pending
 *   - Score < 60%: cria listing novo
 */
async function processRawListing(
  raw: RawListing,
  buildingId: string,
  now: string
): Promise<{ new: number; updated: number }> {
  // R05: verifica se a source já existe pelo externalId + platform
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
    await db
      .update(listingSources)
      .set({ lastSeenAt: now })
      .where(eq(listingSources.id, existingSource.id))

    await db
      .update(listings)
      .set({ lastSeenAt: now })
      .where(eq(listings.id, existingSource.listingId))

    const [parent] = await db
      .select()
      .from(listings)
      .where(eq(listings.id, existingSource.listingId))

    if (parent && hasPriceChanged(parent.priceCurrent, raw.price)) {
      await db
        .update(listings)
        .set({ priceCurrent: raw.price })
        .where(eq(listings.id, parent.id))

      await db.insert(priceHistory).values({
        id: generateId(),
        listingId: parent.id,
        price: raw.price,
        sourceId: existingSource.id,
        recordedAt: now,
      })
    }

    return { new: 0, updated: 1 }
  }

  // Source nova — compara com listings existentes do building
  const existingListings = await db
    .select()
    .from(listings)
    .where(and(eq(listings.buildingId, buildingId), eq(listings.status, 'active')))

  const rawFingerprint: ListingFingerprint = {
    floor: raw.floor ?? null,
    price: raw.price,
    type: raw.type,
    area: raw.area ?? null,
    bedrooms: raw.bedrooms ?? null,
    phashes: [], // fotos serão implementadas na fase seguinte
  }

  let bestMatch: (typeof existingListings)[number] | null = null
  let bestScore = 0

  for (const existing of existingListings) {
    // Filtra candidatos pelo fingerprint (filtro rápido) ou tipo+andar
    if (existing.type !== raw.type) continue

    const existingFingerprint: ListingFingerprint = {
      floor: existing.floor,
      price: existing.priceCurrent,
      type: existing.type as 'sale' | 'rent',
      area: existing.area,
      bedrooms: existing.bedrooms,
      phashes: [],
    }

    const rawScore = calculateSimilarity(rawFingerprint, existingFingerprint)

    // Normaliza para 100% quando não há fotos (máximo sem phash = 80pts)
    const score = existingFingerprint.phashes.length === 0
      ? Math.min(100, Math.round((rawScore / 80) * 100))
      : rawScore

    if (score > bestScore) {
      bestScore = score
      bestMatch = existing
    }
  }

  if (bestMatch && bestScore >= 90) {
    // Merge: adiciona como nova source do listing existente
    await db.insert(listingSources).values({
      id: generateId(),
      listingId: bestMatch.id,
      platform: raw.platform,
      agencyName: raw.agencyName ?? null,
      externalUrl: raw.externalUrl,
      externalId: raw.externalId,
      firstSeenAt: now,
      lastSeenAt: now,
    })

    await db
      .update(listings)
      .set({ lastSeenAt: now })
      .where(eq(listings.id, bestMatch.id))

    console.log(
      `[runner] Merge: ${raw.platform}/${raw.externalId} vinculado ao listing ${bestMatch.id} (score ${bestScore}%)`
    )
    return { new: 0, updated: 1 }
  }

  // Cria novo listing
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

  // Score 60-89%: cria duplicate_review para revisão manual
  if (bestMatch && bestScore >= 60) {
    // Evita criar review duplicada para o mesmo par
    const existingReview = await db
      .select()
      .from(duplicateReviews)
      .where(
        and(
          eq(duplicateReviews.listingAId, bestMatch.id),
          eq(duplicateReviews.listingBId, listingId),
          eq(duplicateReviews.status, 'pending')
        )
      )

    if (existingReview.length === 0) {
      await db.insert(duplicateReviews).values({
        id: generateId(),
        listingAId: bestMatch.id,
        listingBId: listingId,
        similarityScore: bestScore,
        status: 'pending',
        createdAt: now,
      })

      console.log(
        `[runner] Revisão: listing ${listingId} vs ${bestMatch.id} (score ${bestScore}%)`
      )
    }
  }

  return { new: 1, updated: 0 }
}

async function deactivateStaleListings(buildingId: string, today: string): Promise<number> {
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
        .set({ status: 'inactive', deactivatedAt: today, daysOnMarket: days })
        .where(eq(listings.id, listing.id))
      count++
    }
  }

  return count
}

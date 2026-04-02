// Orquestrador do scraper
// Itera buildings e plataformas, tolerante a falhas (R01)

import { eq, and } from 'drizzle-orm'
import db from '@/lib/db'
import {
  buildings,
  listings,
  listingSources,
  listingPhotos,
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
import { downloadPhoto, getPhotoDestPath, isPhotoStored } from './photo-downloader'
import { ZapScraper } from './platforms/zap'
import { VivaRealScraper } from './platforms/vivareal'
import { OlxScraper } from './platforms/olx'
import { ImovelWebScraper } from './platforms/imovelweb'
import { FriasNetoScraper } from './platforms/frias-neto'
import { MiguelImoveisScraper } from './platforms/miguel-imoveis'

/** Normaliza string para comparação: minúsculas, sem acentos, sem espaços extras */
function normalizeCity(city: string): string {
  return city
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

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

        // Monta query: usa searchTerms do building se disponível, senão usa name
        // Quando cidade configurada, inclui na query para filtrar na plataforma
        const rawSearchTerms: string[] = building.searchTerms
          ? (() => { try { return JSON.parse(building.searchTerms) } catch { return [] } })()
          : []
        const searchTerms = rawSearchTerms.length > 0 ? rawSearchTerms : [building.name]
        const queriesWithCity = building.city
          ? searchTerms.map((t) => `${t} ${building.city}`)
          : searchTerms

        // R01: cada plataforma em try/catch individual
        const seen = new Set<string>()
        const rawListings: RawListing[] = []
        for (const query of queriesWithCity) {
          const results = await scraper.search(query, building.address)
          for (const r of results) {
            const key = `${r.platform}:${r.externalId}`
            if (!seen.has(key)) {
              seen.add(key)
              rawListings.push(r)
            }
          }
        }
        console.log(`[runner] ${scraper.name}: ${rawListings.length} anúncios encontrados`)

        // M01/M02: fila de fetchDetail para listings novos com campos ou fotos ausentes
        // Identifica quais precisam de detail fetch (plataforma implementa fetchDetail)
        const needsDetail = rawListings.filter((raw) => {
          if (!('fetchDetail' in scraper)) return false
          const needsFields =
            raw.descriptionFull === undefined ||
            raw.bathrooms === undefined ||
            raw.garages === undefined ||
            raw.bedrooms === undefined
          // M02: listings sem fotos na página de busca precisam visitar o detalhe
          const needsPhotos = (raw.photoUrls ?? []).length === 0
          return needsFields || needsPhotos
        })

        if (needsDetail.length > 0 && 'fetchDetail' in scraper) {
          // Verifica quais ainda são novos (source não existe) para não rebuscar existentes
          const newOnes: RawListing[] = []
          for (const raw of needsDetail) {
            const [existing] = await db
              .select()
              .from(listingSources)
              .where(
                and(
                  eq(listingSources.externalId, raw.externalId),
                  eq(listingSources.platform, raw.platform)
                )
              )
            if (!existing) newOnes.push(raw)
          }

          // Rate limit: 3 simultâneos por plataforma, timeout 10s por fetch
          for (let i = 0; i < newOnes.length; i += 3) {
            const batch = newOnes.slice(i, i + 3)
            await Promise.all(
              batch.map(async (raw) => {
                try {
                  const detail = await Promise.race([
                    (scraper as PlatformScraper & { fetchDetail: (url: string) => Promise<Partial<RawListing>> }).fetchDetail(raw.externalUrl),
                    new Promise<Partial<RawListing>>((_, reject) =>
                      setTimeout(() => reject(new Error('timeout')), 10000)
                    ),
                  ])
                  // Mescla campos do detail somente se ausentes no raw
                  if (detail.bathrooms !== undefined && raw.bathrooms === undefined) raw.bathrooms = detail.bathrooms
                  if (detail.garages !== undefined && raw.garages === undefined) raw.garages = detail.garages
                  if (detail.bedrooms !== undefined && raw.bedrooms === undefined) raw.bedrooms = detail.bedrooms
                  if (detail.listedAt !== undefined && raw.listedAt === undefined) raw.listedAt = detail.listedAt
                  if (detail.advertiserName !== undefined && raw.advertiserName === undefined) raw.advertiserName = detail.advertiserName
                  if (detail.descriptionFull !== undefined && raw.descriptionFull === undefined) raw.descriptionFull = detail.descriptionFull
                  // M02: substitui thumbnails pelas fotos full-res do carrossel
                  if (detail.photoUrls !== undefined && detail.photoUrls.length > 0) raw.photoUrls = detail.photoUrls
                } catch (err) {
                  console.warn(`[runner] fetchDetail timeout/erro para ${raw.externalId}: ${err}`)
                }
              })
            )
          }
        }

        for (const raw of rawListings) {
          // Filtro por cidade
          if (building.city && raw.city) {
            if (normalizeCity(raw.city) !== normalizeCity(building.city)) {
              console.log(
                `[runner] Ignorando anúncio de "${raw.city}" (prédio em "${building.city}")`
              )
              continue
            }
          }

          // Filtro por área (se configurado no prédio)
          if (raw.area !== undefined) {
            if (building.areaMin !== null && raw.area < building.areaMin) continue
            if (building.areaMax !== null && raw.area > building.areaMax) continue
          }

          // Filtro por preço separado por modalidade
          if (raw.type === 'rent') {
            if (building.rentPriceMin !== null && raw.price < building.rentPriceMin) continue
            if (building.rentPriceMax !== null && raw.price > building.rentPriceMax) continue
          } else {
            if (building.salePriceMin !== null && raw.price < building.salePriceMin) continue
            if (building.salePriceMax !== null && raw.price > building.salePriceMax) continue
          }

          const counts = await processRawListing(raw, building.id, today)
          result.newListings += counts.new
          result.updatedListings += counts.updated

          // M02: baixar fotos para o listing processado (dedup via isPhotoStored)
          if (counts.listingId && raw.photoUrls && raw.photoUrls.length > 0) {
            await downloadAndSavePhotos(counts.listingId, raw.photoUrls)
          }
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
): Promise<{ new: number; updated: number; listingId: string | null }> {
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
    // M01: atualiza source com listedAt/advertiserName se ainda não preenchidos
    const sourceUpdate: Record<string, unknown> = { lastSeenAt: now }
    if (raw.listedAt && !existingSource.listedAt) sourceUpdate.listedAt = raw.listedAt
    if (raw.advertiserName && !existingSource.advertiserName) sourceUpdate.advertiserName = raw.advertiserName

    await db
      .update(listingSources)
      .set(sourceUpdate)
      .where(eq(listingSources.id, existingSource.id))

    // Atualiza cidade/estado se ainda não estavam preenchidos
    const cityUpdate: Record<string, unknown> = { lastSeenAt: now }
    if (raw.city) cityUpdate.city = raw.city
    if (raw.state) cityUpdate.state = raw.state

    await db
      .update(listings)
      .set(cityUpdate)
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

    return { new: 0, updated: 1, listingId: existingSource.listingId }
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
    bathrooms: raw.bathrooms ?? null, // M01
    garages: raw.garages ?? null,     // M01
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
      bathrooms: existing.bathrooms ?? null, // M01
      garages: existing.garages ?? null,     // M01
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
      listedAt: raw.listedAt ?? null,         // M01
      advertiserName: raw.advertiserName ?? null, // M01
    })

    const mergeUpdate: Record<string, unknown> = { lastSeenAt: now }
    if (raw.city) mergeUpdate.city = raw.city
    if (raw.state) mergeUpdate.state = raw.state

    await db
      .update(listings)
      .set(mergeUpdate)
      .where(eq(listings.id, bestMatch.id))

    console.log(
      `[runner] Merge: ${raw.platform}/${raw.externalId} vinculado ao listing ${bestMatch.id} (score ${bestScore}%)`
    )
    return { new: 0, updated: 1, listingId: bestMatch.id }
  }

  // Cria novo listing
  const listingId = generateId()
  const fingerprint = generateFingerprint(raw)

  // M01: descriptionFull sobrescreve description se disponível
  const finalDescription = raw.descriptionFull ?? raw.description

  await db.insert(listings).values({
    id: listingId,
    buildingId,
    type: raw.type,
    unitFingerprint: fingerprint,
    floor: raw.floor ?? null,
    area: raw.area ?? null,
    bedrooms: raw.bedrooms ?? null,
    bathrooms: raw.bathrooms ?? null, // M01
    garages: raw.garages ?? null,     // M01
    city: raw.city ?? null,
    state: raw.state ?? null,
    priceCurrent: raw.price,
    priceOriginal: raw.price,
    furnished: raw.furnished,
    description: finalDescription,
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
    listedAt: raw.listedAt ?? null,         // M01
    advertiserName: raw.advertiserName ?? null, // M01
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

  return { new: 1, updated: 0, listingId }
}

/**
 * M02: baixa e salva as fotos de um listing, pulando URLs já armazenadas (U14).
 * R06: falha em foto individual não bloqueia o listing.
 */
async function downloadAndSavePhotos(listingId: string, photoUrls: string[]): Promise<void> {
  for (let i = 0; i < photoUrls.length; i++) {
    const url = photoUrls[i]
    try {
      if (await isPhotoStored(url)) continue
      const destPath = getPhotoDestPath(listingId, i)
      const localPath = await downloadPhoto(url, destPath)
      await db.insert(listingPhotos).values({
        id: generateId(),
        listingId,
        urlOriginal: url,
        localPath: localPath ?? null,
        orderIndex: i,
      })
    } catch (err) {
      console.warn(`[runner] Falha ao processar foto ${i} de ${listingId}:`, err)
    }
  }
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

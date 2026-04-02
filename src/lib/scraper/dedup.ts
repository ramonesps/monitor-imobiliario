// Lógica de deduplicação de anúncios
// Usa fingerprint (filtro rápido) + phash (comparação de fotos)
// Conforme fluxo do scraper descrito no SPEC.md seção 5

import crypto from 'crypto'
import type { RawListing, ListingFingerprint, ListingType } from '@/types'
import { hammingDistance } from './phash'

/**
 * Gera um fingerprint determinístico para um anúncio.
 * U04: mesmo andar + preço (±10%) + tipo → mesmo hash
 *
 * O fingerprint é usado como filtro rápido antes da comparação de fotos.
 * Normaliza o preço para banda de 10% para tolerar variações pequenas.
 */
export function generateFingerprint(listing: Partial<RawListing>): string {
  const type = listing.type ?? 'unknown'
  const floor = listing.floor ?? 'unknown'
  const price = listing.price ?? 0

  // Normaliza preço para banda de 10% (arredonda para múltiplo de 10% do valor)
  // Ex: R$1000, R$1050, R$980 → mesma banda
  const priceBand = normalizePriceBand(price)

  // M01: bedrooms explícito para evitar fingerprint igual com quartos diferentes (U16)
  const bedrooms = listing.bedrooms ?? 'X'
  const key = `${type}:${floor}:${priceBand}|${bedrooms}`
  return crypto.createHash('md5').update(key).digest('hex')
}

/**
 * Normaliza o preço para uma banda de ±10%.
 * Permite que pequenas variações de preço não quebrem o match de fingerprint.
 */
function normalizePriceBand(price: number): number {
  if (price <= 0) return 0
  // Arredonda para o múltiplo de 10% mais próximo
  const band = Math.pow(10, Math.floor(Math.log10(price)) - 1) * 10
  return Math.round(price / band) * band
}

/**
 * Calcula a similaridade entre dois anúncios.
 * Retorna um score de 0-100.
 *
 * Algoritmo:
 * - Tipo igual: peso 20
 * - Andar igual: peso 25
 * - Área similar (±10%): peso 20
 * - Quartos igual: peso 15
 * - Phash distance < 10: peso 20
 *
 * U09: match perfeito=100%, parcial=60-89%, nenhum=<60%
 */
export function calculateSimilarity(
  a: ListingFingerprint,
  b: ListingFingerprint
): number {
  let score = 0

  // Tipo (20 pontos)
  if (a.type === b.type) {
    score += 20
  }

  // Andar (25 pontos)
  if (a.floor !== null && b.floor !== null && a.floor === b.floor) {
    score += 25
  } else if (a.floor === null && b.floor === null) {
    // Ambos sem andar — não penaliza
    score += 0
  }

  // Área (20 pontos) — tolerância ±10%
  if (a.area !== null && b.area !== null) {
    const areaDiff = Math.abs(a.area - b.area) / Math.max(a.area, b.area)
    if (areaDiff <= 0.1) {
      score += 20
    } else if (areaDiff <= 0.2) {
      score += 10
    }
  } else if (a.area === null && b.area === null) {
    score += 0
  }

  // Quartos (15 pontos)
  if (a.bedrooms !== null && b.bedrooms !== null && a.bedrooms === b.bedrooms) {
    score += 15
  } else if (a.bedrooms === null && b.bedrooms === null) {
    score += 0
  }

  // Bathrooms + Garages (M01) — desempate no range 60-89%
  // +5 se ambos coincidem; -10 se qualquer um diverge 2+ unidades; neutro para divergência de 1
  if (a.bathrooms !== null && b.bathrooms !== null && a.garages !== null && b.garages !== null) {
    const bathroomsDiff = Math.abs(a.bathrooms - b.bathrooms)
    const garagesDiff = Math.abs(a.garages - b.garages)
    if (bathroomsDiff === 0 && garagesDiff === 0) {
      score += 5
    } else if (bathroomsDiff >= 2 || garagesDiff >= 2) {
      score -= 10
    }
  }

  // Phash (20 pontos) — compara fotos disponíveis
  if (a.phashes.length > 0 && b.phashes.length > 0) {
    const minDistance = findMinPhashDistance(a.phashes, b.phashes)
    if (minDistance < 10) {
      score += 20
    } else if (minDistance < 20) {
      score += 10
    }
  }

  return Math.min(score, 100)
}

/**
 * Encontra a menor distância de Hamming entre dois conjuntos de phashes.
 * Compara todas as combinações possíveis.
 */
function findMinPhashDistance(hashes1: string[], hashes2: string[]): number {
  let minDistance = Infinity

  for (const h1 of hashes1) {
    for (const h2 of hashes2) {
      try {
        const distance = hammingDistance(h1, h2)
        if (distance < minDistance) {
          minDistance = distance
        }
      } catch {
        // Hashes incompatíveis — ignora
      }
    }
  }

  return minDistance === Infinity ? 64 : minDistance
}

/**
 * Determina a ação a tomar com base no score de similaridade.
 * Conforme SPEC.md seção 5:
 * - >= 90%: vincular como nova source
 * - 60-89%: criar duplicate_review
 * - < 60%: criar novo listing
 */
export function classifyDuplicate(score: number): 'merge' | 'review' | 'new' {
  if (score >= 90) return 'merge'
  if (score >= 60) return 'review'
  return 'new'
}

/**
 * Calcula dias no mercado entre duas datas ISO.
 * U06: deactivated_at - first_seen_at
 */
export function calculateDaysOnMarket(firstSeenAt: string, deactivatedAt: string): number {
  const first = new Date(firstSeenAt)
  const deactivated = new Date(deactivatedAt)
  const diffMs = deactivated.getTime() - first.getTime()
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)))
}

/**
 * Verifica se o preço mudou entre dois valores (threshold: R$1 de diferença).
 * U05: preço novo ≠ anterior → deve criar price_history
 */
export function hasPriceChanged(oldPrice: number, newPrice: number): boolean {
  return Math.abs(oldPrice - newPrice) >= 1
}

/**
 * Determina se um listing deve ser marcado como inativo.
 * U10: ausente 2+ dias → inactive
 */
export function shouldDeactivate(lastSeenAt: string, today: string): boolean {
  const last = new Date(lastSeenAt)
  const now = new Date(today)
  const diffDays = (now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24)
  return diffDays >= 2
}

/**
 * Parseia texto de mobília para FurnishedStatus.
 * U07: "Mobiliado" → 'full', "Semi" → 'partial', "Sem mobília" → 'none'
 */
export function parseFurnished(text: string): 'full' | 'partial' | 'none' | 'unknown' {
  const lower = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

  if (lower.includes('semi')) return 'partial'
  // Check "sem" / "nao" / "des" BEFORE generic "mobiliado" to avoid false positives
  if (
    lower.includes('sem mobilia') ||
    lower.includes('nao mobiliado') ||
    lower.includes('nao mobiliada') ||
    lower.includes('desmobiliado') ||
    lower.includes('nao mobilia')
  )
    return 'none'
  if (
    lower.includes('mobiliado') ||
    lower.includes('mobiliad') ||
    lower.includes('mobiliada') ||
    lower.includes('com mobilia')
  )
    return 'full'

  return 'unknown'
}

/**
 * Extrai número do andar a partir de texto.
 * U08: "12º andar" → "12", "Térreo" → "0"
 */
export function parseFloor(text: string): string | null {
  const normalized = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

  if (
    normalized.includes('terreo') ||
    normalized.includes('ground') ||
    normalized.includes('trreo')
  ) {
    return '0'
  }

  const matchAfter = text.match(/(\d+)\s*[°º]?\s*andar/i)
  if (matchAfter) return matchAfter[1]

  const matchBefore = text.match(/andar\s*[°º]?\s*(\d+)/i)
  if (matchBefore) return matchBefore[1]

  const numOnly = text.match(/^(\d+)$/)
  if (numOnly) return numOnly[1]

  return null
}

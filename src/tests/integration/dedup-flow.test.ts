// Testes de integração do fluxo de deduplicação
// Cobertura: I11, I12
// Usa sql.js (SQLite pure JS) para in-memory

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { generateId } from '@/lib/utils/id'
import { calculateSimilarity, classifyDuplicate } from '@/lib/scraper/dedup'
import type { ListingFingerprint } from '@/types'

async function createTestDb() {
  const initSqlJs = (await import('sql.js')).default
  const SQL = await initSqlJs()
  const db = new SQL.Database()

  db.run(`
    CREATE TABLE buildings (id TEXT PRIMARY KEY, name TEXT NOT NULL, address TEXT NOT NULL, search_terms TEXT, created_at TEXT NOT NULL);
    CREATE TABLE listings (
      id TEXT PRIMARY KEY, building_id TEXT NOT NULL, type TEXT NOT NULL, unit_fingerprint TEXT NOT NULL,
      floor TEXT, area REAL, bedrooms INTEGER, price_current REAL NOT NULL, price_original REAL NOT NULL,
      furnished TEXT NOT NULL DEFAULT 'unknown', description TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'active', first_seen_at TEXT NOT NULL, last_seen_at TEXT NOT NULL,
      deactivated_at TEXT, days_on_market INTEGER, created_at TEXT NOT NULL
    );
    CREATE TABLE listing_sources (
      id TEXT PRIMARY KEY, listing_id TEXT NOT NULL, platform TEXT NOT NULL, agency_name TEXT,
      external_url TEXT NOT NULL, external_id TEXT NOT NULL, first_seen_at TEXT NOT NULL, last_seen_at TEXT NOT NULL
    );
    CREATE TABLE duplicate_reviews (
      id TEXT PRIMARY KEY, listing_a_id TEXT NOT NULL, listing_b_id TEXT NOT NULL,
      similarity_score REAL NOT NULL, status TEXT NOT NULL DEFAULT 'pending', created_at TEXT NOT NULL
    );
  `)

  const insertBuilding = (row: Record<string, any>) =>
    db.run(`INSERT INTO buildings VALUES (?, ?, ?, ?, ?)`,
      [row.id, row.name, row.address, row.searchTerms || null, row.createdAt])

  const insertListing = (row: Record<string, any>) =>
    db.run(`INSERT INTO listings VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [row.id, row.buildingId, row.type, row.unitFingerprint,
       row.floor || null, row.area || null, row.bedrooms || null,
       row.priceCurrent, row.priceOriginal, row.furnished || 'unknown',
       row.description || '', row.status || 'active',
       row.firstSeenAt, row.lastSeenAt, row.deactivatedAt || null,
       row.daysOnMarket || null, row.createdAt])

  const insertSource = (row: Record<string, any>) =>
    db.run(`INSERT INTO listing_sources VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [row.id, row.listingId, row.platform, row.agencyName || null,
       row.externalUrl, row.externalId, row.firstSeenAt, row.lastSeenAt])

  const insertReview = (row: Record<string, any>) =>
    db.run(`INSERT INTO duplicate_reviews VALUES (?, ?, ?, ?, ?, ?)`,
      [row.id, row.listingAId, row.listingBId, row.similarityScore, row.status || 'pending', row.createdAt])

  const updateReview = (id: string, status: string) =>
    db.run(`UPDATE duplicate_reviews SET status = ? WHERE id = ?`, [status, id])

  const queryAll = (sql: string, params: any[] = []) => {
    const stmt = db.prepare(sql)
    stmt.bind(params)
    const rows: any[] = []
    while (stmt.step()) rows.push(stmt.getAsObject())
    stmt.free()
    return rows
  }

  return { db, insertBuilding, insertListing, insertSource, insertReview, updateReview, queryAll, close: () => db.close() }
}

const NOW = '2024-01-15T10:00:00.000Z'

describe('I11: Dedup merge — mesmo imóvel de 2 plataformas → 1 listing, 2 sources', () => {
  let testDb: Awaited<ReturnType<typeof createTestDb>>

  beforeEach(async () => {
    testDb = await createTestDb()
  })

  afterEach(() => {
    testDb.close()
  })

  it('deve ter score >= 90% para mesmo imóvel em plataformas diferentes', () => {
    const fingerprint1: ListingFingerprint = {
      type: 'rent', floor: '8', price: 3500, area: 75, bedrooms: 2,
      phashes: ['abcdef1234567890'],
    }
    const fingerprint2: ListingFingerprint = {
      type: 'rent', floor: '8', price: 3500, area: 75, bedrooms: 2,
      phashes: ['abcdef1234567890'],
    }
    const score = calculateSimilarity(fingerprint1, fingerprint2)
    expect(score).toBeGreaterThanOrEqual(90)
    expect(classifyDuplicate(score)).toBe('merge')
  })

  it('deve criar 1 listing com 2 sources após merge', () => {
    const { insertBuilding, insertListing, insertSource, queryAll } = testDb

    const buildingId = generateId()
    insertBuilding({ id: buildingId, name: 'Edifício Duplo', address: 'Rua Test', createdAt: NOW })

    const listingId = generateId()
    insertListing({
      id: listingId, buildingId, type: 'rent', unitFingerprint: 'fp-merge',
      priceCurrent: 3500, priceOriginal: 3500, furnished: 'full',
      description: 'Apto 2 dorms', status: 'active',
      floor: '8', area: 75, bedrooms: 2,
      firstSeenAt: NOW, lastSeenAt: NOW, createdAt: NOW,
    })

    insertSource({
      id: generateId(), listingId, platform: 'zap',
      agencyName: 'Imobiliária A', externalUrl: 'https://zapimoveis.com.br/123',
      externalId: '123', firstSeenAt: NOW, lastSeenAt: NOW,
    })

    insertSource({
      id: generateId(), listingId, platform: 'vivareal',
      agencyName: 'Imobiliária A', externalUrl: 'https://vivareal.com.br/vr-999',
      externalId: 'vr-999', firstSeenAt: NOW, lastSeenAt: NOW,
    })

    const listings = queryAll('SELECT * FROM listings')
    expect(listings).toHaveLength(1)

    const sources = queryAll('SELECT * FROM listing_sources')
    expect(sources).toHaveLength(2)
    expect(sources.every((s) => s.listing_id === listingId)).toBe(true)
    expect(sources.map((s: any) => s.platform).sort()).toEqual(['vivareal', 'zap'])
  })
})

describe('I12: Dedup review — score ambíguo → cria duplicate_review pending', () => {
  let testDb: Awaited<ReturnType<typeof createTestDb>>

  beforeEach(async () => {
    testDb = await createTestDb()
  })

  afterEach(() => {
    testDb.close()
  })

  it('deve ter score 60-89% para match ambíguo', () => {
    const fingerprint1: ListingFingerprint = {
      type: 'rent', floor: '5', price: 3500, area: 75, bedrooms: 2,
      phashes: ['abcdef1234567890'],
    }
    const fingerprint2: ListingFingerprint = {
      type: 'rent', floor: '5', price: 4200,
      area: 75, bedrooms: 2,
      phashes: ['1234567890abcdef'],
    }
    const score = calculateSimilarity(fingerprint1, fingerprint2)
    expect(score).toBeGreaterThanOrEqual(60)
    expect(score).toBeLessThanOrEqual(89)
    expect(classifyDuplicate(score)).toBe('review')
  })

  it('deve criar duplicate_review com status pending para match ambíguo', () => {
    const { insertBuilding, insertListing, insertReview, queryAll } = testDb

    const buildingId = generateId()
    insertBuilding({ id: buildingId, name: 'Test', address: 'Test', createdAt: NOW })

    const listingAId = generateId()
    insertListing({
      id: listingAId, buildingId, type: 'rent', unitFingerprint: 'fp-a',
      priceCurrent: 3500, priceOriginal: 3500,
      firstSeenAt: NOW, lastSeenAt: NOW, createdAt: NOW,
    })

    const listingBId = generateId()
    insertListing({
      id: listingBId, buildingId, type: 'rent', unitFingerprint: 'fp-b',
      priceCurrent: 4200, priceOriginal: 4200,
      firstSeenAt: NOW, lastSeenAt: NOW, createdAt: NOW,
    })

    const reviewId = generateId()
    insertReview({
      id: reviewId, listingAId, listingBId, similarityScore: 75, createdAt: NOW,
    })

    const reviews = queryAll('SELECT * FROM duplicate_reviews')
    expect(reviews).toHaveLength(1)
    expect(reviews[0].status).toBe('pending')
    expect(reviews[0].similarity_score).toBe(75)
  })

  it('deve atualizar status de review para confirmed_different', () => {
    const { insertBuilding, insertListing, insertReview, updateReview, queryAll } = testDb

    const buildingId = generateId()
    insertBuilding({ id: buildingId, name: 'Test', address: 'Test', createdAt: NOW })

    const listingAId = generateId()
    insertListing({
      id: listingAId, buildingId, type: 'rent', unitFingerprint: 'fp-a',
      priceCurrent: 3500, priceOriginal: 3500,
      firstSeenAt: NOW, lastSeenAt: NOW, createdAt: NOW,
    })

    const listingBId = generateId()
    insertListing({
      id: listingBId, buildingId, type: 'rent', unitFingerprint: 'fp-b',
      priceCurrent: 4000, priceOriginal: 4000,
      firstSeenAt: NOW, lastSeenAt: NOW, createdAt: NOW,
    })

    const reviewId = generateId()
    insertReview({
      id: reviewId, listingAId, listingBId, similarityScore: 70, createdAt: NOW,
    })

    updateReview(reviewId, 'confirmed_different')

    const reviews = queryAll('SELECT * FROM duplicate_reviews')
    expect(reviews[0].status).toBe('confirmed_different')
  })
})

// Testes de integração do fluxo de listings
// Cobertura: I08, I09, I10
// Usa sql.js (SQLite pure JS) para in-memory

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { generateId } from '@/lib/utils/id'
import { hasPriceChanged, shouldDeactivate, calculateDaysOnMarket } from '@/lib/scraper/dedup'

// Helper para criar banco SQLite in-memory com sql.js
async function createTestDb() {
  const initSqlJs = (await import('sql.js')).default
  const SQL = await initSqlJs()
  const db = new SQL.Database()

  db.run(`PRAGMA foreign_keys = ON`)

  db.run(`
    CREATE TABLE buildings (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      address TEXT NOT NULL,
      search_terms TEXT,
      created_at TEXT NOT NULL
    )
  `)

  db.run(`
    CREATE TABLE listings (
      id TEXT PRIMARY KEY,
      building_id TEXT NOT NULL,
      type TEXT NOT NULL,
      unit_fingerprint TEXT NOT NULL,
      floor TEXT,
      area REAL,
      bedrooms INTEGER,
      price_current REAL NOT NULL,
      price_original REAL NOT NULL,
      furnished TEXT NOT NULL DEFAULT 'unknown',
      description TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'active',
      first_seen_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      deactivated_at TEXT,
      days_on_market INTEGER,
      created_at TEXT NOT NULL
    )
  `)

  db.run(`
    CREATE TABLE listing_sources (
      id TEXT PRIMARY KEY,
      listing_id TEXT NOT NULL,
      platform TEXT NOT NULL,
      agency_name TEXT,
      external_url TEXT NOT NULL,
      external_id TEXT NOT NULL,
      first_seen_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL
    )
  `)

  db.run(`
    CREATE TABLE price_history (
      id TEXT PRIMARY KEY,
      listing_id TEXT NOT NULL,
      price REAL NOT NULL,
      source_id TEXT,
      recorded_at TEXT NOT NULL
    )
  `)

  // Helper functions
  const insertBuilding = (row: Record<string, any>) => {
    db.run(
      `INSERT INTO buildings VALUES (?, ?, ?, ?, ?)`,
      [row.id, row.name, row.address, row.searchTerms || null, row.createdAt]
    )
  }

  const insertListing = (row: Record<string, any>) => {
    db.run(
      `INSERT INTO listings VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        row.id, row.buildingId, row.type, row.unitFingerprint,
        row.floor || null, row.area || null, row.bedrooms || null,
        row.priceCurrent, row.priceOriginal, row.furnished || 'unknown',
        row.description || '', row.status || 'active',
        row.firstSeenAt, row.lastSeenAt, row.deactivatedAt || null,
        row.daysOnMarket || null, row.createdAt
      ]
    )
  }

  const insertSource = (row: Record<string, any>) => {
    db.run(
      `INSERT INTO listing_sources VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [row.id, row.listingId, row.platform, row.agencyName || null,
       row.externalUrl, row.externalId, row.firstSeenAt, row.lastSeenAt]
    )
  }

  const insertPriceHistory = (row: Record<string, any>) => {
    db.run(
      `INSERT INTO price_history VALUES (?, ?, ?, ?, ?)`,
      [row.id, row.listingId, row.price, row.sourceId || null, row.recordedAt]
    )
  }

  const queryAll = (sql: string, params: any[] = []) => {
    const stmt = db.prepare(sql)
    stmt.bind(params)
    const rows: any[] = []
    while (stmt.step()) rows.push(stmt.getAsObject())
    stmt.free()
    return rows
  }

  const updateListing = (id: string, fields: Record<string, any>) => {
    const sets = Object.keys(fields).map(k => `${k} = ?`).join(', ')
    db.run(`UPDATE listings SET ${sets} WHERE id = ?`, [...Object.values(fields), id])
  }

  return { db, insertBuilding, insertListing, insertSource, insertPriceHistory, queryAll, updateListing, close: () => db.close() }
}

const NOW = '2024-01-15T10:00:00.000Z'

describe('I08: Fluxo completo de novo listing', () => {
  let testDb: Awaited<ReturnType<typeof createTestDb>>

  beforeEach(async () => {
    testDb = await createTestDb()
  })

  afterEach(() => {
    testDb.close()
  })

  it('deve criar um building e um listing corretamente', () => {
    const { insertBuilding, insertListing, queryAll } = testDb

    const buildingId = generateId()
    insertBuilding({
      id: buildingId, name: 'Edifício Central',
      address: 'Rua Augusta, 1000, São Paulo',
      searchTerms: JSON.stringify(['Central', 'Augusta 1000']),
      createdAt: NOW,
    })

    const buildings = queryAll('SELECT * FROM buildings')
    expect(buildings).toHaveLength(1)
    expect(buildings[0].name).toBe('Edifício Central')

    const listingId = generateId()
    insertListing({
      id: listingId, buildingId, type: 'rent', unitFingerprint: 'fp-test-123',
      floor: '5', area: 75, bedrooms: 2, priceCurrent: 3500, priceOriginal: 3500,
      furnished: 'full', description: 'Apartamento mobiliado', status: 'active',
      firstSeenAt: NOW, lastSeenAt: NOW, createdAt: NOW,
    })

    const listings = queryAll('SELECT * FROM listings')
    expect(listings).toHaveLength(1)
    expect(listings[0].price_current).toBe(3500)
    expect(listings[0].status).toBe('active')
    expect(listings[0].floor).toBe('5')
  })

  it('deve criar uma source vinculada ao listing', () => {
    const { insertBuilding, insertListing, insertSource, queryAll } = testDb

    const buildingId = generateId()
    insertBuilding({ id: buildingId, name: 'Test', address: 'Test', createdAt: NOW })

    const listingId = generateId()
    insertListing({
      id: listingId, buildingId, type: 'rent', unitFingerprint: 'fp1',
      priceCurrent: 3500, priceOriginal: 3500, firstSeenAt: NOW, lastSeenAt: NOW, createdAt: NOW,
    })

    const sourceId = generateId()
    insertSource({
      id: sourceId, listingId, platform: 'zap',
      agencyName: 'Imobiliária Central',
      externalUrl: 'https://zapimoveis.com.br/imovel/123',
      externalId: '123', firstSeenAt: NOW, lastSeenAt: NOW,
    })

    const sources = queryAll('SELECT * FROM listing_sources')
    expect(sources).toHaveLength(1)
    expect(sources[0].platform).toBe('zap')
    expect(sources[0].listing_id).toBe(listingId)
  })
})

describe('I09: Update de listing com preço novo → price_history', () => {
  let testDb: Awaited<ReturnType<typeof createTestDb>>

  beforeEach(async () => {
    testDb = await createTestDb()
  })

  afterEach(() => {
    testDb.close()
  })

  it('deve criar registro em price_history quando preço muda', () => {
    const { insertBuilding, insertListing, insertPriceHistory, queryAll } = testDb

    const buildingId = generateId()
    insertBuilding({ id: buildingId, name: 'Test', address: 'Test', createdAt: NOW })

    const listingId = generateId()
    insertListing({
      id: listingId, buildingId, type: 'rent', unitFingerprint: 'fp1',
      priceCurrent: 3500, priceOriginal: 3500, firstSeenAt: NOW, lastSeenAt: NOW, createdAt: NOW,
    })

    const currentPrice = 3500
    const newPrice = 3800

    expect(hasPriceChanged(currentPrice, newPrice)).toBe(true)

    insertPriceHistory({
      id: generateId(), listingId, price: newPrice,
      recordedAt: '2024-01-16T10:00:00.000Z',
    })

    const history = queryAll('SELECT * FROM price_history')
    expect(history).toHaveLength(1)
    expect(history[0].price).toBe(3800)
  })

  it('não deve criar price_history quando preço não mudou', () => {
    const { queryAll } = testDb
    expect(hasPriceChanged(3500, 3500)).toBe(false)
    const history = queryAll('SELECT * FROM price_history')
    expect(history).toHaveLength(0)
  })
})

describe('I10: Deactivation flow — listing ausente 2+ dias → inactive', () => {
  let testDb: Awaited<ReturnType<typeof createTestDb>>

  beforeEach(async () => {
    testDb = await createTestDb()
  })

  afterEach(() => {
    testDb.close()
  })

  it('deve marcar listing como inactive após 2 dias ausente', () => {
    const { insertBuilding, insertListing, updateListing, queryAll } = testDb

    const buildingId = generateId()
    insertBuilding({ id: buildingId, name: 'Test', address: 'Test', createdAt: NOW })

    const listingId = generateId()
    const firstSeenAt = '2024-01-13T10:00:00.000Z'
    const lastSeenAt = '2024-01-13T10:00:00.000Z'
    const today = '2024-01-15T10:00:00.000Z'

    insertListing({
      id: listingId, buildingId, type: 'rent', unitFingerprint: 'fp1',
      priceCurrent: 3500, priceOriginal: 3500, status: 'active',
      firstSeenAt, lastSeenAt, createdAt: NOW,
    })

    expect(shouldDeactivate(lastSeenAt, today)).toBe(true)

    const daysOnMarket = calculateDaysOnMarket(firstSeenAt, today)
    expect(daysOnMarket).toBe(2)

    updateListing(listingId, {
      status: 'inactive',
      deactivated_at: today,
      days_on_market: daysOnMarket,
    })

    const listings = queryAll('SELECT * FROM listings')
    expect(listings[0].status).toBe('inactive')
    expect(listings[0].deactivated_at).toBe(today)
    expect(listings[0].days_on_market).toBe(2)
  })

  it('não deve desativar listing visto ontem', () => {
    const lastSeenAt = '2024-01-14T10:00:00.000Z'
    const today = '2024-01-15T10:00:00.000Z'
    expect(shouldDeactivate(lastSeenAt, today)).toBe(false)
  })
})

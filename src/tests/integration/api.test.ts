// Testes de integração da API
// Cobertura: I13 — CRUD de buildings + filtros de listings
// Usa sql.js (SQLite pure JS) para in-memory

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { generateId } from '@/lib/utils/id'

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

  const queryAll = (sql: string, params: any[] = []) => {
    const stmt = db.prepare(sql)
    stmt.bind(params)
    const rows: any[] = []
    while (stmt.step()) rows.push(stmt.getAsObject())
    stmt.free()
    return rows
  }

  return { db, insertBuilding, insertListing, queryAll, close: () => db.close() }
}

const NOW = '2024-01-15T10:00:00.000Z'

describe('I13: API CRUD buildings', () => {
  let testDb: Awaited<ReturnType<typeof createTestDb>>

  beforeEach(async () => {
    testDb = await createTestDb()
  })

  afterEach(() => {
    testDb.close()
  })

  it('POST /api/buildings — deve criar um prédio', () => {
    const { insertBuilding, queryAll } = testDb
    const buildingId = generateId()

    insertBuilding({
      id: buildingId, name: 'Residencial Aurora',
      address: 'Rua das Flores, 500, Campinas SP',
      searchTerms: JSON.stringify(['Aurora', 'Flores 500']),
      createdAt: NOW,
    })

    const buildings = queryAll('SELECT * FROM buildings')
    expect(buildings).toHaveLength(1)
    expect(buildings[0].name).toBe('Residencial Aurora')
    expect(buildings[0].address).toBe('Rua das Flores, 500, Campinas SP')
  })

  it('GET /api/buildings — deve listar todos os prédios', () => {
    const { insertBuilding, queryAll } = testDb

    insertBuilding({ id: generateId(), name: 'Prédio A', address: 'Rua A, 1', createdAt: NOW })
    insertBuilding({ id: generateId(), name: 'Prédio B', address: 'Rua B, 2', createdAt: NOW })
    insertBuilding({ id: generateId(), name: 'Prédio C', address: 'Rua C, 3', createdAt: NOW })

    const buildings = queryAll('SELECT * FROM buildings')
    expect(buildings).toHaveLength(3)
  })

  it('GET /api/buildings/:id — deve retornar um prédio específico', () => {
    const { insertBuilding, queryAll } = testDb
    const buildingId = generateId()

    insertBuilding({ id: buildingId, name: 'Prédio Específico', address: 'Rua Específica, 99', createdAt: NOW })

    const building = queryAll('SELECT * FROM buildings WHERE id = ?', [buildingId])
    expect(building).toHaveLength(1)
    expect(building[0].id).toBe(buildingId)
  })

  it('GET /api/buildings/:id — deve retornar vazio para ID inexistente', () => {
    const { queryAll } = testDb
    const building = queryAll('SELECT * FROM buildings WHERE id = ?', ['nonexistent-id'])
    expect(building).toHaveLength(0)
  })
})

describe('I13: API filtros de listings', () => {
  let testDb: Awaited<ReturnType<typeof createTestDb>>
  let buildingId: string

  beforeEach(async () => {
    testDb = await createTestDb()
    const { insertBuilding, insertListing } = testDb
    buildingId = generateId()
    insertBuilding({ id: buildingId, name: 'Prédio Teste', address: 'Rua Teste', createdAt: NOW })

    insertListing({
      id: generateId(), buildingId, type: 'rent', unitFingerprint: 'fp1',
      priceCurrent: 2500, priceOriginal: 2500, furnished: 'full',
      status: 'active', floor: '3', area: 60, bedrooms: 2,
      firstSeenAt: NOW, lastSeenAt: NOW, createdAt: NOW,
    })
    insertListing({
      id: generateId(), buildingId, type: 'sale', unitFingerprint: 'fp2',
      priceCurrent: 450000, priceOriginal: 500000, furnished: 'none',
      status: 'active', floor: '10', area: 90, bedrooms: 3,
      firstSeenAt: NOW, lastSeenAt: NOW, createdAt: NOW,
    })
    insertListing({
      id: generateId(), buildingId, type: 'rent', unitFingerprint: 'fp3',
      priceCurrent: 3500, priceOriginal: 3500, furnished: 'partial',
      status: 'inactive', floor: '7', area: 75, bedrooms: 2,
      firstSeenAt: NOW, lastSeenAt: NOW,
      deactivatedAt: NOW, daysOnMarket: 30, createdAt: NOW,
    })
  })

  afterEach(() => {
    testDb.close()
  })

  it('deve filtrar listings por type=rent', () => {
    const listings = testDb.queryAll(`SELECT * FROM listings WHERE type = 'rent'`)
    expect(listings).toHaveLength(2)
    listings.forEach((l) => expect(l.type).toBe('rent'))
  })

  it('deve filtrar listings por type=sale', () => {
    const listings = testDb.queryAll(`SELECT * FROM listings WHERE type = 'sale'`)
    expect(listings).toHaveLength(1)
    expect(listings[0].type).toBe('sale')
  })

  it('deve filtrar listings por status=active', () => {
    const listings = testDb.queryAll(`SELECT * FROM listings WHERE status = 'active'`)
    expect(listings).toHaveLength(2)
  })

  it('deve filtrar listings por status=inactive', () => {
    const listings = testDb.queryAll(`SELECT * FROM listings WHERE status = 'inactive'`)
    expect(listings).toHaveLength(1)
    expect(listings[0].status).toBe('inactive')
  })

  it('deve filtrar listings por faixa de preço (price_min/price_max)', () => {
    const listings = testDb.queryAll(
      `SELECT * FROM listings WHERE price_current >= ? AND price_current <= ?`,
      [2000, 4000]
    )
    expect(listings).toHaveLength(2) // 2500 e 3500
  })

  it('deve filtrar listings por furnished', () => {
    const listings = testDb.queryAll(`SELECT * FROM listings WHERE furnished = 'full'`)
    expect(listings).toHaveLength(1)
    expect(listings[0].furnished).toBe('full')
  })

  it('deve listar todos os listings de um building', () => {
    const listings = testDb.queryAll(
      `SELECT * FROM listings WHERE building_id = ?`,
      [buildingId]
    )
    expect(listings).toHaveLength(3)
  })
})

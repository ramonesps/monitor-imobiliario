// Conexão SQLite com @libsql/client + Drizzle ORM
// Usa libsql (pure JS) em vez de better-sqlite3 para evitar dependência
// de binários nativos (funciona em Windows sem Visual Studio Build Tools)
import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import * as schema from './schema'
import path from 'path'
import fs from 'fs'

const dbUrl = process.env.DATABASE_URL || 'file:./data/monitor.db'

// Garante que o diretório de dados existe
const dbPath = dbUrl.startsWith('file:') ? dbUrl.slice(5) : dbUrl
const dbDir = path.dirname(path.resolve(dbPath))
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true })
}

const client = createClient({ url: dbUrl })

export const db = drizzle(client, { schema })

// Inicializa tabelas se não existirem
export async function initDb() {
  await client.executeMultiple(`
    CREATE TABLE IF NOT EXISTS buildings (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      address TEXT NOT NULL,
      city TEXT,
      search_terms TEXT,
      area_min REAL,
      area_max REAL,
      rent_price_min REAL,
      rent_price_max REAL,
      sale_price_min REAL,
      sale_price_max REAL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS listings (
      id TEXT PRIMARY KEY,
      building_id TEXT NOT NULL REFERENCES buildings(id),
      type TEXT NOT NULL,
      unit_fingerprint TEXT NOT NULL,
      floor TEXT,
      area REAL,
      bedrooms INTEGER,
      city TEXT,
      state TEXT,
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
    );

    CREATE TABLE IF NOT EXISTS listing_sources (
      id TEXT PRIMARY KEY,
      listing_id TEXT NOT NULL REFERENCES listings(id),
      platform TEXT NOT NULL,
      agency_name TEXT,
      external_url TEXT NOT NULL,
      external_id TEXT NOT NULL,
      first_seen_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS price_history (
      id TEXT PRIMARY KEY,
      listing_id TEXT NOT NULL REFERENCES listings(id),
      price REAL NOT NULL,
      source_id TEXT REFERENCES listing_sources(id),
      recorded_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS listing_photos (
      id TEXT PRIMARY KEY,
      listing_id TEXT NOT NULL REFERENCES listings(id),
      url_original TEXT NOT NULL,
      local_path TEXT,
      phash TEXT,
      order_index INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS duplicate_reviews (
      id TEXT PRIMARY KEY,
      listing_a_id TEXT NOT NULL REFERENCES listings(id),
      listing_b_id TEXT NOT NULL REFERENCES listings(id),
      similarity_score REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL
    );
  `)

  // Migra colunas adicionadas após a criação inicial (seguro para DBs existentes)
  const newColumns = [
    'ALTER TABLE buildings ADD COLUMN city TEXT',
    'ALTER TABLE buildings ADD COLUMN area_min REAL',
    'ALTER TABLE buildings ADD COLUMN area_max REAL',
    // price_min/price_max foram substituídos por rent/sale específicos — manter para DBs antigos
    'ALTER TABLE buildings ADD COLUMN price_min REAL',
    'ALTER TABLE buildings ADD COLUMN price_max REAL',
    'ALTER TABLE buildings ADD COLUMN rent_price_min REAL',
    'ALTER TABLE buildings ADD COLUMN rent_price_max REAL',
    'ALTER TABLE buildings ADD COLUMN sale_price_min REAL',
    'ALTER TABLE buildings ADD COLUMN sale_price_max REAL',
    'ALTER TABLE listings ADD COLUMN city TEXT',
    'ALTER TABLE listings ADD COLUMN state TEXT',
  ]
  for (const sql of newColumns) {
    try {
      await client.execute(sql)
    } catch {
      // Coluna já existe — ignorar
    }
  }
}

export default db

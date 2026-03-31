// Conexão SQLite com better-sqlite3 + Drizzle ORM
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema'
import path from 'path'
import fs from 'fs'

const dbUrl = process.env.DATABASE_URL || 'file:./data/monitor.db'

// Extrai o caminho do arquivo da URL (ex: "file:./data/monitor.db" → "./data/monitor.db")
const dbPath = dbUrl.startsWith('file:') ? dbUrl.slice(5) : dbUrl

// Garante que o diretório existe
const dbDir = path.dirname(dbPath)
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true })
}

const sqlite = new Database(dbPath)

// Habilita WAL mode para melhor performance
sqlite.pragma('journal_mode = WAL')
sqlite.pragma('foreign_keys = ON')

export const db = drizzle(sqlite, { schema })

export default db

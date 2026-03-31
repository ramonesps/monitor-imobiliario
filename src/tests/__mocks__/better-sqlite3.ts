// Mock de better-sqlite3 para testes
// Usa sql.js (puro JS/WASM) como backend em vez do binding nativo
// Necessário porque better-sqlite3 requer compilação nativa (Visual Studio no Windows)

import initSqlJs from 'sql.js'

let sqlJsDb: any = null
let SqlJS: any = null

// Inicializa sql.js de forma síncrona usando a API Promise
async function getSqlJs() {
  if (!SqlJS) {
    SqlJS = await initSqlJs()
  }
  return SqlJS
}

// Wrapper síncrono para compatibilidade com better-sqlite3 API
class MockDatabase {
  private db: any
  private sqlJs: any

  constructor(filename: string) {
    // Cria banco in-memory síncrono — sql.js suporta isso
    // Nota: inicialização assíncrona é feita antes dos testes via setup
    if (!sqlJsDb) {
      throw new Error('sql.js não foi inicializado. Chame initTestDb() primeiro.')
    }
    this.db = sqlJsDb
  }

  exec(sql: string): this {
    this.db.run(sql)
    return this
  }

  pragma(pragma: string): this {
    // sql.js suporta PRAGMAs
    this.db.run(`PRAGMA ${pragma}`)
    return this
  }

  prepare(sql: string) {
    const stmt = this.db.prepare(sql)
    return {
      run: (...params: any[]) => stmt.run(params),
      get: (...params: any[]) => {
        stmt.bind(params)
        if (stmt.step()) {
          return stmt.getAsObject()
        }
        return undefined
      },
      all: (...params: any[]) => {
        stmt.bind(params)
        const rows = []
        while (stmt.step()) {
          rows.push(stmt.getAsObject())
        }
        return rows
      },
      finalize: () => stmt.free(),
    }
  }

  close(): void {
    this.db.close()
    sqlJsDb = null
  }
}

/**
 * Inicializa o banco de dados de teste.
 * Deve ser chamado antes de instanciar MockDatabase.
 */
export async function initTestDb() {
  const SQL = await getSqlJs()
  sqlJsDb = new SQL.Database()
  return sqlJsDb
}

export default MockDatabase

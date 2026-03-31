import { readdirSync, existsSync, writeFileSync } from 'fs'

const dir = 'C:\\Users\\ramon\\monitor-imobiliario'
const outFile = dir + '\\deps-check.txt'
const bsqliteDir = dir + '\\node_modules\\better-sqlite3'

let msg = 'better-sqlite3 dir: ' + existsSync(bsqliteDir) + '\n'
if (existsSync(bsqliteDir)) {
  msg += 'Contents: ' + readdirSync(bsqliteDir).join(', ') + '\n'
  const prebuiltDir = bsqliteDir + '\\prebuilds'
  msg += 'prebuilds exists: ' + existsSync(prebuiltDir) + '\n'
  if (existsSync(prebuiltDir)) {
    msg += 'prebuilds: ' + readdirSync(prebuiltDir).join(', ') + '\n'
  }
}

// Check @better-sqlite3/windows or similar
const alt1 = dir + '\\node_modules\\@better-sqlite3'
msg += '\n@better-sqlite3 dir: ' + existsSync(alt1) + '\n'

// Try to require better-sqlite3 and see what happens
try {
  const { createRequire } = await import('module')
  const req = createRequire(dir + '/package.json')
  const bs = req('better-sqlite3')
  msg += '\nbetter-sqlite3 loaded successfully!\n'
} catch(e) {
  msg += '\nbetter-sqlite3 load error: ' + e.message + '\n'
}

writeFileSync(outFile, msg)

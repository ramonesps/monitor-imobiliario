import { readdirSync, existsSync, writeFileSync } from 'fs'

const dir = 'C:\\Users\\ramon\\monitor-imobiliario'
const outFile = dir + '\\deps-check.txt'

let msg = ''

// Check vitest contents
const vitestDir = dir + '\\node_modules\\vitest'
if (existsSync(vitestDir)) {
  msg += 'vitest dir exists. Contents:\n' + readdirSync(vitestDir).join('\n')
} else {
  msg += 'vitest dir NOT found\n'
}

// Check better-sqlite3
const bsqliteDir = dir + '\\node_modules\\better-sqlite3'
if (existsSync(bsqliteDir)) {
  msg += '\n\nbetter-sqlite3 dir exists\n'
  const buildDir = bsqliteDir + '\\build'
  msg += 'build dir exists: ' + existsSync(buildDir) + '\n'
  if (existsSync(buildDir)) {
    msg += 'build contents: ' + readdirSync(buildDir).join(', ') + '\n'
  }
} else {
  msg += '\nbetter-sqlite3 NOT found\n'
}

writeFileSync(outFile, msg)

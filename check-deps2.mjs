import { readdirSync, existsSync, writeFileSync } from 'fs'

const dir = 'C:\\Users\\ramon\\monitor-imobiliario'
const nodeModulesDir = dir + '\\node_modules'
const outFile = dir + '\\deps-check.txt'

let msg = ''
if (existsSync(nodeModulesDir)) {
  const entries = readdirSync(nodeModulesDir).slice(0, 50)
  msg = 'node_modules count: ' + readdirSync(nodeModulesDir).length + '\nFirst 50 entries:\n' + entries.join('\n')

  const vitestExists = existsSync(nodeModulesDir + '\\vitest')
  const vitestBin = existsSync(nodeModulesDir + '\\.bin\\vitest.cmd')
  const bsqlite3 = existsSync(nodeModulesDir + '\\better-sqlite3')
  const drizzle = existsSync(nodeModulesDir + '\\drizzle-orm')
  msg += '\n\nvitest package: ' + vitestExists
  msg += '\nvitest.cmd in .bin: ' + vitestBin
  msg += '\nbetter-sqlite3: ' + bsqlite3
  msg += '\ndrizzle-orm: ' + drizzle
} else {
  msg = 'node_modules does NOT exist!'
}

writeFileSync(outFile, msg)
